import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ensureUniqueProjectAcronym } from '../common/utils/acronym.util';
import { ProjectAccessService } from './project-access.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';

const DEFAULT_PROJECT_COLOR = '#737373';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async findAll(userId: string, orgId: string): Promise<Project[]> {
    await this.projectAccessService.assertOrgAccess(userId, orgId);
    const projects = await this.projectAccessService.listAccessibleProjects(
      userId,
      orgId,
    );
    return projects.filter((project) => project.organizationId === orgId);
  }

  async create(
    userId: string,
    orgId: string,
    dto: CreateProjectDto,
  ): Promise<Project> {
    await this.projectAccessService.assertAdmin(userId);

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
    const project = await this.projectAccessService.assertProjectAccess(
      userId,
      projectId,
    );

    if (project.organizationId !== orgId) {
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
    await this.projectAccessService.assertAdmin(userId);
    const project = await this.findOne(userId, orgId, projectId);

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.color !== undefined) project.color = dto.color;

    return this.projectsRepository.save(project);
  }

  async remove(userId: string, orgId: string, projectId: string): Promise<void> {
    await this.projectAccessService.assertAdmin(userId);
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
