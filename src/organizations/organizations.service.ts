import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { ensureUniqueSlug, slugify } from '../common/utils/slug.util';
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationMember } from './organization-member.entity';
import { OrganizationRole } from './organization-role.enum';
import { Organization } from './organization.entity';

const DEFAULT_ORGANIZATION_COLOR = '#737373';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly membersRepository: Repository<OrganizationMember>,
    private readonly usersService: UsersService,
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

  async addMember(
    userId: string,
    orgId: string,
    dto: AddOrganizationMemberDto,
  ): Promise<OrganizationMember> {
    await this.assertAdmin(userId, orgId);

    const targetUser = await this.usersService.findByUsername(dto.username);
    if (!targetUser) {
      throw new NotFoundException('User not found');
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

    return this.membersRepository.save(membership);
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

    membership.role = role;
    return this.membersRepository.save(membership);
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

    await this.membersRepository.remove(membership);
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
