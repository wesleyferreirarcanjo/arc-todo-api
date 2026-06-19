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

@Controller('organizations/:orgId/knowledge')
@UseGuards(JwtAuthGuard)
export class OrganizationKnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  findAll(@Param('orgId') orgId: string, @Req() req: AuthRequest) {
    return this.knowledgeService.findAllOrganization(req.user.id, orgId);
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateKnowledgeDto,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.createOrganization(req.user.id, orgId, dto);
  }

  @Get(':knowledgeId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.findOneOrganization(
      req.user.id,
      orgId,
      knowledgeId,
    );
  }

  @Patch(':knowledgeId')
  update(
    @Param('orgId') orgId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Body() dto: UpdateKnowledgeDto,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.updateOrganization(
      req.user.id,
      orgId,
      knowledgeId,
      dto,
    );
  }

  @Delete(':knowledgeId')
  remove(
    @Param('orgId') orgId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.removeOrganization(
      req.user.id,
      orgId,
      knowledgeId,
    );
  }
}
