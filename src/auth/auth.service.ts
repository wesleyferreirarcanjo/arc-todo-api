import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, username: user.username };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
      },
    };
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
}
