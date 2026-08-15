import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { ProjectAccessService } from '../projects/project-access.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

export interface UserResponse {
  id: string;
  username: string;
  ssoAssign: string | null;
  isAdmin: boolean;
  projectIds: string[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async onModuleInit() {
    await this.seedAdminUser();
  }

  isSsoOnly(): boolean {
    return this.configService.get<string>('AUTH_SSO_ONLY', 'false') === 'true';
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findBySsoAssign(email: string): Promise<User | null> {
    const normalized = this.normalizeSsoAssign(email);
    if (!normalized) return null;
    return this.usersRepository
      .createQueryBuilder('user')
      .where('LOWER(user.sso_assign) = :email', { email: normalized })
      .getOne();
  }

  async findAllWithProjects(): Promise<UserResponse[]> {
    const users = await this.usersRepository.find({
      order: { username: 'ASC' },
    });
    const responses = await Promise.all(
      users.map(async (user) => this.toResponse(user)),
    );
    return responses;
  }

  async createManagedUser(dto: CreateUserDto): Promise<UserResponse> {
    const existing = await this.findByUsername(dto.username);
    if (existing) {
      throw appError('USER_USERNAME_TAKEN');
    }

    const ssoOnly = this.isSsoOnly();
    if (!dto.password && !ssoOnly) {
      throw appError('USER_PASSWORD_REQUIRED');
    }

    const ssoAssign = this.normalizeSsoAssign(dto.ssoAssign);
    if (ssoAssign) {
      await this.assertSsoAssignAvailable(ssoAssign);
    }

    const passwordHash = await this.hashPasswordOrUnusable(dto.password);
    const user = this.usersRepository.create({
      username: dto.username,
      passwordHash,
      ssoAssign,
      isAdmin: dto.isAdmin ?? false,
    });
    const saved = await this.usersRepository.save(user);

    if (dto.projectIds?.length) {
      await this.projectAccessService.setProjectAssignments(
        saved.id,
        dto.projectIds,
      );
    }

    return this.toResponse(saved);
  }

  async updateManagedUser(
    userId: string,
    dto: UpdateUserDto,
    actorId: string,
  ): Promise<UserResponse> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw appError('USER_NOT_FOUND');
    }

    if (dto.isAdmin === false && user.id === actorId) {
      throw appError('USER_SELF_ADMIN');
    }

    if (dto.password !== undefined && dto.password !== null && dto.password !== '') {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.ssoAssign !== undefined) {
      const ssoAssign = this.normalizeSsoAssign(dto.ssoAssign);
      if (ssoAssign) {
        await this.assertSsoAssignAvailable(ssoAssign, user.id);
      }
      user.ssoAssign = ssoAssign;
    }

    if (dto.isAdmin !== undefined) {
      user.isAdmin = dto.isAdmin;
    }

    const saved = await this.usersRepository.save(user);

    if (dto.projectIds !== undefined) {
      await this.projectAccessService.setProjectAssignments(
        saved.id,
        dto.projectIds,
      );
    }

    return this.toResponse(saved);
  }

  async removeManagedUser(userId: string, actorId: string): Promise<void> {
    if (userId === actorId) {
      throw appError('USER_SELF_DELETE');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw appError('USER_NOT_FOUND');
    }

    await this.usersRepository.remove(user);
  }

  private normalizeSsoAssign(
    value: string | null | undefined,
  ): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async assertSsoAssignAvailable(
    ssoAssign: string,
    excludeUserId?: string,
  ): Promise<void> {
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .where('LOWER(user.sso_assign) = :email', { email: ssoAssign });
    if (excludeUserId) {
      qb.andWhere('user.id != :excludeUserId', { excludeUserId });
    }
    const existing = await qb.getOne();
    if (existing) {
      throw appError('USER_SSO_TAKEN');
    }
  }

  private async hashPasswordOrUnusable(
    password: string | undefined,
  ): Promise<string> {
    if (password && password.length > 0) {
      return bcrypt.hash(password, 10);
    }
    // ponytail: unusable hash when SSO-only and no password; ceiling = cannot password-login; upgrade = nullable password_hash
    return bcrypt.hash(randomBytes(32).toString('hex'), 10);
  }

  private async toResponse(user: User): Promise<UserResponse> {
    const projectIds = user.isAdmin
      ? []
      : await this.projectAccessService.getProjectIdsForUser(user.id);

    return {
      id: user.id,
      username: user.username,
      ssoAssign: user.ssoAssign,
      isAdmin: user.isAdmin,
      projectIds,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private async seedAdminUser() {
    const username = this.configService.get<string>('ADMIN_USERNAME', 'admin');
    const password = this.configService.get<string>('ADMIN_PASSWORD');
    const adminSso = this.normalizeSsoAssign(
      this.configService.get<string>('ADMIN_SSO_ASSIGN'),
    );
    if (!password) {
      throw new Error(
        'ADMIN_PASSWORD must be set to seed the admin user (do not commit the real value)',
      );
    }

    const existing = await this.findByUsername(username);
    if (existing) {
      let dirty = false;
      if (!existing.isAdmin) {
        existing.isAdmin = true;
        dirty = true;
      }
      if (adminSso && !existing.ssoAssign) {
        await this.assertSsoAssignAvailable(adminSso, existing.id);
        existing.ssoAssign = adminSso;
        dirty = true;
      }
      if (dirty) {
        await this.usersRepository.save(existing);
      }
      return;
    }

    // Avoid duplicate SSO if another user already holds ADMIN_SSO_ASSIGN
    if (adminSso) {
      const taken = await this.findBySsoAssign(adminSso);
      if (taken) {
        if (!taken.isAdmin) {
          taken.isAdmin = true;
          await this.usersRepository.save(taken);
        }
        return;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      username,
      passwordHash,
      ssoAssign: adminSso,
      isAdmin: true,
    });
    await this.usersRepository.save(user);
    console.log(`Seeded admin user: ${username}`);
  }
}
