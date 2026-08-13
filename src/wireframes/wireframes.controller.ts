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
import { CreateProjectWireframeDto } from './dto/create-project-wireframe.dto';
import { UpdateProjectWireframeDto } from './dto/update-project-wireframe.dto';
import { WireframesService } from './wireframes.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects/:projectId/wireframes')
@UseGuards(JwtAuthGuard)
export class WireframesController {
  constructor(private readonly wireframesService: WireframesService) {}

  @Get()
  findAll(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.wireframesService.findAll(req.user.id, orgId, projectId);
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectWireframeDto,
    @Req() req: AuthRequest,
  ) {
    return this.wireframesService.create(req.user.id, orgId, projectId, dto);
  }

  @Get(':wireframeId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('wireframeId') wireframeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.wireframesService.findOne(
      req.user.id,
      orgId,
      projectId,
      wireframeId,
    );
  }

  @Patch(':wireframeId')
  update(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('wireframeId') wireframeId: string,
    @Body() dto: UpdateProjectWireframeDto,
    @Req() req: AuthRequest,
  ) {
    return this.wireframesService.update(
      req.user.id,
      orgId,
      projectId,
      wireframeId,
      dto,
    );
  }

  @Delete(':wireframeId')
  remove(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('wireframeId') wireframeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.wireframesService.remove(
      req.user.id,
      orgId,
      projectId,
      wireframeId,
    );
  }
}
