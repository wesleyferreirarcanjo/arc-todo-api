import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { UsersService } from '../users/users.service';
import { DesktopAuthSession } from './desktop-auth-session.entity';
import {
  CODE_TTL_MS,
  REFRESH_TTL_MS,
  desktopCallbackUrl,
  inspectCode,
  inspectRefresh,
  pkceMatches,
  sha256Hex,
} from './desktop-auth.util';
import { DesktopAuthorizeDto } from './dto/desktop-authorize.dto';
import { DesktopRefreshDto } from './dto/desktop-refresh.dto';
import { DesktopTokenDto } from './dto/desktop-token.dto';
import { GoogleSsoDto } from './dto/google-sso.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(DesktopAuthSession)
    private readonly desktopSessions: Repository<DesktopAuthSession>,
    private readonly dataSource: DataSource,
  ) {
    this.googleClient = new OAuth2Client();
  }

  async login(dto: LoginDto) {
    if (this.usersService.isSsoOnly()) {
      throw appError('AUTH_PASSWORD_DISABLED');
    }

    const user = await this.usersService.findByUsername(dto.username);
    if (!user) {
      throw appError('AUTH_INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw appError('AUTH_INVALID_CREDENTIALS');
    }

    return this.issueSession(user.id, user.username, user.isAdmin);
  }

  async loginWithGoogle(dto: GoogleSsoDto) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw appError('AUTH_SSO_NOT_CONFIGURED');
    }

    let email: string;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.id_token,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) {
        throw appError('AUTH_SSO_MISSING_EMAIL');
      }
      if (payload.email_verified === false) {
        throw appError('AUTH_SSO_UNVERIFIED_EMAIL');
      }
      email = payload.email;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw appError('AUTH_SSO_INVALID_TOKEN');
    }

    const user = await this.usersService.findBySsoAssign(email);
    if (!user) {
      throw appError('AUTH_SSO_UNASSIGNED');
    }

    return this.issueSession(user.id, user.username, user.isAdmin);
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw appError('AUTH_SESSION_USER_MISSING');
    }

    return {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    };
  }

  async issueAdminServiceToken(): Promise<string> {
    const username = this.configService.get<string>('ADMIN_USERNAME', 'admin');
    const user = await this.usersService.findByUsername(username);
    if (!user?.isAdmin) {
      throw appError('AUTH_SERVICE_ADMIN_MISSING');
    }
    const session = await this.issueSession(
      user.id,
      user.username,
      user.isAdmin,
    );
    return session.access_token;
  }

  async authorizeDesktop(userId: string, dto: DesktopAuthorizeDto) {
    const code = randomBytes(32).toString('base64url');
    const now = Date.now();
    const row = this.desktopSessions.create({
      userId,
      stateHash: sha256Hex(dto.state),
      codeChallenge: dto.codeChallenge,
      codeHash: sha256Hex(code),
      codeExpiresAt: new Date(now + CODE_TTL_MS),
      codeUsedAt: null,
      refreshHash: null,
      previousRefreshHash: null,
      refreshExpiresAt: null,
      revokedAt: null,
    });
    await this.desktopSessions.save(row);
    return { callbackUrl: desktopCallbackUrl(code, dto.state) };
  }

  async exchangeDesktopCode(dto: DesktopTokenDto) {
    const presented = sha256Hex(dto.code);
    const found = await this.desktopSessions.findOne({ where: { codeHash: presented } });
    const verdict = inspectCode(toCodeCheck(found), presented, Date.now());
    if (verdict !== 'ok' || !found) {
      throw appError(codeError(verdict));
    }
    if (!pkceMatches(dto.codeVerifier, found.codeChallenge)) {
      throw appError('AUTH_DESKTOP_VERIFIER');
    }

    const refreshToken = randomBytes(32).toString('base64url');
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DesktopAuthSession);
      const locked = await repo.findOne({
        where: { id: found.id },
        lock: { mode: 'pessimistic_write' },
      });
      const again = inspectCode(toCodeCheck(locked), presented, Date.now());
      if (again !== 'ok' || !locked) {
        throw appError(codeError(again));
      }
      if (!pkceMatches(dto.codeVerifier, locked.codeChallenge)) {
        throw appError('AUTH_DESKTOP_VERIFIER');
      }
      locked.codeUsedAt = new Date();
      locked.refreshHash = sha256Hex(refreshToken);
      locked.previousRefreshHash = null;
      locked.refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
      await repo.save(locked);
    });

    return this.desktopCredentials(found.userId, refreshToken);
  }

  async refreshDesktop(dto: DesktopRefreshDto) {
    const presented = sha256Hex(dto.refreshToken);
    const found = await this.desktopSessions.findOne({
      where: [{ refreshHash: presented }, { previousRefreshHash: presented }],
    });
    const verdict = inspectRefresh(toRefreshCheck(found), presented, Date.now());
    if (verdict === 'reused' && found) {
      found.revokedAt = new Date();
      await this.desktopSessions.save(found);
    }
    if (verdict !== 'ok' || !found) {
      throw appError(refreshError(verdict));
    }

    const refreshToken = randomBytes(32).toString('base64url');
    const userId = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DesktopAuthSession);
      const locked = await repo.findOne({
        where: { id: found.id },
        lock: { mode: 'pessimistic_write' },
      });
      const again = inspectRefresh(toRefreshCheck(locked), presented, Date.now());
      if (again === 'reused' && locked) {
        locked.revokedAt = new Date();
        await repo.save(locked);
      }
      if (again !== 'ok' || !locked) {
        throw appError(refreshError(again));
      }
      locked.previousRefreshHash = locked.refreshHash;
      locked.refreshHash = sha256Hex(refreshToken);
      locked.refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
      await repo.save(locked);
      return locked.userId;
    });

    return this.desktopCredentials(userId, refreshToken);
  }

  async revokeDesktop(dto: DesktopRefreshDto): Promise<void> {
    if (!dto.refreshToken) {
      throw appError('AUTH_DESKTOP_REFRESH_INVALID');
    }
    const presented = sha256Hex(dto.refreshToken);
    const found = await this.desktopSessions.findOne({
      where: [{ refreshHash: presented }, { previousRefreshHash: presented }],
    });
    if (!found || found.revokedAt) return;
    found.revokedAt = new Date();
    await this.desktopSessions.save(found);
  }

  private async desktopCredentials(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw appError('AUTH_SESSION_USER_MISSING');
    }
    const session = await this.issueSession(user.id, user.username, user.isAdmin);
    return {
      accessToken: session.access_token,
      refreshToken,
      expiresAt: this.accessExpiresAt(),
      user: session.user,
    };
  }

  private accessExpiresAt(): string {
    const raw = this.configService.get<string>('JWT_EXPIRES_IN', '7d');
    const match = /^(\d+)([dhms])$/.exec(raw);
    let ms = 7 * 24 * 60 * 60 * 1000;
    if (match) {
      const n = Number(match[1]);
      const unit = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 }[match[2]] ?? 86_400_000;
      ms = n * unit;
    }
    return new Date(Date.now() + ms).toISOString();
  }

  private async issueSession(
    userId: string,
    username: string,
    isAdmin: boolean,
  ) {
    const payload = { sub: userId, username };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      user: {
        id: userId,
        username,
        isAdmin,
      },
    };
  }
}

function toCodeCheck(row: DesktopAuthSession | null) {
  if (!row) return null;
  return {
    codeHash: row.codeHash,
    codeExpiresAt: row.codeExpiresAt?.getTime() ?? null,
    codeUsedAt: row.codeUsedAt?.getTime() ?? null,
  };
}

function toRefreshCheck(row: DesktopAuthSession | null) {
  if (!row) return null;
  return {
    refreshHash: row.refreshHash,
    previousRefreshHash: row.previousRefreshHash,
    refreshExpiresAt: row.refreshExpiresAt?.getTime() ?? null,
    revokedAt: row.revokedAt?.getTime() ?? null,
  };
}

function codeError(verdict: string) {
  if (verdict === 'expired') return 'AUTH_DESKTOP_CODE_EXPIRED' as const;
  if (verdict === 'reused') return 'AUTH_DESKTOP_CODE_REUSED' as const;
  return 'AUTH_DESKTOP_CODE_INVALID' as const;
}

function refreshError(verdict: string) {
  if (verdict === 'expired') return 'AUTH_DESKTOP_REFRESH_EXPIRED' as const;
  if (verdict === 'reused') return 'AUTH_DESKTOP_REFRESH_REUSED' as const;
  if (verdict === 'revoked') return 'AUTH_DESKTOP_REVOKED' as const;
  return 'AUTH_DESKTOP_REFRESH_INVALID' as const;
}
