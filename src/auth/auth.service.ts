import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
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
      throw new ForbiddenException(
        'Password login is disabled. Use Google SSO or a service access token.',
      );
    }

    const user = await this.usersService.findByUsername(dto.username);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueSession(user.id, user.username, user.isAdmin);
  }

  async loginWithGoogle(dto: GoogleSsoDto) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException('Google SSO is not configured');
    }

    let email: string;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.id_token,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) {
        throw new UnauthorizedException('Google token missing email');
      }
      if (payload.email_verified === false) {
        throw new UnauthorizedException('Google email is not verified');
      }
      email = payload.email;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid Google token');
    }

    const user = await this.usersService.findBySsoAssign(email);
    if (!user) {
      throw new UnauthorizedException(
        'No Arc Todo user is assigned to this Google account',
      );
    }

    return this.issueSession(user.id, user.username, user.isAdmin);
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    };
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
