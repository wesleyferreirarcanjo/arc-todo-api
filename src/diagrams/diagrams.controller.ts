import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DiagramsService } from './diagrams.service';
import { CreateProjectDiagramDto } from './dto/create-project-diagram.dto';
import { ListProjectDiagramsQueryDto } from './dto/list-project-diagrams-query.dto';
import { UpdateProjectDiagramDto } from './dto/update-project-diagram.dto';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects/:projectId/diagrams')
@UseGuards(JwtAuthGuard)
export class DiagramsController {
  constructor(private readonly diagramsService: DiagramsService) {}

  @Get()
  findAll(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Query() query: ListProjectDiagramsQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.diagramsService.findAll(
      req.user.id,
      orgId,
      projectId,
      query.wireframeId,
    );
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectDiagramDto,
    @Req() req: AuthRequest,
  ) {
    return this.diagramsService.create(req.user.id, orgId, projectId, dto);
  }

  @Get(':diagramId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('diagramId') diagramId: string,
    @Req() req: AuthRequest,
  ) {
    return this.diagramsService.findOne(
      req.user.id,
      orgId,
      projectId,
      diagramId,
    );
  }

  @Patch(':diagramId')
  update(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('diagramId') diagramId: string,
    @Body() dto: UpdateProjectDiagramDto,
    @Req() req: AuthRequest,
  ) {
    return this.diagramsService.update(
      req.user.id,
      orgId,
      projectId,
      diagramId,
      dto,
    );
  }

  @Delete(':diagramId')
  remove(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('diagramId') diagramId: string,
    @Req() req: AuthRequest,
  ) {
    return this.diagramsService.remove(
      req.user.id,
      orgId,
      projectId,
      diagramId,
    );
  }
}
