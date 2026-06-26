import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { ProjectAccessService } from '../projects/project-access.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

export interface UserResponse {
  id: string;
  username: string;
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
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.seedAdminUser();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
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
      throw new ConflictException('Username already taken');
    }

    return this.dataSource.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const user = usersRepo.create({
        username: dto.username,
        passwordHash,
        isAdmin: dto.isAdmin ?? false,
      });
      const saved = await usersRepo.save(user);

      if (dto.projectIds?.length) {
        await this.projectAccessService.setProjectAssignments(
          saved.id,
          dto.projectIds,
        );
      }

      return this.toResponse(saved);
    });
  }

  async updateManagedUser(
    userId: string,
    dto: UpdateUserDto,
    actorId: string,
  ): Promise<UserResponse> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.isAdmin === false && user.id === actorId) {
      throw new BadRequestException('You cannot remove your own admin access');
    }

    if (dto.password !== undefined) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
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
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.remove(user);
  }

  private async toResponse(user: User): Promise<UserResponse> {
    const projectIds = user.isAdmin
      ? []
      : await this.projectAccessService.getProjectIdsForUser(user.id);

    return {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      projectIds,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private async seedAdminUser() {
    const username = this.configService.get<string>('ADMIN_USERNAME', 'admin');
    const password = this.configService.get<string>(
      'ADMIN_PASSWORD',
      'admin123',
    );

    const existing = await this.findByUsername(username);
    if (existing) {
      if (!existing.isAdmin) {
        existing.isAdmin = true;
        await this.usersRepository.save(existing);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      username,
      passwordHash,
      isAdmin: true,
    });
    await this.usersRepository.save(user);
    console.log(`Seeded admin user: ${username}`);
  }
}
