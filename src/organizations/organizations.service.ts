import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { ensureUniqueSlug, slugify } from '../common/utils/slug.util';
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationMember } from './organization-member.entity';
import { OrganizationRole } from './organization-role.enum';
import { Organization } from './organization.entity';
import { UserActivityAction } from '../user-activity/user-activity-action.enum';
import { UserActivityService } from '../user-activity/user-activity.service';

const DEFAULT_ORGANIZATION_COLOR = '#737373';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly membersRepository: Repository<OrganizationMember>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
    private readonly userActivityService: UserActivityService,
  ) {}

  async findForUser(userId: string): Promise<Organization[]> {
    const memberships = await this.membersRepository.find({
      where: { userId },
      relations: ['organization'],
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => membership.organization);
  }

  async create(userId: string, dto: CreateOrganizationDto): Promise<Organization> {
    const baseSlug = slugify(dto.slug ?? dto.name);
    const slug = await ensureUniqueSlug(baseSlug, async (candidate) => {
      const existing = await this.organizationsRepository.findOne({
        where: { slug: candidate },
      });
      return existing !== null;
    });

    const organization = this.organizationsRepository.create({
      name: dto.name,
      slug,
      color: dto.color ?? DEFAULT_ORGANIZATION_COLOR,
    });
    const saved = await this.organizationsRepository.save(organization);

    const membership = this.membersRepository.create({
      organizationId: saved.id,
      userId,
      role: OrganizationRole.OWNER,
    });
    await this.membersRepository.save(membership);

    return saved;
  }

  async findOneForMember(userId: string, orgId: string): Promise<Organization> {
    await this.assertMember(userId, orgId);
    const organization = await this.organizationsRepository.findOne({
      where: { id: orgId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async update(
    userId: string,
    orgId: string,
    dto: UpdateOrganizationDto,
  ): Promise<Organization> {
    await this.assertAdmin(userId, orgId);
    const organization = await this.findOneForMember(userId, orgId);

    if (dto.name !== undefined) {
      organization.name = dto.name;
    }

    if (dto.slug !== undefined) {
      const existing = await this.organizationsRepository.findOne({
        where: { slug: dto.slug },
      });
      if (existing && existing.id !== orgId) {
        throw new ConflictException('Slug already in use');
      }
      organization.slug = dto.slug;
    }

    if (dto.color !== undefined) {
      organization.color = dto.color;
    }

    return this.organizationsRepository.save(organization);
  }

  async remove(userId: string, orgId: string): Promise<void> {
    await this.assertOwner(userId, orgId);
    const organization = await this.findOneForMember(userId, orgId);
    await this.organizationsRepository.remove(organization);
  }

  async listMembers(
    userId: string,
    orgId: string,
  ): Promise<OrganizationMember[]> {
    await this.assertMember(userId, orgId);
    return this.membersRepository.find({
      where: { organizationId: orgId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async getCurrentMembership(
    userId: string,
    orgId: string,
  ): Promise<{ role: OrganizationRole }> {
    const membership = await this.assertMember(userId, orgId);
    return { role: membership.role };
  }

  async createUserAndMember(
    actorId: string,
    orgId: string,
    dto: CreateOrganizationUserDto,
  ): Promise<OrganizationMember> {
    await this.assertAdmin(actorId, orgId);
    await this.findOneForMember(actorId, orgId);

    const role = dto.role ?? OrganizationRole.MEMBER;
    if (role === OrganizationRole.OWNER) {
      await this.assertOwner(actorId, orgId);
    }

    return this.dataSource.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const membersRepo = manager.getRepository(OrganizationMember);

      const existingUser = await usersRepo.findOne({
        where: { username: dto.username },
      });
      if (existingUser) {
        throw new ConflictException('Username already taken');
      }

      const passwordHash = await bcrypt.hash(dto.password, 10);
      const user = usersRepo.create({
        username: dto.username,
        passwordHash,
      });
      const savedUser = await usersRepo.save(user);

      const membership = membersRepo.create({
        organizationId: orgId,
        userId: savedUser.id,
        role,
      });
      const saved = await membersRepo.save(membership);
      const result = await membersRepo.findOneOrFail({
        where: { id: saved.id },
        relations: ['user'],
      });

      this.userActivityService.record({
        organizationId: orgId,
        actorUserId: actorId,
        action: UserActivityAction.USER_CREATED,
        entityType: 'user',
        entityId: savedUser.id,
        summary: `Created user "${savedUser.username}" as ${role}`,
        metadata: { username: savedUser.username, role },
      });

      return result;
    });
  }

  async addMember(
    userId: string,
    orgId: string,
    dto: AddOrganizationMemberDto,
  ): Promise<OrganizationMember> {
    await this.assertAdmin(userId, orgId);

    const targetUser = await this.usersService.findByUsername(dto.username);
    if (!targetUser) {
      throw new NotFoundException(
        'User not found. Create the account first via POST /organizations/:orgId/users',
      );
    }

    const existing = await this.membersRepository.findOne({
      where: { organizationId: orgId, userId: targetUser.id },
    });
    if (existing) {
      throw new ConflictException('User is already a member');
    }

    const membership = this.membersRepository.create({
      organizationId: orgId,
      userId: targetUser.id,
      role: dto.role ?? OrganizationRole.MEMBER,
    });

    const saved = await this.membersRepository.save(membership);

    this.userActivityService.record({
      organizationId: orgId,
      actorUserId: userId,
      action: UserActivityAction.MEMBER_ADDED,
      entityType: 'member',
      entityId: targetUser.id,
      summary: `Added member "${targetUser.username}" as ${saved.role}`,
      metadata: { username: targetUser.username, role: saved.role },
    });

    return saved;
  }

  async updateMemberRole(
    userId: string,
    orgId: string,
    targetUserId: string,
    role: OrganizationRole,
  ): Promise<OrganizationMember> {
    await this.assertOwner(userId, orgId);

    const membership = await this.membersRepository.findOne({
      where: { organizationId: orgId, userId: targetUserId },
    });
    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    if (membership.role === OrganizationRole.OWNER && role !== OrganizationRole.OWNER) {
      const ownerCount = await this.membersRepository.count({
        where: { organizationId: orgId, role: OrganizationRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException('Organization must have at least one owner');
      }
    }

    const previousRole = membership.role;
    membership.role = role;
    const saved = await this.membersRepository.save(membership);

    const targetUser = await this.usersService.findById(targetUserId);
    this.userActivityService.record({
      organizationId: orgId,
      actorUserId: userId,
      action: UserActivityAction.MEMBER_ROLE_CHANGED,
      entityType: 'member',
      entityId: targetUserId,
      summary: `Changed role for "${targetUser?.username ?? targetUserId}" from ${previousRole} to ${role}`,
      metadata: {
        username: targetUser?.username,
        previousRole,
        role,
      },
    });

    return saved;
  }

  async removeMember(
    userId: string,
    orgId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.assertAdmin(userId, orgId);

    const membership = await this.membersRepository.findOne({
      where: { organizationId: orgId, userId: targetUserId },
    });
    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    if (membership.role === OrganizationRole.OWNER) {
      const ownerCount = await this.membersRepository.count({
        where: { organizationId: orgId, role: OrganizationRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException('Cannot remove the last owner');
      }
    }

    const targetUser = await this.usersService.findById(targetUserId);
    await this.membersRepository.remove(membership);

    this.userActivityService.record({
      organizationId: orgId,
      actorUserId: userId,
      action: UserActivityAction.MEMBER_REMOVED,
      entityType: 'member',
      entityId: targetUserId,
      summary: `Removed member "${targetUser?.username ?? targetUserId}"`,
      metadata: { username: targetUser?.username, role: membership.role },
    });
  }

  async assertMember(userId: string, orgId: string): Promise<OrganizationMember> {
    const membership = await this.membersRepository.findOne({
      where: { organizationId: orgId, userId },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied');
    }
    return membership;
  }

  async assertAdmin(userId: string, orgId: string): Promise<OrganizationMember> {
    const membership = await this.assertMember(userId, orgId);
    if (
      membership.role !== OrganizationRole.ADMIN &&
      membership.role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException('Admin access required');
    }
    return membership;
  }

  async assertOwner(userId: string, orgId: string): Promise<OrganizationMember> {
    const membership = await this.assertMember(userId, orgId);
    if (membership.role !== OrganizationRole.OWNER) {
      throw new ForbiddenException('Owner access required');
    }
    return membership;
  }
}
