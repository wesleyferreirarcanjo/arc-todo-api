import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateNameSessionDto } from './dto/create-name-session.dto';
import {
  AddNameCandidatesDto,
  CheckNameDto,
  CheckNamesBatchDto,
  RecommendNameDto,
  StartFeedbackRoundDto,
  UpsertFeedbackResponseDto,
} from './dto/name-session-actions.dto';
import { UpdateNameSessionDto } from './dto/update-name-session.dto';
import { NameSessionsService } from './name-sessions.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('organizations/:orgId/projects/:projectId/name-sessions')
@UseGuards(JwtAuthGuard)
export class NameSessionsController {
  constructor(private readonly nameSessionsService: NameSessionsService) {}

  @Get()
  findAll(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.findAll(req.user.id, orgId, projectId);
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateNameSessionDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.create(req.user.id, orgId, projectId, dto);
  }

  @Get(':sessionId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.getView(
      req.user.id,
      orgId,
      projectId,
      sessionId,
    );
  }

  @Patch(':sessionId')
  update(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateNameSessionDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.update(
      req.user.id,
      orgId,
      projectId,
      sessionId,
      dto,
    );
  }

  @Delete(':sessionId')
  remove(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.remove(
      req.user.id,
      orgId,
      projectId,
      sessionId,
    );
  }

  @Post(':sessionId/check')
  check(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: CheckNameDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.check(
      req.user.id,
      orgId,
      projectId,
      sessionId,
      dto,
    );
  }

  @Post(':sessionId/check-batch')
  checkBatch(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: CheckNamesBatchDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.checkBatch(
      req.user.id,
      orgId,
      projectId,
      sessionId,
      dto,
    );
  }

  @Post(':sessionId/check-history')
  checkHistory(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: CheckNameDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.checkHistory(
      req.user.id,
      orgId,
      projectId,
      sessionId,
      dto,
    );
  }

  @Post(':sessionId/candidates')
  addCandidates(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: AddNameCandidatesDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.addCandidates(
      req.user.id,
      orgId,
      projectId,
      sessionId,
      dto,
    );
  }

  @Post(':sessionId/recommend')
  recommend(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: RecommendNameDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.recommend(
      req.user.id,
      orgId,
      projectId,
      sessionId,
      dto,
    );
  }

  @Post(':sessionId/feedback-rounds')
  startFeedbackRound(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: StartFeedbackRoundDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.startFeedbackRound(
      req.user.id,
      orgId,
      projectId,
      sessionId,
      dto,
    );
  }

  @Put(':sessionId/feedback-rounds/:roundId/responses')
  upsertFeedback(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Param('roundId') roundId: string,
    @Body() dto: UpsertFeedbackResponseDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.upsertFeedback(
      req.user.id,
      orgId,
      projectId,
      sessionId,
      roundId,
      dto,
    );
  }

  @Post(':sessionId/feedback-rounds/:roundId/close')
  closeFeedbackRound(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Param('roundId') roundId: string,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.closeFeedbackRound(
      req.user.id,
      orgId,
      projectId,
      sessionId,
      roundId,
    );
  }
}
