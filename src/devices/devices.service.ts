import { Injectable } from '@nestjs/common';
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
import {
  deviceDetailAccess,
  deviceListScope,
  deviceRevokeAccess,
  idleMsForKind,
  sessionOpenPlan,
  WINDOWS_REMOTE_ENABLED_DEFAULT,
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
  constructor(
    private readonly usersService: UsersService,
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
    return this.markRevoked(device!);
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
    const owner = await this.usersService.findById(dto.ownerUserId);
    if (!owner) throw appError('DEVICE_NOT_FOUND');

    const existing = await this.machines.findOne({
      where: { tokenHash: dto.tokenHash },
    });
    if (existing) {
      if (existing.revokedAt) throw appError('CONTROL_REVOKED');
      existing.name = dto.name.trim();
      existing.kind = dto.kind;
      if (dto.consentMode !== undefined) existing.consentMode = dto.consentMode;
      if (dto.remoteEnabled !== undefined) {
        existing.remoteEnabled = dto.remoteEnabled;
      }
      existing.lastSeenAt = new Date();
      await this.machines.save(existing);
      return { deviceId: existing.id, kind: existing.kind };
    }

    try {
      const saved = await this.machines.save(
        this.machines.create({
          ownerUserId: dto.ownerUserId,
          kind: dto.kind,
          name: dto.name.trim(),
          tokenHash: dto.tokenHash,
          consentMode: dto.consentMode ?? 'ask',
          remoteEnabled: dto.remoteEnabled ?? WINDOWS_REMOTE_ENABLED_DEFAULT,
          paused: false,
          lastSeenAt: new Date(),
        }),
      );
      return { deviceId: saved.id, kind: saved.kind };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.machines.findOne({
        where: { tokenHash: dto.tokenHash },
      });
      if (!raced) throw error;
      if (raced.revokedAt) throw appError('CONTROL_REVOKED');
      return { deviceId: raced.id, kind: raced.kind };
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
    const session = await this.sessions.findOne({
      where: { id: dto.sessionId },
    });
    if (
      !session ||
      session.machineId !== dto.deviceId ||
      session.callerUserId !== dto.userId
    ) {
      throw appError('CONTROL_SESSION_NOT_FOUND');
    }
    const row = await this.audit.save(
      this.audit.create({
        sessionId: session.id,
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
