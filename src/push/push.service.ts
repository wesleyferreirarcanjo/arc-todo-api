import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as webpush from 'web-push';
import { Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { UpdatePushPreferencesDto } from './dto/update-push-preferences.dto';
import { PushPreference } from './push-preference.entity';
import { PushSubscription } from './push-subscription.entity';

export type PushEventKind = 'comment' | 'status_gate' | 'due_today';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  kind: PushEventKind;
  taskId?: string;
  displayId?: string;
}

export interface PushPreferencesResponse {
  notifyComment: boolean;
  notifyStatusGate: boolean;
  notifyDueToday: boolean;
  optedIn: boolean;
  optedInAt: string | null;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private vapidConfigured = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PushSubscription)
    private readonly subscriptionsRepository: Repository<PushSubscription>,
    @InjectRepository(PushPreference)
    private readonly preferencesRepository: Repository<PushPreference>,
  ) {
    this.configureVapid();
  }

  getVapidPublicKey(): { publicKey: string } {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    if (!publicKey || !this.vapidConfigured) {
      throw appError('PUSH_NOT_CONFIGURED');
    }
    return { publicKey };
  }

  async upsertSubscription(
    userId: string,
    dto: CreatePushSubscriptionDto,
  ): Promise<{ id: string }> {
    this.assertConfigured();
    const existing = await this.subscriptionsRepository.findOne({
      where: { endpoint: dto.endpoint },
    });

    if (existing) {
      existing.userId = userId;
      existing.p256dh = dto.keys.p256dh;
      existing.auth = dto.keys.auth;
      existing.userAgent = dto.userAgent?.slice(0, 512) ?? null;
      await this.subscriptionsRepository.save(existing);
      await this.ensureOptedIn(userId);
      return { id: existing.id };
    }

    const created = this.subscriptionsRepository.create({
      userId,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: dto.userAgent?.slice(0, 512) ?? null,
    });
    const saved = await this.subscriptionsRepository.save(created);
    await this.ensureOptedIn(userId);
    return { id: saved.id };
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<void> {
    await this.subscriptionsRepository.delete({ userId, endpoint });
    const remaining = await this.subscriptionsRepository.count({
      where: { userId },
    });
    if (remaining === 0) {
      await this.setOptedOut(userId);
    }
  }

  async getPreferences(userId: string): Promise<PushPreferencesResponse> {
    const prefs = await this.preferencesRepository.findOne({
      where: { userId },
    });
    return this.toPreferencesResponse(prefs);
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePushPreferencesDto,
  ): Promise<PushPreferencesResponse> {
    let prefs = await this.preferencesRepository.findOne({ where: { userId } });
    if (!prefs) {
      prefs = this.preferencesRepository.create({
        userId,
        notifyComment: true,
        notifyStatusGate: true,
        notifyDueToday: true,
        optedInAt: null,
      });
    }

    if (dto.notifyComment !== undefined) prefs.notifyComment = dto.notifyComment;
    if (dto.notifyStatusGate !== undefined) {
      prefs.notifyStatusGate = dto.notifyStatusGate;
    }
    if (dto.notifyDueToday !== undefined) prefs.notifyDueToday = dto.notifyDueToday;

    if (dto.optedIn === true) {
      prefs.optedInAt = prefs.optedInAt ?? new Date();
    } else if (dto.optedIn === false) {
      prefs.optedInAt = null;
      await this.subscriptionsRepository.delete({ userId });
    }

    const saved = await this.preferencesRepository.save(prefs);
    return this.toPreferencesResponse(saved);
  }

  /** Notify task creator for a qualifying event. Fire-and-forget safe. */
  async notifyUser(
    userId: string | null | undefined,
    actorUserId: string | null | undefined,
    kind: PushEventKind,
    payload: PushPayload,
  ): Promise<void> {
    if (!userId || !this.vapidConfigured) return;
    if (actorUserId && actorUserId === userId) return;

    try {
      const prefs = await this.preferencesRepository.findOne({
        where: { userId },
      });
      if (!prefs?.optedInAt) return;
      if (kind === 'comment' && !prefs.notifyComment) return;
      if (kind === 'status_gate' && !prefs.notifyStatusGate) return;
      if (kind === 'due_today' && !prefs.notifyDueToday) return;

      const subscriptions = await this.subscriptionsRepository.find({
        where: { userId },
      });
      if (subscriptions.length === 0) return;

      await Promise.all(
        subscriptions.map((sub) => this.sendToSubscription(sub, payload)),
      );
    } catch (error) {
      this.logger.error(`Failed to notify user ${userId} (${kind})`, error);
    }
  }

  async listOptedInUserIdsForDueToday(): Promise<string[]> {
    const rows = await this.preferencesRepository
      .createQueryBuilder('prefs')
      .select('prefs.user_id', 'userId')
      .where('prefs.opted_in_at IS NOT NULL')
      .andWhere('prefs.notify_due_today = true')
      .getRawMany<{ userId: string }>();
    return rows.map((row) => row.userId);
  }

  private async sendToSubscription(
    sub: PushSubscription,
    payload: PushPayload,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
    } catch (error: unknown) {
      const statusCode =
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof (error as { statusCode: unknown }).statusCode === 'number'
          ? (error as { statusCode: number }).statusCode
          : undefined;

      if (statusCode === 404 || statusCode === 410) {
        await this.subscriptionsRepository.delete({ id: sub.id });
        this.logger.log(`Pruned dead push subscription ${sub.id}`);
        return;
      }
      this.logger.warn(
        `Push send failed for subscription ${sub.id}: ${String(error)}`,
      );
    }
  }

  private configureVapid(): void {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>(
      'VAPID_SUBJECT',
      'mailto:wesleyferreirarcanjo@gmail.com',
    );
    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — Web Push disabled',
      );
      return;
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.vapidConfigured = true;
  }

  private assertConfigured(): void {
    if (!this.vapidConfigured) {
      throw appError('PUSH_NOT_CONFIGURED');
    }
  }

  private async ensureOptedIn(userId: string): Promise<void> {
    let prefs = await this.preferencesRepository.findOne({ where: { userId } });
    if (!prefs) {
      prefs = this.preferencesRepository.create({
        userId,
        notifyComment: true,
        notifyStatusGate: true,
        notifyDueToday: true,
        optedInAt: new Date(),
      });
    } else if (!prefs.optedInAt) {
      prefs.optedInAt = new Date();
    }
    await this.preferencesRepository.save(prefs);
  }

  private async setOptedOut(userId: string): Promise<void> {
    const prefs = await this.preferencesRepository.findOne({ where: { userId } });
    if (!prefs) return;
    prefs.optedInAt = null;
    await this.preferencesRepository.save(prefs);
  }

  private toPreferencesResponse(
    prefs: PushPreference | null,
  ): PushPreferencesResponse {
    return {
      notifyComment: prefs?.notifyComment ?? true,
      notifyStatusGate: prefs?.notifyStatusGate ?? true,
      notifyDueToday: prefs?.notifyDueToday ?? true,
      optedIn: Boolean(prefs?.optedInAt),
      optedInAt: prefs?.optedInAt ? prefs.optedInAt.toISOString() : null,
    };
  }
}
