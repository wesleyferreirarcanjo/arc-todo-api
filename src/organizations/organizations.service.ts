import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ensureUniqueSlug, slugify } from '../common/utils/slug.util';
import { ProjectAccessService } from '../projects/project-access.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Organization } from './organization.entity';

const DEFAULT_ORGANIZATION_COLOR = '#737373';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async findForUser(userId: string): Promise<Organization[]> {
    return this.projectAccessService.listAccessibleOrganizations(userId);
  }

  async create(userId: string, dto: CreateOrganizationDto): Promise<Organization> {
    await this.projectAccessService.assertAdmin(userId);

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

    return this.organizationsRepository.save(organization);
  }

  async findOneForMember(userId: string, orgId: string): Promise<Organization> {
    await this.projectAccessService.assertOrgAccess(userId, orgId);
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
    await this.projectAccessService.assertAdmin(userId);
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
    await this.projectAccessService.assertAdmin(userId);
    const organization = await this.findOneForMember(userId, orgId);
    await this.organizationsRepository.remove(organization);
  }

  async assertOrgAccess(userId: string, orgId: string): Promise<void> {
    await this.projectAccessService.assertOrgAccess(userId, orgId);
  }

  /** @deprecated Organization membership is no longer used for access control */
  async assertMember(userId: string, orgId: string): Promise<void> {
    await this.assertOrgAccess(userId, orgId);
  }
}
