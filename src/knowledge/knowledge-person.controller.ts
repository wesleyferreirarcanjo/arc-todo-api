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

@Controller('organizations/:orgId/persons/:personId/knowledge')
@UseGuards(JwtAuthGuard)
export class PersonKnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  findAll(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.findAllPerson(req.user.id, orgId, personId);
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Body() dto: CreateKnowledgeDto,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.createPerson(
      req.user.id,
      orgId,
      personId,
      dto,
    );
  }

  @Get(':knowledgeId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.findOnePerson(
      req.user.id,
      orgId,
      personId,
      knowledgeId,
    );
  }

  @Patch(':knowledgeId')
  update(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Body() dto: UpdateKnowledgeDto,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.updatePerson(
      req.user.id,
      orgId,
      personId,
      knowledgeId,
      dto,
    );
  }

  @Delete(':knowledgeId')
  remove(
    @Param('orgId') orgId: string,
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.removePerson(
      req.user.id,
      orgId,
      personId,
      knowledgeId,
    );
  }
}
