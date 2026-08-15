import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { ProjectsService } from '../projects/projects.service';
import { ProjectWireframe } from '../wireframes/project-wireframe.entity';
import { CreateProjectDiagramDto } from './dto/create-project-diagram.dto';
import { UpdateProjectDiagramDto } from './dto/update-project-diagram.dto';
import { ProjectDiagram } from './project-diagram.entity';

export type ProjectDiagramSummary = Pick<
  ProjectDiagram,
  'id' | 'title' | 'thumbnail' | 'wireframeId' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class DiagramsService {
  constructor(
    @InjectRepository(ProjectDiagram)
    private readonly diagramRepository: Repository<ProjectDiagram>,
    @InjectRepository(ProjectWireframe)
    private readonly wireframeRepository: Repository<ProjectWireframe>,
    private readonly projectsService: ProjectsService,
  ) {}

  private requireTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) {
      throw appError('DIAG_TITLE_REQUIRED');
    }
    return trimmed;
  }

  async findAll(
    userId: string,
    orgId: string,
    projectId: string,
    wireframeId?: string,
  ): Promise<ProjectDiagramSummary[]> {
    await this.projectsService.findOne(userId, orgId, projectId);
    return this.diagramRepository.find({
      where: wireframeId ? { projectId, wireframeId } : { projectId },
      select: [
        'id',
        'title',
        'thumbnail',
        'wireframeId',
        'createdAt',
        'updatedAt',
      ],
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

    let wireframeId: string | null = null;
    if (dto.wireframeId) {
      const wireframe = await this.wireframeRepository.findOne({
        where: { id: dto.wireframeId, projectId },
        select: ['id'],
      });
      if (!wireframe) {
        throw appError('DIAG_WIREFRAME_MISSING');
      }
      wireframeId = wireframe.id;
    }

    const diagram = this.diagramRepository.create({
      projectId,
      wireframeId,
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
      throw appError('DIAG_NOT_FOUND');
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
