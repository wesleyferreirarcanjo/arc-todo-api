import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { sha256Hex, inspectCode, pkceMatches } from '../auth/desktop-auth.util';
import { appError } from '../errors/app-errors';
import { UsersService } from '../users/users.service';
import { ControlSession } from './control-session.entity';
import { ControlToolCall } from './control-tool-call.entity';
import { MachineConnectSession } from './machine-connect-session.entity';
import { Machine } from './machine.entity';
import { TokenUsage } from './token-usage.entity';
import {
  CONNECT_CODE_TTL_MS,
  SESSION_IDLE_MS,
  controlOpenVerdict,
  hashMachineToken,
  inspectMachineAuth,
  isUniqueViolation,
  machineConnectCallbackUrl,
  machineStatus,
  mintMachineToken,
  sanitizeToolInputs,
} from './machine-token.util';
import { InternalMachineAuthenticateDto } from './dto/internal-machine-authenticate.dto';
import { InternalSessionCloseDto } from './dto/internal-session-close.dto';
import { InternalSessionOpenDto } from './dto/internal-session-open.dto';
import { InternalSessionTouchDto } from './dto/internal-session-touch.dto';
import { InternalToolCallDto } from './dto/internal-tool-call.dto';
import { MachineConnectAuthorizeDto } from './dto/machine-connect-authorize.dto';
import { MachineConnectTokenDto } from './dto/machine-connect-token.dto';
import { MachineRenameDto } from './dto/machine-rename.dto';
import { UsageUploadDto } from './dto/usage-upload.dto';

const TOOL_CALL_LIMIT = 200;

@Injectable()
export class ControlService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(Machine)
    private readonly machines: Repository<Machine>,
    @InjectRepository(MachineConnectSession)
    private readonly connectSessions: Repository<MachineConnectSession>,
    @InjectRepository(ControlSession)
    private readonly sessions: Repository<ControlSession>,
    @InjectRepository(ControlToolCall)
    private readonly toolCalls: Repository<ControlToolCall>,
    @InjectRepository(TokenUsage)
    private readonly usage: Repository<TokenUsage>,
    private readonly dataSource: DataSource,
  ) {}

  // ----- Owner/admin user-facing routes (JWT) -----

  /** Owners see their own rows; admins see all rows for the revoke UI. */
  async listMachines(userId: string) {
    const me = await this.usersService.findById(userId);
    const rows = me?.isAdmin
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
      this.serializeMachine(row, usernames.get(row.ownerUserId)),
    );
  }

  async renameMachine(id: string, userId: string, dto: MachineRenameDto) {
    const machine = await this.ownedMachine(id, userId);
    machine.name = dto.name.trim();
    await this.machines.save(machine);
    return this.serializeMachine(machine);
  }

  /** Owner or admin may revoke — the only admin-allowed mutation. */
  async revokeMachine(id: string, userId: string) {
    const machine = await this.machines.findOne({ where: { id } });
    const me = await this.usersService.findById(userId);
    if (!machine || (machine.ownerUserId !== userId && !me?.isAdmin)) {
      throw appError('CONTROL_NOT_FOUND');
    }
    if (!machine.revokedAt) {
      machine.revokedAt = new Date();
      await this.machines.save(machine);
      // A revoked machine can never be controlled — drop live sessions now.
      await this.sessions.update(
        { machineId: machine.id, closedAt: IsNull() },
        { closedAt: new Date(), closeReason: 'revoke' },
      );
    }
    return { revoked: true };
  }

  /** Owner-only detail — admins do not get sessions/tool calls/usage. */
  async listSessions(machineId: string, userId: string) {
    await this.ownedMachine(machineId, userId);
    const rows = await this.sessions.find({
      where: { machineId },
      order: { openedAt: 'DESC' },
      take: TOOL_CALL_LIMIT,
    });
    return rows.map((row) => this.serializeSession(row));
  }

  async listToolCalls(machineId: string, userId: string) {
    await this.ownedMachine(machineId, userId);
    const rows = await this.toolCalls.find({
      where: { machineId },
      order: { createdAt: 'DESC' },
      take: TOOL_CALL_LIMIT,
    });
    return rows.map((row) => this.serializeToolCall(row));
  }

  async listUsage(machineId: string, userId: string) {
    await this.ownedMachine(machineId, userId);
    const rows = await this.usage.find({
      where: { machineId },
      order: { createdAt: 'DESC' },
      take: TOOL_CALL_LIMIT,
    });
    return rows.map((row) => this.serializeUsage(row));
  }

  /** Owner JWT usage upload for Arc IDE (#ard-295) — caller must match. */
  reportUsage(userId: string, dto: UsageUploadDto) {
    return this.insertUsage(dto, userId);
  }

  // ----- Connect this machine (PKCE, /auth/machine/*) -----

  authorizeMachineConnect(userId: string, dto: MachineConnectAuthorizeDto) {
    const code = randomBytes(32).toString('base64url');
    const row = this.connectSessions.create({
      userId,
      stateHash: sha256Hex(dto.state),
      codeChallenge: dto.codeChallenge,
      codeHash: sha256Hex(code),
      codeExpiresAt: new Date(Date.now() + CONNECT_CODE_TTL_MS),
      codeUsedAt: null,
      machineName: dto.name?.trim() || null,
    });
    return this.connectSessions.save(row).then(() => ({
      callbackUrl: machineConnectCallbackUrl(code, dto.state),
    }));
  }

  async exchangeMachineConnectCode(dto: MachineConnectTokenDto) {
    const presented = sha256Hex(dto.code);
    const found = await this.connectSessions.findOne({
      where: { codeHash: presented },
    });
    const verdict = inspectCode(toCodeCheck(found), presented, Date.now());
    if (verdict !== 'ok' || !found) {
      throw appError(connectCodeError(verdict));
    }
    if (!pkceMatches(dto.codeVerifier, found.codeChallenge)) {
      throw appError('CONTROL_VERIFIER');
    }

    const machineToken = mintMachineToken();
    const machineId = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(MachineConnectSession);
      const locked = await repo.findOne({
        where: { id: found.id },
        lock: { mode: 'pessimistic_write' },
      });
      const again = inspectCode(toCodeCheck(locked), presented, Date.now());
      if (again !== 'ok' || !locked) {
        throw appError(connectCodeError(again));
      }
      if (!pkceMatches(dto.codeVerifier, locked.codeChallenge)) {
        throw appError('CONTROL_VERIFIER');
      }
      locked.codeUsedAt = new Date();
      await repo.save(locked);

      const machine = manager.getRepository(Machine).create({
        ownerUserId: locked.userId,
        name: locked.machineName || 'Windows PC',
        tokenHash: hashMachineToken(machineToken),
        remoteEnabled: false,
        paused: false,
      });
      const saved = await manager.getRepository(Machine).save(machine);
      return saved.id;
    });

    return {
      machineId,
      machineToken,
      name: found.machineName || 'Windows PC',
    };
  }

  // ----- Internal service-token routes (/internal/control/*) -----

  async authenticateMachine(dto: InternalMachineAuthenticateDto) {
    const presented = hashMachineToken(dto.machineToken);
    const machine = await this.machines.findOne({
      where: { tokenHash: presented },
    });
    const verdict = inspectMachineAuth(
      machine ? { tokenHash: machine.tokenHash, revokedAt: machine.revokedAt } : null,
      presented,
    );
    if (verdict === 'mismatch' || !machine) {
      throw appError('CONTROL_TOKEN_INVALID');
    }
    const revoked = verdict === 'revoked';
    if (!revoked) {
      machine.lastSeenAt = new Date();
      await this.machines.save(machine);
    }
    return {
      machineId: machine.id,
      ownerUserId: machine.ownerUserId,
      revoked,
      remoteEnabled: machine.remoteEnabled,
      paused: machine.paused,
    };
  }

  async openSession(dto: InternalSessionOpenDto) {
    const machine = await this.machines.findOne({
      where: { id: dto.machineId },
    });
    if (!machine) {
      throw appError('CONTROL_NOT_FOUND');
    }
    const verdict = controlOpenVerdict(machine, dto.callerUserId);
    if (verdict === 'denied') throw appError('CONTROL_DENIED');
    if (verdict === 'revoked') throw appError('CONTROL_REVOKED');
    if (verdict === 'disabled') throw appError('CONTROL_DISABLED');
    if (verdict === 'paused') throw appError('CONTROL_PAUSED');

    const active = await this.sessions.findOne({
      where: { machineId: machine.id, closedAt: IsNull() },
    });
    if (active) {
      throw appError('CONTROL_SESSION_CONFLICT');
    }
    try {
      const row = await this.sessions.save(
        this.sessions.create({
          machineId: machine.id,
          callerUserId: dto.callerUserId,
          lastActivityAt: new Date(),
        }),
      );
      return { sessionId: row.id };
    } catch (error) {
      // Two races past the check hit the partial unique index.
      if (isUniqueViolation(error)) {
        throw appError('CONTROL_SESSION_CONFLICT');
      }
      throw error;
    }
  }

  async touchSession(dto: InternalSessionTouchDto) {
    const session = await this.requireSession(dto.sessionId);
    const machine = await this.machines.findOne({
      where: { id: session.machineId },
    });
    if (machine?.revokedAt) {
      return this.closeSessionRow(session, 'revoke');
    }
    if (machine?.paused) {
      return this.closeSessionRow(session, 'pause');
    }
    if (Date.now() - session.lastActivityAt.getTime() > SESSION_IDLE_MS) {
      return this.closeSessionRow(session, 'idle');
    }
    session.lastActivityAt = new Date();
    await this.sessions.save(session);
    return { closed: false };
  }

  async closeSession(dto: InternalSessionCloseDto) {
    const session = await this.sessions.findOne({
      where: { id: dto.sessionId },
    });
    if (!session) {
      throw appError('CONTROL_SESSION_NOT_FOUND');
    }
    return this.closeSessionRow(session, dto.reason);
  }

  async recordToolCall(dto: InternalToolCallDto) {
    const session = await this.sessions.findOne({
      where: { id: dto.sessionId },
    });
    if (
      !session ||
      session.machineId !== dto.machineId ||
      session.callerUserId !== dto.userId
    ) {
      throw appError('CONTROL_SESSION_NOT_FOUND');
    }
    const row = await this.toolCalls.save(
      this.toolCalls.create({
        sessionId: session.id,
        machineId: dto.machineId,
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

  recordUsageInternal(dto: UsageUploadDto) {
    return this.insertUsage(dto);
  }

  // ----- internals -----

  /** Same row must never be recorded twice — `turn_id` is unique (BR-IDE-58). */
  private async insertUsage(dto: UsageUploadDto, enforcedUserId?: string) {
    if (enforcedUserId && dto.arcTodoUserId !== enforcedUserId) {
      throw appError('CONTROL_USAGE_USER_MISMATCH');
    }
    let machineId: string | null = null;
    if (dto.controlSessionId) {
      const session = await this.sessions.findOne({
        where: { id: dto.controlSessionId },
      });
      machineId = session?.machineId ?? null;
    }
    const existing = await this.usage.findOne({
      where: { turnId: dto.turnId },
    });
    if (existing) {
      return { inserted: false };
    }
    try {
      await this.usage.insert(
        this.usage.create({
          turnId: dto.turnId,
          arcTodoUserId: dto.arcTodoUserId,
          controlSessionId: dto.controlSessionId ?? null,
          machineId,
          estimatedInputTokens: dto.estimatedInputTokens ?? null,
          estimatedOutputTokens: dto.estimatedOutputTokens ?? null,
          reportedInputTokens: dto.reportedInputTokens ?? null,
          reportedOutputTokens: dto.reportedOutputTokens ?? null,
          costDelta: dto.costDelta != null ? String(dto.costDelta) : null,
          costCurrency: dto.costCurrency ?? null,
          source: dto.source,
        }),
      );
      return { inserted: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { inserted: false };
      }
      throw error;
    }
  }

  private async ownedMachine(id: string, userId: string): Promise<Machine> {
    const machine = await this.machines.findOne({ where: { id } });
    // Non-owners see the same not-found as a missing row — no existence leak.
    if (!machine || machine.ownerUserId !== userId) {
      throw appError('CONTROL_NOT_FOUND');
    }
    return machine;
  }

  private async requireSession(id: string): Promise<ControlSession> {
    const session = await this.sessions.findOne({ where: { id } });
    if (!session || session.closedAt) {
      throw appError('CONTROL_SESSION_NOT_FOUND');
    }
    return session;
  }

  private async closeSessionRow(session: ControlSession, reason: string) {
    if (!session.closedAt) {
      session.closedAt = new Date();
      session.closeReason = reason;
      await this.sessions.save(session);
    }
    return { closed: true, reason: session.closeReason };
  }

  private serializeMachine(machine: Machine, ownerUsername?: string) {
    return {
      id: machine.id,
      name: machine.name,
      ownerUserId: machine.ownerUserId,
      ownerUsername: ownerUsername ?? undefined,
      status: machineStatus(machine, Date.now()),
      remoteEnabled: machine.remoteEnabled,
      paused: machine.paused,
      lastSeenAt: machine.lastSeenAt?.toISOString() ?? null,
      revokedAt: machine.revokedAt?.toISOString() ?? null,
    };
  }

  private serializeSession(row: ControlSession) {
    return {
      id: row.id,
      machineId: row.machineId,
      callerUserId: row.callerUserId,
      openedAt: row.openedAt.toISOString(),
      lastActivityAt: row.lastActivityAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
      closeReason: row.closeReason,
    };
  }

  private serializeToolCall(row: ControlToolCall) {
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

  private serializeUsage(row: TokenUsage) {
    return {
      id: row.id,
      turnId: row.turnId,
      controlSessionId: row.controlSessionId,
      estimatedInputTokens: row.estimatedInputTokens,
      estimatedOutputTokens: row.estimatedOutputTokens,
      reportedInputTokens: row.reportedInputTokens,
      reportedOutputTokens: row.reportedOutputTokens,
      costDelta: row.costDelta != null ? Number(row.costDelta) : null,
      costCurrency: row.costCurrency,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function toCodeCheck(row: MachineConnectSession | null) {
  if (!row) return null;
  return {
    codeHash: row.codeHash,
    codeExpiresAt: row.codeExpiresAt?.getTime() ?? null,
    codeUsedAt: row.codeUsedAt?.getTime() ?? null,
  };
}

function connectCodeError(verdict: string) {
  if (verdict === 'expired') return 'CONTROL_CODE_EXPIRED' as const;
  if (verdict === 'reused') return 'CONTROL_CODE_REUSED' as const;
  return 'CONTROL_CODE_INVALID' as const;
}
