import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { ProjectsService } from '../projects/projects.service';
import {
  DEFAULT_WIREFRAME_HTML,
  assertWireframeHtml,
} from './default-wireframe-html';
import { CreateProjectWireframeDto } from './dto/create-project-wireframe.dto';
import { UpdateProjectWireframeDto } from './dto/update-project-wireframe.dto';
import { ProjectWireframe } from './project-wireframe.entity';

export type ProjectWireframeSummary = Pick<
  ProjectWireframe,
  'id' | 'title' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class WireframesService {
  constructor(
    @InjectRepository(ProjectWireframe)
    private readonly wireframeRepository: Repository<ProjectWireframe>,
    private readonly projectsService: ProjectsService,
  ) {}

  private requireTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) {
      throw appError('WIRE_TITLE_REQUIRED');
    }
    return trimmed;
  }

  private requireHtml(html: string): string {
    try {
      return assertWireframeHtml(html);
    } catch (err) {
      throw appError('WIRE_INVALID_HTML');
    }
  }

  async findAll(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<ProjectWireframeSummary[]> {
    await this.projectsService.findOne(userId, orgId, projectId);
    return this.wireframeRepository.find({
      where: { projectId },
      select: ['id', 'title', 'createdAt', 'updatedAt'],
      order: { updatedAt: 'DESC' },
    });
  }

  async create(
    userId: string,
    orgId: string,
    projectId: string,
    dto: CreateProjectWireframeDto,
  ): Promise<ProjectWireframe> {
    await this.projectsService.findOne(userId, orgId, projectId);

    const html =
      dto.html === undefined
        ? DEFAULT_WIREFRAME_HTML
        : this.requireHtml(dto.html);

    const wireframe = this.wireframeRepository.create({
      projectId,
      title: this.requireTitle(dto.title),
      html,
      createdById: userId,
    });

    return this.wireframeRepository.save(wireframe);
  }

  async findOne(
    userId: string,
    orgId: string,
    projectId: string,
    wireframeId: string,
  ): Promise<ProjectWireframe> {
    await this.projectsService.findOne(userId, orgId, projectId);

    const wireframe = await this.wireframeRepository.findOne({
      where: { id: wireframeId, projectId },
    });
    if (!wireframe) {
      throw appError('WIRE_NOT_FOUND');
    }
    return wireframe;
  }

  async update(
    userId: string,
    orgId: string,
    projectId: string,
    wireframeId: string,
    dto: UpdateProjectWireframeDto,
  ): Promise<ProjectWireframe> {
    const wireframe = await this.findOne(userId, orgId, projectId, wireframeId);

    if (dto.title !== undefined) {
      wireframe.title = this.requireTitle(dto.title);
    }
    if (dto.html !== undefined) {
      wireframe.html = this.requireHtml(dto.html);
    }

    return this.wireframeRepository.save(wireframe);
  }

  async remove(
    userId: string,
    orgId: string,
    projectId: string,
    wireframeId: string,
  ): Promise<void> {
    const wireframe = await this.findOne(userId, orgId, projectId, wireframeId);
    await this.wireframeRepository.remove(wireframe);
  }
}
