import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
  CrownBatchWinnerDto,
  RecommendNameDto,
  SetBatchFinalistsDto,
  SetCandidateFavoriteDto,
  SetCandidateReactionDto,
  StartBatchDto,
  StartFeedbackRoundDto,
  UpsertCandidateRatingDto,
  UpsertFeedbackResponseDto,
} from './dto/name-session-actions.dto';
import { UpdateNameSessionDto } from './dto/update-name-session.dto';
import { NameSessionsService } from './name-sessions.service';

interface AuthRequest extends Request {
  user: { id: string; username: string };
}

@Controller('name-sessions')
@UseGuards(JwtAuthGuard)
export class NameSessionsController {
  constructor(private readonly nameSessionsService: NameSessionsService) {}

  @Get()
  findAll() {
    return this.nameSessionsService.findAll();
  }

  @Post()
  create(
    @Body() dto: CreateNameSessionDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.create(req.user.id, dto);
  }

  @Get(':sessionId')
  findOne(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.getView(
      req.user.id,
      sessionId,
    );
  }

  @Patch(':sessionId')
  update(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateNameSessionDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.update(
      req.user.id,
      sessionId,
      dto,
    );
  }

  @Delete(':sessionId')
  remove(@Param('sessionId') sessionId: string) {
    return this.nameSessionsService.remove(sessionId);
  }

  @Post(':sessionId/check')
  check(
    @Param('sessionId') sessionId: string,
    @Body() dto: CheckNameDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.check(
      req.user.id,
      sessionId,
      dto,
    );
  }

  @Post(':sessionId/check-batch')
  checkBatch(
    @Param('sessionId') sessionId: string,
    @Body() dto: CheckNamesBatchDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.checkBatch(
      req.user.id,
      sessionId,
      dto,
    );
  }

  @Post(':sessionId/check-handles')
  checkHandles(
    @Param('sessionId') sessionId: string,
    @Body() dto: CheckNameDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.checkHandles(
      req.user.id,
      sessionId,
      dto,
    );
  }

  @Post(':sessionId/check-history')
  checkHistory(
    @Param('sessionId') sessionId: string,
    @Body() dto: CheckNameDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.checkHistory(
      req.user.id,
      sessionId,
      dto,
    );
  }

  @Post(':sessionId/candidates')
  addCandidates(
    @Param('sessionId') sessionId: string,
    @Body() dto: AddNameCandidatesDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.addCandidates(
      req.user.id,
      sessionId,
      dto,
    );
  }

  @Put(':sessionId/candidates/:candidateId/rating')
  upsertCandidateRating(
    @Param('sessionId') sessionId: string,
    @Param('candidateId') candidateId: string,
    @Body() dto: UpsertCandidateRatingDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.upsertCandidateRating(
      req.user.id,
      sessionId,
      candidateId,
      dto,
    );
  }

  @Put(':sessionId/candidates/:candidateId/reaction')
  setCandidateReaction(
    @Param('sessionId') sessionId: string,
    @Param('candidateId') candidateId: string,
    @Body() dto: SetCandidateReactionDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.setCandidateReaction(
      req.user.id,
      sessionId,
      candidateId,
      dto,
    );
  }

  @Put(':sessionId/candidates/:candidateId/favorite')
  setCandidateFavorite(
    @Param('sessionId') sessionId: string,
    @Param('candidateId') candidateId: string,
    @Body() dto: SetCandidateFavoriteDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.setCandidateFavorite(
      req.user.id,
      sessionId,
      candidateId,
      dto,
    );
  }

  @Post(':sessionId/batches')
  startBatch(
    @Param('sessionId') sessionId: string,
    @Body() dto: StartBatchDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.startBatch(
      req.user.id,
      sessionId,
      dto,
    );
  }

  @Post(':sessionId/batches/:batchNumber/winner')
  crownBatchWinner(
    @Param('sessionId') sessionId: string,
    @Param('batchNumber', ParseIntPipe) batchNumber: number,
    @Body() dto: CrownBatchWinnerDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.crownBatchWinner(
      req.user.id,
      sessionId,
      batchNumber,
      dto,
    );
  }

  @Post(':sessionId/batches/:batchNumber/finalists')
  setBatchFinalists(
    @Param('sessionId') sessionId: string,
    @Param('batchNumber', ParseIntPipe) batchNumber: number,
    @Body() dto: SetBatchFinalistsDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.setBatchFinalists(
      req.user.id,
      sessionId,
      batchNumber,
      dto,
    );
  }

  @Post(':sessionId/recommend')
  recommend(
    @Param('sessionId') sessionId: string,
    @Body() dto: RecommendNameDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.recommend(
      req.user.id,
      sessionId,
      dto,
    );
  }

  @Post(':sessionId/feedback-rounds')
  startFeedbackRound(
    @Param('sessionId') sessionId: string,
    @Body() dto: StartFeedbackRoundDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.startFeedbackRound(
      req.user.id,
      sessionId,
      dto,
    );
  }

  @Put(':sessionId/feedback-rounds/:roundId/responses')
  upsertFeedback(
    @Param('sessionId') sessionId: string,
    @Param('roundId') roundId: string,
    @Body() dto: UpsertFeedbackResponseDto,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.upsertFeedback(
      req.user.id,
      sessionId,
      roundId,
      dto,
    );
  }

  @Post(':sessionId/feedback-rounds/:roundId/close')
  closeFeedbackRound(
    @Param('sessionId') sessionId: string,
    @Param('roundId') roundId: string,
    @Req() req: AuthRequest,
  ) {
    return this.nameSessionsService.closeFeedbackRound(
      req.user.id,
      sessionId,
      roundId,
    );
  }
}
