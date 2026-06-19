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
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Param('orgId') orgId: string, @Req() req: AuthRequest) {
    return this.projectsService.findAll(req.user.id, orgId);
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateProjectDto,
    @Req() req: AuthRequest,
  ) {
    return this.projectsService.create(req.user.id, orgId, dto);
  }

  @Get(':projectId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.projectsService.findOne(req.user.id, orgId, projectId);
  }

  @Patch(':projectId')
  update(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: AuthRequest,
  ) {
    return this.projectsService.update(req.user.id, orgId, projectId, dto);
  }

  @Delete(':projectId')
  remove(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.projectsService.remove(req.user.id, orgId, projectId);
  }
}
