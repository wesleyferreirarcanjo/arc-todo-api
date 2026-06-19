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

@Controller('persons/:personId/knowledge')
@UseGuards(JwtAuthGuard)
export class GeneralPersonKnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  findAll(
    @Param('personId') personId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.findAllGeneralPerson(req.user.id, personId);
  }

  @Post()
  create(
    @Param('personId') personId: string,
    @Body() dto: CreateKnowledgeDto,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.createGeneralPerson(
      req.user.id,
      personId,
      dto,
    );
  }

  @Get(':knowledgeId')
  findOne(
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.findOneGeneralPerson(
      req.user.id,
      personId,
      knowledgeId,
    );
  }

  @Patch(':knowledgeId')
  update(
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Body() dto: UpdateKnowledgeDto,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.updateGeneralPerson(
      req.user.id,
      personId,
      knowledgeId,
      dto,
    );
  }

  @Delete(':knowledgeId')
  remove(
    @Param('personId') personId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Req() req: AuthRequest,
  ) {
    return this.knowledgeService.removeGeneralPerson(
      req.user.id,
      personId,
      knowledgeId,
    );
  }
}
