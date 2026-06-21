import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ensureUniqueProjectAcronym } from '../common/utils/acronym.util';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';

const DEFAULT_PROJECT_COLOR = '#737373';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async findAll(userId: string, orgId: string): Promise<Project[]> {
    await this.organizationsService.assertMember(userId, orgId);
    return this.projectsRepository.find({
      where: { organizationId: orgId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    userId: string,
    orgId: string,
    dto: CreateProjectDto,
  ): Promise<Project> {
    await this.organizationsService.assertAdmin(userId, orgId);

    const acronym = await ensureUniqueProjectAcronym(dto.name, async (candidate) => {
      const existing = await this.projectsRepository.findOne({
        where: { acronym: candidate },
      });
      return existing !== null;
    });

    const project = this.projectsRepository.create({
      organizationId: orgId,
      name: dto.name,
      description: dto.description ?? null,
      color: dto.color ?? DEFAULT_PROJECT_COLOR,
      acronym,
      nextTaskNumber: 1,
    });

    return this.projectsRepository.save(project);
  }

  async findOne(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<Project> {
    await this.organizationsService.assertMember(userId, orgId);

    const project = await this.projectsRepository.findOne({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(
    userId: string,
    orgId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    await this.organizationsService.assertAdmin(userId, orgId);
    const project = await this.findOne(userId, orgId, projectId);

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.color !== undefined) project.color = dto.color;

    return this.projectsRepository.save(project);
  }

  async remove(userId: string, orgId: string, projectId: string): Promise<void> {
    await this.organizationsService.assertAdmin(userId, orgId);
    const project = await this.findOne(userId, orgId, projectId);
    await this.projectsRepository.remove(project);
  }

  async findByAcronym(acronym: string): Promise<Project | null> {
    return this.projectsRepository.findOne({
      where: { acronym: acronym.toLowerCase() },
      relations: { organization: true },
    });
  }

  async findAcronymsByIds(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }
    const projects = await this.projectsRepository.find({
      where: { id: In(ids) },
      select: ['id', 'acronym'],
    });
    return new Map(projects.map((project) => [project.id, project.acronym]));
  }
}
