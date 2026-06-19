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
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { ListKnowledgeQueryDto } from './dto/list-knowledge-query.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { KnowledgeService } from './knowledge.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeGlobalController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  findAll(@Query() query: ListKnowledgeQueryDto, @Req() req: AuthRequest) {
    if (
      query.scope ||
      query.organizationId ||
      query.projectId ||
      query.personId
    ) {
      return this.knowledgeService.findAllForUser(req.user.id, query);
    }

    return this.knowledgeService.findAllGeneral(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateKnowledgeDto, @Req() req: AuthRequest) {
    return this.knowledgeService.createGeneral(req.user.id, dto);
  }

  @Get(':knowledgeId')
  findOne(
    @Param('knowledgeId') knowledgeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.findOneGeneral(req.user.id, knowledgeId);
  }

  @Patch(':knowledgeId')
  update(
    @Param('knowledgeId') knowledgeId: string,
    @Body() dto: UpdateKnowledgeDto,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.updateGeneral(req.user.id, knowledgeId, dto);
  }

  @Delete(':knowledgeId')
  remove(
    @Param('knowledgeId') knowledgeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.removeGeneral(req.user.id, knowledgeId);
  }
}
