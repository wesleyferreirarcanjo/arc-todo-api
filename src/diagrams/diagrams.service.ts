import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { CreateProjectDiagramDto } from './dto/create-project-diagram.dto';
import { UpdateProjectDiagramDto } from './dto/update-project-diagram.dto';
import { ProjectDiagram } from './project-diagram.entity';

export type ProjectDiagramSummary = Pick<
  ProjectDiagram,
  'id' | 'title' | 'thumbnail' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class DiagramsService {
  constructor(
    @InjectRepository(ProjectDiagram)
    private readonly diagramRepository: Repository<ProjectDiagram>,
    private readonly projectsService: ProjectsService,
  ) {}

  private requireTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new BadRequestException('Title is required');
    }
    return trimmed;
  }

  async findAll(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<ProjectDiagramSummary[]> {
    await this.projectsService.findOne(userId, orgId, projectId);
    return this.diagramRepository.find({
      where: { projectId },
      select: ['id', 'title', 'thumbnail', 'createdAt', 'updatedAt'],
      order: { updatedAt: 'DESC' },
    });
  }

  async create(
    userId: string,
    orgId: string,
    projectId: string,
    dto: CreateProjectDiagramDto,
  ): Promise<ProjectDiagram> {
    await this.projectsService.findOne(userId, orgId, projectId);

    const diagram = this.diagramRepository.create({
      projectId,
      title: this.requireTitle(dto.title),
      sceneJson: dto.sceneJson ?? {},
      thumbnail: dto.thumbnail ?? null,
      createdById: userId,
    });

    return this.diagramRepository.save(diagram);
  }

  async findOne(
    userId: string,
    orgId: string,
    projectId: string,
    diagramId: string,
  ): Promise<ProjectDiagram> {
    await this.projectsService.findOne(userId, orgId, projectId);

    const diagram = await this.diagramRepository.findOne({
      where: { id: diagramId, projectId },
    });
    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }
    return diagram;
  }

  async update(
    userId: string,
    orgId: string,
    projectId: string,
    diagramId: string,
    dto: UpdateProjectDiagramDto,
  ): Promise<ProjectDiagram> {
    const diagram = await this.findOne(userId, orgId, projectId, diagramId);

    if (dto.title !== undefined) {
      diagram.title = this.requireTitle(dto.title);
    }
    if (dto.sceneJson !== undefined) {
      diagram.sceneJson = dto.sceneJson;
    }
    if (dto.thumbnail !== undefined) {
      diagram.thumbnail = dto.thumbnail;
    }

    return this.diagramRepository.save(diagram);
  }

  async remove(
    userId: string,
    orgId: string,
    projectId: string,
    diagramId: string,
  ): Promise<void> {
    const diagram = await this.findOne(userId, orgId, projectId, diagramId);
    await this.diagramRepository.remove(diagram);
  }
}
