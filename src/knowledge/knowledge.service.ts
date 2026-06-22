import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { OrganizationsService } from '../organizations/organizations.service';
import { PersonsService } from '../persons/persons.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { ListKnowledgeQueryDto } from './dto/list-knowledge-query.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { KnowledgeEntry } from './knowledge-entry.entity';
import { KnowledgeScope } from './knowledge-scope.enum';
import { KnowledgeAttachmentService } from './knowledge-attachment.service';
import { RagClientService, KnowledgeIndexMetadata } from '../rag-settings/rag-client.service';

export interface KnowledgeEntryResponse {
  id: string;
  scope: KnowledgeScope;
  title: string;
  content: string;
  createdById: string;
  organizationId: string | null;
  projectId: string | null;
  personId: string | null;
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  project?: {
    id: string;
    name: string;
    organizationId: string;
    color: string;
  } | null;
  person?: {
    id: string;
    name: string;
    organizationId: string | null;
  } | null;
}

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectRepository(KnowledgeEntry)
    private readonly knowledgeRepository: Repository<KnowledgeEntry>,
    private readonly organizationsService: OrganizationsService,
    private readonly projectsService: ProjectsService,
    private readonly personsService: PersonsService,
    @Inject(forwardRef(() => KnowledgeAttachmentService))
    private readonly attachmentService: KnowledgeAttachmentService,
    private readonly ragClientService: RagClientService,
  ) {}

  async findAllGeneral(userId: string): Promise<KnowledgeEntry[]> {
    return this.knowledgeRepository.find({
      where: { scope: KnowledgeScope.GENERAL, createdById: userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findAllForUser(
    userId: string,
    query: ListKnowledgeQueryDto,
  ): Promise<KnowledgeEntryResponse[]> {
    const qb = this.knowledgeRepository
      .createQueryBuilder('knowledge')
      .leftJoinAndSelect('knowledge.organization', 'organization')
      .leftJoinAndSelect('knowledge.project', 'project')
      .leftJoinAndSelect('knowledge.person', 'person')
      .where(
        new Brackets((where) => {
          where
            .where(
              'knowledge.scope = :generalScope AND knowledge.createdById = :userId',
              { generalScope: KnowledgeScope.GENERAL, userId },
            )
            .orWhere(
              `knowledge.scope = :personScope AND knowledge.organizationId IS NULL AND knowledge.createdById = :userId`,
              { personScope: KnowledgeScope.PERSON, userId },
            )
            .orWhere(
              `knowledge.scope IN (:...orgScopes) AND knowledge.organizationId IN (
                SELECT om.organization_id FROM organization_members om WHERE om.user_id = :userId
              )`,
              {
                orgScopes: [
                  KnowledgeScope.ORGANIZATION,
                  KnowledgeScope.PROJECT,
                  KnowledgeScope.PERSON,
                ],
                userId,
              },
            );
        }),
      );

    if (query.scope) {
      qb.andWhere('knowledge.scope = :scope', { scope: query.scope });
    }

    if (query.organizationId) {
      qb.andWhere('knowledge.organizationId = :organizationId', {
        organizationId: query.organizationId,
      });
    }

    if (query.projectId) {
      qb.andWhere('knowledge.projectId = :projectId', {
        projectId: query.projectId,
      });
    }

    if (query.personId) {
      qb.andWhere('knowledge.personId = :personId', {
        personId: query.personId,
      });
    }

    const hasAttachmentFilters =
      query.fileName?.trim() ||
      query.mimeType?.trim() ||
      query.hasAttachments === true;

    if (hasAttachmentFilters) {
      qb.innerJoin('knowledge.attachments', 'attachment').distinct(true);
    }

    if (query.fileName?.trim()) {
      qb.andWhere('attachment.originalFilename ILIKE :fileName', {
        fileName: `%${query.fileName.trim()}%`,
      });
    }

    if (query.mimeType?.trim()) {
      qb.andWhere('attachment.mimeType ILIKE :mimeType', {
        mimeType: `%${query.mimeType.trim()}%`,
      });
    }

    if (query.hasAttachments === true) {
      qb.andWhere('attachment.id IS NOT NULL');
    }

    qb.orderBy('knowledge.updatedAt', 'DESC');

    const entries = await qb.getMany();
    return entries.map((entry) => this.toResponse(entry));
  }

  async findAllOrganization(
    userId: string,
    orgId: string,
  ): Promise<KnowledgeEntry[]> {
    await this.organizationsService.assertMember(userId, orgId);
    return this.knowledgeRepository.find({
      where: { scope: KnowledgeScope.ORGANIZATION, organizationId: orgId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findAllProject(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<KnowledgeEntry[]> {
    await this.projectsService.findOne(userId, orgId, projectId);
    return this.knowledgeRepository.find({
      where: { scope: KnowledgeScope.PROJECT, projectId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findAllPerson(
    userId: string,
    orgId: string,
    personId: string,
  ): Promise<KnowledgeEntry[]> {
    await this.personsService.findOne(userId, orgId, personId);
    return this.knowledgeRepository.find({
      where: { scope: KnowledgeScope.PERSON, personId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findAllGeneralPerson(
    userId: string,
    personId: string,
  ): Promise<KnowledgeEntry[]> {
    await this.personsService.findOneGeneral(userId, personId);
    return this.knowledgeRepository.find({
      where: {
        scope: KnowledgeScope.PERSON,
        personId,
        organizationId: IsNull(),
        createdById: userId,
      },
      order: { updatedAt: 'DESC' },
    });
  }

  async createGeneral(
    userId: string,
    dto: CreateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    const entry = this.knowledgeRepository.create({
      scope: KnowledgeScope.GENERAL,
      title: dto.title,
      content: dto.content,
      createdById: userId,
      organizationId: null,
      projectId: null,
      personId: null,
    });

    return this.saveAndIndexEntry(entry);
  }

  async createOrganization(
    userId: string,
    orgId: string,
    dto: CreateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    await this.organizationsService.assertMember(userId, orgId);

    const entry = this.knowledgeRepository.create({
      scope: KnowledgeScope.ORGANIZATION,
      title: dto.title,
      content: dto.content,
      createdById: userId,
      organizationId: orgId,
      projectId: null,
      personId: null,
    });

    return this.saveAndIndexEntry(entry);
  }

  async createProject(
    userId: string,
    orgId: string,
    projectId: string,
    dto: CreateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    await this.projectsService.findOne(userId, orgId, projectId);

    const entry = this.knowledgeRepository.create({
      scope: KnowledgeScope.PROJECT,
      title: dto.title,
      content: dto.content,
      createdById: userId,
      organizationId: orgId,
      projectId,
      personId: null,
    });

    return this.saveAndIndexEntry(entry);
  }

  async createPerson(
    userId: string,
    orgId: string,
    personId: string,
    dto: CreateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    await this.personsService.findOne(userId, orgId, personId);

    const entry = this.knowledgeRepository.create({
      scope: KnowledgeScope.PERSON,
      title: dto.title,
      content: dto.content,
      createdById: userId,
      organizationId: orgId,
      projectId: null,
      personId,
    });

    return this.saveAndIndexEntry(entry);
  }

  async createGeneralPerson(
    userId: string,
    personId: string,
    dto: CreateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    await this.personsService.findOneGeneral(userId, personId);

    const entry = this.knowledgeRepository.create({
      scope: KnowledgeScope.PERSON,
      title: dto.title,
      content: dto.content,
      createdById: userId,
      organizationId: null,
      projectId: null,
      personId,
    });

    return this.saveAndIndexEntry(entry);
  }

  async findOneGeneral(
    userId: string,
    knowledgeId: string,
  ): Promise<KnowledgeEntry> {
    const entry = await this.knowledgeRepository.findOne({
      where: { id: knowledgeId, scope: KnowledgeScope.GENERAL },
    });
    if (!entry) {
      throw new NotFoundException('Knowledge entry not found');
    }
    if (entry.createdById !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return entry;
  }

  async findOneOrganization(
    userId: string,
    orgId: string,
    knowledgeId: string,
  ): Promise<KnowledgeEntry> {
    await this.organizationsService.assertMember(userId, orgId);

    const entry = await this.knowledgeRepository.findOne({
      where: {
        id: knowledgeId,
        scope: KnowledgeScope.ORGANIZATION,
        organizationId: orgId,
      },
    });
    if (!entry) {
      throw new NotFoundException('Knowledge entry not found');
    }
    return entry;
  }

  async findOneProject(
    userId: string,
    orgId: string,
    projectId: string,
    knowledgeId: string,
  ): Promise<KnowledgeEntry> {
    await this.projectsService.findOne(userId, orgId, projectId);

    const entry = await this.knowledgeRepository.findOne({
      where: {
        id: knowledgeId,
        scope: KnowledgeScope.PROJECT,
        projectId,
      },
    });
    if (!entry) {
      throw new NotFoundException('Knowledge entry not found');
    }
    return entry;
  }

  async findOnePerson(
    userId: string,
    orgId: string,
    personId: string,
    knowledgeId: string,
  ): Promise<KnowledgeEntry> {
    await this.personsService.findOne(userId, orgId, personId);

    const entry = await this.knowledgeRepository.findOne({
      where: {
        id: knowledgeId,
        scope: KnowledgeScope.PERSON,
        personId,
      },
    });
    if (!entry) {
      throw new NotFoundException('Knowledge entry not found');
    }
    return entry;
  }

  async findOneGeneralPerson(
    userId: string,
    personId: string,
    knowledgeId: string,
  ): Promise<KnowledgeEntry> {
    await this.personsService.findOneGeneral(userId, personId);

    const entry = await this.knowledgeRepository.findOne({
      where: {
        id: knowledgeId,
        scope: KnowledgeScope.PERSON,
        personId,
        organizationId: IsNull(),
        createdById: userId,
      },
    });
    if (!entry) {
      throw new NotFoundException('Knowledge entry not found');
    }
    return entry;
  }

  async updateGeneral(
    userId: string,
    knowledgeId: string,
    dto: UpdateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    const entry = await this.findOneGeneral(userId, knowledgeId);
    return this.applyUpdate(entry, dto);
  }

  async updateOrganization(
    userId: string,
    orgId: string,
    knowledgeId: string,
    dto: UpdateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    const entry = await this.findOneOrganization(userId, orgId, knowledgeId);
    return this.applyUpdate(entry, dto);
  }

  async updateProject(
    userId: string,
    orgId: string,
    projectId: string,
    knowledgeId: string,
    dto: UpdateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    const entry = await this.findOneProject(
      userId,
      orgId,
      projectId,
      knowledgeId,
    );
    return this.applyUpdate(entry, dto);
  }

  async updatePerson(
    userId: string,
    orgId: string,
    personId: string,
    knowledgeId: string,
    dto: UpdateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    const entry = await this.findOnePerson(userId, orgId, personId, knowledgeId);
    return this.applyUpdate(entry, dto);
  }

  async updateGeneralPerson(
    userId: string,
    personId: string,
    knowledgeId: string,
    dto: UpdateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    const entry = await this.findOneGeneralPerson(
      userId,
      personId,
      knowledgeId,
    );
    return this.applyUpdate(entry, dto);
  }

  async removeGeneral(userId: string, knowledgeId: string): Promise<void> {
    const entry = await this.findOneGeneral(userId, knowledgeId);
    await this.attachmentService.cleanupForKnowledgeEntry(entry.id);
    await this.knowledgeRepository.remove(entry);
  }

  async removeOrganization(
    userId: string,
    orgId: string,
    knowledgeId: string,
  ): Promise<void> {
    const entry = await this.findOneOrganization(userId, orgId, knowledgeId);
    await this.attachmentService.cleanupForKnowledgeEntry(entry.id);
    await this.knowledgeRepository.remove(entry);
  }

  async removeProject(
    userId: string,
    orgId: string,
    projectId: string,
    knowledgeId: string,
  ): Promise<void> {
    const entry = await this.findOneProject(
      userId,
      orgId,
      projectId,
      knowledgeId,
    );
    await this.attachmentService.cleanupForKnowledgeEntry(entry.id);
    await this.knowledgeRepository.remove(entry);
  }

  async removePerson(
    userId: string,
    orgId: string,
    personId: string,
    knowledgeId: string,
  ): Promise<void> {
    const entry = await this.findOnePerson(userId, orgId, personId, knowledgeId);
    await this.attachmentService.cleanupForKnowledgeEntry(entry.id);
    await this.knowledgeRepository.remove(entry);
  }

  async removeGeneralPerson(
    userId: string,
    personId: string,
    knowledgeId: string,
  ): Promise<void> {
    const entry = await this.findOneGeneralPerson(
      userId,
      personId,
      knowledgeId,
    );
    await this.attachmentService.cleanupForKnowledgeEntry(entry.id);
    await this.knowledgeRepository.remove(entry);
  }

  async getEntryIndexMetadata(
    userId: string,
    knowledgeId: string,
  ): Promise<KnowledgeIndexMetadata> {
    await this.findAccessibleEntry(userId, knowledgeId);
    return this.ragClientService.getEntryIndexMetadata(knowledgeId);
  }

  private async findAccessibleEntry(
    userId: string,
    knowledgeId: string,
  ): Promise<KnowledgeEntry> {
    const entry = await this.knowledgeRepository
      .createQueryBuilder('knowledge')
      .where('knowledge.id = :knowledgeId', { knowledgeId })
      .andWhere(
        new Brackets((where) => {
          where
            .where(
              'knowledge.scope = :generalScope AND knowledge.createdById = :userId',
              { generalScope: KnowledgeScope.GENERAL, userId },
            )
            .orWhere(
              `knowledge.scope = :personScope AND knowledge.organizationId IS NULL AND knowledge.createdById = :userId`,
              { personScope: KnowledgeScope.PERSON, userId },
            )
            .orWhere(
              `knowledge.scope IN (:...orgScopes) AND knowledge.organizationId IN (
                SELECT om.organization_id FROM organization_members om WHERE om.user_id = :userId
              )`,
              {
                orgScopes: [
                  KnowledgeScope.ORGANIZATION,
                  KnowledgeScope.PROJECT,
                  KnowledgeScope.PERSON,
                ],
                userId,
              },
            );
        }),
      )
      .getOne();

    if (!entry) {
      throw new NotFoundException('Knowledge entry not found');
    }

    return entry;
  }

  private async applyUpdate(
    entry: KnowledgeEntry,
    dto: UpdateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    if (dto.title !== undefined) entry.title = dto.title;
    if (dto.content !== undefined) entry.content = dto.content;
    const saved = await this.knowledgeRepository.save(entry);
    await this.ragClientService.enqueueEntryIndex(saved.id);
    return saved;
  }

  private async saveAndIndexEntry(entry: KnowledgeEntry): Promise<KnowledgeEntry> {
    const saved = await this.knowledgeRepository.save(entry);
    await this.ragClientService.enqueueEntryIndex(saved.id);
    return saved;
  }

  private toResponse(entry: KnowledgeEntry): KnowledgeEntryResponse {
    return {
      id: entry.id,
      scope: entry.scope,
      title: entry.title,
      content: entry.content,
      createdById: entry.createdById,
      organizationId: entry.organizationId,
      projectId: entry.projectId,
      personId: entry.personId,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      organization: entry.organization
        ? {
            id: entry.organization.id,
            name: entry.organization.name,
            slug: entry.organization.slug,
          }
        : null,
      project: entry.project
        ? {
            id: entry.project.id,
            name: entry.project.name,
            organizationId: entry.project.organizationId,
            color: entry.project.color,
          }
        : null,
      person: entry.person
        ? {
            id: entry.person.id,
            name: entry.person.name,
            organizationId: entry.person.organizationId,
          }
        : null,
    };
  }
}
