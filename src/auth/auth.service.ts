import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { appError } from '../errors/app-errors';
import { UsersService } from '../users/users.service';
import { GoogleSsoDto } from './dto/google-sso.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
