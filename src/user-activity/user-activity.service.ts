import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListUserActivityQueryDto } from './dto/list-user-activity-query.dto';
import { UserActivityAction } from './user-activity-action.enum';
import { UserActivity } from './user-activity.entity';

export interface RecordUserActivityInput {
  organizationId: string;
  actorUserId: string;
  action: UserActivityAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface UserActivityResponse {
  id: string;
  organizationId: string;
  actorUserId: string;
  actorUsername: string;
  action: UserActivityAction;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

@Injectable()
export class UserActivityService {
  private readonly logger = new Logger(UserActivityService.name);

  constructor(
    @InjectRepository(UserActivity)
    private readonly activityRepository: Repository<UserActivity>,
  ) {}

  record(input: RecordUserActivityInput): void {
    void this.persist(input).catch((error) => {
      this.logger.warn(
        `Failed to record activity ${input.action}: ${String(error)}`,
      );
    });
  }

  private async persist(input: RecordUserActivityInput): Promise<void> {
    const entry = this.activityRepository.create({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
    });
    await this.activityRepository.save(entry);
  }

  async listForOrganization(
    orgId: string,
    query: ListUserActivityQueryDto,
  ): Promise<UserActivityResponse[]> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const qb = this.activityRepository
      .createQueryBuilder('activity')
      .innerJoinAndSelect('activity.actor', 'actor')
      .where('activity.organizationId = :orgId', { orgId })
      .orderBy('activity.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (query.userId) {
      qb.andWhere('activity.actorUserId = :filterUserId', {
        filterUserId: query.userId,
      });
    }

    const rows = await qb.getMany();
    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      actorUserId: row.actorUserId,
      actorUsername: row.actor?.username ?? row.actorUserId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: row.summary,
      metadata: row.metadata ?? {},
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
