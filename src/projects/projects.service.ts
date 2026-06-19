import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';

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

    const project = this.projectsRepository.create({
      organizationId: orgId,
      name: dto.name,
      description: dto.description ?? null,
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

    return this.projectsRepository.save(project);
  }

  async remove(userId: string, orgId: string, projectId: string): Promise<void> {
    await this.organizationsService.assertAdmin(userId, orgId);
    const project = await this.findOne(userId, orgId, projectId);
    await this.projectsRepository.remove(project);
  }
}
