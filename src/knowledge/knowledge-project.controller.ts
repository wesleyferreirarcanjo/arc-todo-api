import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { KnowledgeService } from './knowledge.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects/:projectId/knowledge')
@UseGuards(JwtAuthGuard)
export class ProjectKnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  findAll(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.findAllProject(
      req.user.id,
      orgId,
      projectId,
    );
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateKnowledgeDto,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.createProject(
      req.user.id,
      orgId,
      projectId,
      dto,
    );
  }

  @Get(':knowledgeId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.findOneProject(
      req.user.id,
      orgId,
      projectId,
      knowledgeId,
    );
  }

  @Patch(':knowledgeId')
  update(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Body() dto: UpdateKnowledgeDto,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.updateProject(
      req.user.id,
      orgId,
      projectId,
      knowledgeId,
      dto,
    );
  }

  @Delete(':knowledgeId')
  remove(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.removeProject(
      req.user.id,
      orgId,
      projectId,
      knowledgeId,
    );
  }
}
