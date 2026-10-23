import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ControlSession } from '../control/control-session.entity';
import { ControlToolCall } from '../control/control-tool-call.entity';
import { Machine } from '../control/machine.entity';
import {
  isUniqueViolation,
  machineStatus,
  sanitizeToolInputs,
} from '../control/machine-token.util';
import { appError } from '../errors/app-errors';
import { UsersService } from '../users/users.service';
import type { DeviceControlPresence } from '../device-control/device-control.util';
import {
  deviceDetailAccess,
  deviceListScope,
  deviceRevokeAccess,
  ideRegisterMayRevive,
  idleMsForKind,
  registerNeedsOwnerId,
  sessionOpenPlan,
} from './device.util';
import {
  InternalDeviceAuditDto,
  InternalDeviceSessionCloseDto,
  InternalDeviceSessionOpenDto,
  InternalDeviceSessionTouchDto,
  InternalHeartbeatDeviceDto,
  InternalRegisterDeviceDto,
  InternalRevokeDeviceDto,
} from './dto/internal-devices.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

const LIST_LIMIT = 200;

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
    @InjectRepository(Machine)
    private readonly machines: Repository<Machine>,
    @InjectRepository(ControlSession)
    private readonly sessions: Repository<ControlSession>,
    @InjectRepository(ControlToolCall)
    private readonly audit: Repository<ControlToolCall>,
  ) {}

  // ----- JWT (owner / admin) -----

  async listDevices(userId: string) {
    const me = await this.usersService.findById(userId);
    const scope = deviceListScope(!!me?.isAdmin);
    const rows =
      scope === 'all'
        ? await this.machines.find({ order: { createdAt: 'DESC' } })
        : await this.machines.find({
            where: { ownerUserId: userId },
            order: { createdAt: 'DESC' },
          });
    const usernames = new Map<string, string>();
    for (const row of rows) {
      if (!usernames.has(row.ownerUserId)) {
        const owner = await this.usersService.findById(row.ownerUserId);
        usernames.set(row.ownerUserId, owner?.username ?? '');
      }
    }
    return rows.map((row) =>
      this.serializeDevice(row, usernames.get(row.ownerUserId)),
    );
  }

  async getDevice(id: string, userId: string) {
    const device = await this.requireOwned(id, userId);
    return this.serializeDevice(device);
  }

  async updateDevice(id: string, userId: string, dto: UpdateDeviceDto) {
    const device = await this.requireOwned(id, userId);
    if (dto.name !== undefined) device.name = dto.name.trim();
    if (dto.consentMode !== undefined) device.consentMode = dto.consentMode;
    await this.machines.save(device);
    return this.serializeDevice(device);
  }

  async revokeDevice(id: string, userId: string) {
    const device = await this.machines.findOne({ where: { id } });
    const me = await this.usersService.findById(userId);
    if (deviceRevokeAccess(device, userId, !!me?.isAdmin) === 'missing') {
      throw appError('DEVICE_NOT_FOUND');
    }
    const result = await this.markRevoked(device!);
    this.notifyHubRevoke(device!);
    return result;
  }

  async listIdePresence(): Promise<DeviceControlPresence[]> {
    const rows = await this.machines.find({
      where: { kind: 'ide' },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.toHubPresence(row));
  }

  async revokeBySourceIdIfPresent(sourceId: string) {
    const device = await this.machines.findOne({
      where: { kind: 'ide', sourceId },
    });
    if (!device) return { revoked: false };
    return this.markRevoked(device);
  }

  async listSessions(id: string, userId: string) {
    await this.requireOwned(id, userId);
    const rows = await this.sessions.find({
      where: { machineId: id },
      order: { openedAt: 'DESC' },
      take: LIST_LIMIT,
    });
    return rows.map((row) => this.serializeSession(row));
  }

  async listAudit(id: string, userId: string) {
    await this.requireOwned(id, userId);
    const rows = await this.audit.find({
      where: { machineId: id },
      order: { createdAt: 'DESC' },
      take: LIST_LIMIT,
    });
    return rows.map((row) => this.serializeAudit(row));
  }

  // ----- Internal relay writes -----

  async register(dto: InternalRegisterDeviceDto) {
    if (registerNeedsOwnerId(dto.kind, dto.ownerUserId)) {
      throw appError('DEVICE_NOT_FOUND');
    }
    const ownerId = await this.resolveRegisterOwner(dto.ownerUserId);
    const existing = await this.findRegisterMatch(dto);
    if (existing) {
      if (
        existing.revokedAt &&
        !ideRegisterMayRevive(dto.kind, dto.sourceId)
      ) {
        throw appError('CONTROL_REVOKED');
      }
      if (existing.revokedAt) existing.revokedAt = null;
      existing.name = dto.name.trim();
      existing.kind = dto.kind;
      existing.ownerUserId = ownerId;
      existing.tokenHash = dto.tokenHash;
      if (dto.sourceId) existing.sourceId = dto.sourceId;
      if (dto.consentMode !== undefined) existing.consentMode = dto.consentMode;
      if (dto.remoteEnabled !== undefined) {
        existing.remoteEnabled = dto.remoteEnabled;
      }
      existing.lastSeenAt = new Date();
      await this.machines.save(existing);
      return {
        deviceId: existing.id,
        kind: existing.kind,
        ownerUserId: existing.ownerUserId,
      };
    }

    try {
      const saved = await this.machines.save(
        this.machines.create({
          ownerUserId: ownerId,
          kind: dto.kind,
          name: dto.name.trim(),
          tokenHash: dto.tokenHash,
          sourceId: dto.sourceId ?? null,
          consentMode: dto.consentMode ?? 'ask',
          remoteEnabled: dto.remoteEnabled ?? false,
          paused: false,
          lastSeenAt: new Date(),
        }),
      );
      return {
        deviceId: saved.id,
        kind: saved.kind,
        ownerUserId: saved.ownerUserId,
      };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.findRegisterMatch(dto);
      if (!raced) throw error;
      if (raced.revokedAt) throw appError('CONTROL_REVOKED');
      return {
        deviceId: raced.id,
        kind: raced.kind,
        ownerUserId: raced.ownerUserId,
      };
    }
  }

  async heartbeat(dto: InternalHeartbeatDeviceDto) {
    const device = await this.machines.findOne({
      where: { id: dto.deviceId },
    });
    if (!device) throw appError('DEVICE_NOT_FOUND');
    const revoked = device.revokedAt != null;
    if (!revoked) {
      device.lastSeenAt = new Date();
      if (dto.consentMode !== undefined) device.consentMode = dto.consentMode;
      if (dto.remoteEnabled !== undefined) {
        device.remoteEnabled = dto.remoteEnabled;
      }
      if (dto.paused !== undefined) device.paused = dto.paused;
      await this.machines.save(device);
    }
    return {
      deviceId: device.id,
      revoked,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    };
  }

  async openSession(dto: InternalDeviceSessionOpenDto) {
    const device = await this.machines.findOne({
      where: { id: dto.deviceId },
    });
    const plan = sessionOpenPlan(device, dto.callerUserId);
    if (!plan.insert) {
      throw appError(openError(plan.error));
    }
    const active = await this.sessions.findOne({
      where: { machineId: device!.id, closedAt: IsNull() },
    });
    if (active) throw appError('CONTROL_SESSION_CONFLICT');
    try {
      const row = await this.sessions.save(
        this.sessions.create({
          machineId: device!.id,
          callerUserId: dto.callerUserId,
          lastActivityAt: new Date(),
        }),
      );
      return { sessionId: row.id };
    } catch (error) {
      if (isUniqueViolation(error)) throw appError('CONTROL_SESSION_CONFLICT');
      throw error;
    }
  }

  async touchSession(dto: InternalDeviceSessionTouchDto) {
    const session = await this.requireOpenSession(dto.sessionId);
    const device = await this.machines.findOne({
      where: { id: session.machineId },
    });
    if (device?.revokedAt) return this.closeSessionRow(session, 'revoke');
    if (device?.kind === 'windows' && device.paused) {
      return this.closeSessionRow(session, 'pause');
    }
    const idleMs = idleMsForKind(device?.kind ?? 'windows');
    if (Date.now() - session.lastActivityAt.getTime() > idleMs) {
      return this.closeSessionRow(session, 'idle');
    }
    session.lastActivityAt = new Date();
    await this.sessions.save(session);
    return { closed: false };
  }

  async closeSession(dto: InternalDeviceSessionCloseDto) {
    const session = await this.sessions.findOne({
      where: { id: dto.sessionId },
    });
    if (!session) throw appError('CONTROL_SESSION_NOT_FOUND');
    return this.closeSessionRow(session, dto.reason);
  }

  async appendAudit(dto: InternalDeviceAuditDto) {
    let sessionId: string | null = dto.sessionId ?? null;
    if (sessionId) {
      const session = await this.sessions.findOne({
        where: { id: sessionId },
      });
      if (
        !session ||
        session.machineId !== dto.deviceId ||
        session.callerUserId !== dto.userId
      ) {
        throw appError('CONTROL_SESSION_NOT_FOUND');
      }
    } else {
      const device = await this.machines.findOne({
        where: { id: dto.deviceId },
      });
      if (!device) throw appError('DEVICE_NOT_FOUND');
    }
    const row = await this.audit.save(
      this.audit.create({
        sessionId,
        machineId: dto.deviceId,
        userId: dto.userId,
        tool: dto.tool,
        durationMs: dto.durationMs ?? null,
        success: dto.success,
        error: dto.error ?? null,
        inputsRedacted: sanitizeToolInputs(dto.inputsRedacted),
      }),
    );
    return { id: row.id };
  }

  async revokeInternal(dto: InternalRevokeDeviceDto) {
    const device = await this.machines.findOne({
      where: { id: dto.deviceId },
    });
    if (!device) throw appError('DEVICE_NOT_FOUND');
    return this.markRevoked(device);
  }

  // ----- internals -----

  private async resolveRegisterOwner(ownerUserId?: string): Promise<string> {
    if (ownerUserId) {
      const owner = await this.usersService.findById(ownerUserId);
      if (!owner) throw appError('DEVICE_NOT_FOUND');
      return owner.id;
    }
    const admin = await this.usersService.findFirstAdmin();
    if (!admin) throw appError('DEVICE_NOT_FOUND');
    return admin.id;
  }

  private async findRegisterMatch(dto: InternalRegisterDeviceDto) {
    if (dto.sourceId) {
      const bySource = await this.machines.findOne({
        where: { kind: dto.kind, sourceId: dto.sourceId },
      });
      if (bySource) return bySource;
    }
    return this.machines.findOne({
      where: { tokenHash: dto.tokenHash },
    });
  }

  private toHubPresence(device: Machine): DeviceControlPresence {
    return {
      id: device.sourceId || device.id,
      name: device.name,
      lastSeen: device.lastSeenAt?.toISOString() ?? '',
      remoteEnabled: device.remoteEnabled,
      revoked: device.revokedAt != null,
      paused: device.paused,
      paired: true,
      activeSessions: 0,
    };
  }

  /**
   * JWT revoke of an IDE row tells Hub so pairing/commands stop there too.
   * Fire-and-forget: Hub dual-write of revoke is the other direction.
   */
  private notifyHubRevoke(device: Machine) {
    if (device.kind !== 'ide' || !device.sourceId) return;
    const base = this.config.get<string>('ARC_HUB_URL')?.replace(/\/$/, '');
    const token = this.config.get<string>('ARC_HUB_TOKEN');
    if (!base || !token) {
      this.logger.warn(
        'ARC_HUB_URL/ARC_HUB_TOKEN unset — Hub keeps the pairing until an admin revoke',
      );
      return;
    }
    void fetch(
      `${base}/v1/devices/${encodeURIComponent(device.sourceId)}/revoke`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    )
      .then((response) => {
        if (!response.ok) {
          this.logger.warn(
            `Hub revoke answered ${response.status} for ${device.sourceId}`,
          );
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Hub revoke push failed: ${message}`);
      });
  }

  private async requireOwned(id: string, userId: string): Promise<Machine> {
    const device = await this.machines.findOne({ where: { id } });
    if (deviceDetailAccess(device, userId) === 'missing') {
      throw appError('DEVICE_NOT_FOUND');
    }
    return device!;
  }

  private async requireOpenSession(id: string): Promise<ControlSession> {
    const session = await this.sessions.findOne({ where: { id } });
    if (!session || session.closedAt) {
      throw appError('CONTROL_SESSION_NOT_FOUND');
    }
    return session;
  }

  private async markRevoked(device: Machine) {
    if (!device.revokedAt) {
      device.revokedAt = new Date();
      await this.machines.save(device);
      await this.sessions.update(
        { machineId: device.id, closedAt: IsNull() },
        { closedAt: new Date(), closeReason: 'revoke' },
      );
    }
    return { revoked: true };
  }

  private async closeSessionRow(session: ControlSession, reason: string) {
    if (!session.closedAt) {
      session.closedAt = new Date();
      session.closeReason = reason;
      await this.sessions.save(session);
    }
    return { closed: true, reason: session.closeReason };
  }

  private serializeDevice(device: Machine, ownerUsername?: string) {
    return {
      id: device.id,
      kind: device.kind,
      name: device.name,
      ownerUserId: device.ownerUserId,
      ownerUsername: ownerUsername ?? undefined,
      status: machineStatus(device, Date.now()),
      consentMode: device.consentMode,
      remoteEnabled: device.remoteEnabled,
      paused: device.paused,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      revokedAt: device.revokedAt?.toISOString() ?? null,
    };
  }

  private serializeSession(row: ControlSession) {
    return {
      id: row.id,
      deviceId: row.machineId,
      callerUserId: row.callerUserId,
      openedAt: row.openedAt.toISOString(),
      lastActivityAt: row.lastActivityAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
      closeReason: row.closeReason,
    };
  }

  private serializeAudit(row: ControlToolCall) {
    return {
      id: row.id,
      sessionId: row.sessionId,
      tool: row.tool,
      durationMs: row.durationMs,
      success: row.success,
      error: row.error,
      inputsRedacted: row.inputsRedacted,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function openError(
  error: 'not_found' | 'denied' | 'revoked' | 'disabled' | 'paused' | 'ok',
) {
  if (error === 'denied') return 'CONTROL_DENIED' as const;
  if (error === 'revoked') return 'CONTROL_REVOKED' as const;
  if (error === 'disabled') return 'CONTROL_DISABLED' as const;
  if (error === 'paused') return 'CONTROL_PAUSED' as const;
  return 'DEVICE_NOT_FOUND' as const;
}
