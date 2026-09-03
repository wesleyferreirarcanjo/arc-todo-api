import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { ProjectAccessService } from '../projects/project-access.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateNameSessionDto } from './dto/create-name-session.dto';
import {
  AddNameCandidatesDto,
  CheckNameDto,
  CheckNamesBatchDto,
  CrownBatchWinnerDto,
  RecommendNameDto,
  SetBatchFinalistsDto,
  SetCandidateReactionDto,
  StartBatchDto,
  StartFeedbackRoundDto,
  UpsertCandidateRatingDto,
  UpsertFeedbackResponseDto,
} from './dto/name-session-actions.dto';
import { UpdateNameSessionDto } from './dto/update-name-session.dto';
import {
  asBatches,
  batchValidationAppError,
  canCrown,
  decideBatch,
  hasOpenBatch,
  stampOpenBatch,
  validateNewBatch,
} from './name-batch.util';
import { NameCandidateFeedback } from './name-candidate-feedback.entity';
import { NameCheckService } from './name-check.service';
import {
  CandidateSource,
  DEFAULT_NAMING_GOAL,
  googleQueryUrl,
  isNamingGoal,
  normalizeNameKey,
} from './name-check.util';
import {
  shapeCheckEvidence,
  shapeDomainEvidence,
  shapeOrganicCompetition,
} from './name-evidence.util';
import {
  asRounds,
  ballotGapMessage,
  ballotGaps,
  finalistAppError,
  isBelowTopPick,
  patchFeedbackRow,
  redactCandidate,
  shapeSessionDecision,
  validateFinalists,
  winnerReactionPoints,
} from './name-feedback.util';
import { NameHistoryService } from './name-history.service';
import { NameOrganicService } from './name-organic.service';
import {
  existingAutocomplete,
  withoutWaveHandles,
} from './name-organic.util';
import {
  asUserRatings,
  mergeIncomingCandidates,
  projectMyRating,
  upsertUserRating,
} from './name-user-rating.util';
import { ProjectNameSession } from './project-name-session.entity';

const CHECK_BATCH_CONCURRENCY = 4;

export type ProjectNameSessionSummary = {
  id: string;
  title: string;
  namingGoal: string | null;
  recommendedName: string | null;
  candidateCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type CandidateRecord = Record<string, unknown> & {
  id: string;
  name: string;
};

@Injectable()
export class NameSessionsService {
  constructor(
    @InjectRepository(ProjectNameSession)
    private readonly sessionRepository: Repository<ProjectNameSession>,
    @InjectRepository(NameCandidateFeedback)
    private readonly feedbackRepository: Repository<NameCandidateFeedback>,
    private readonly projectsService: ProjectsService,
    private readonly projectAccess: ProjectAccessService,
    private readonly nameCheckService: NameCheckService,
    private readonly nameHistoryService: NameHistoryService,
    private readonly nameOrganicService: NameOrganicService,
  ) {}

  private requireTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) {
      throw appError('NAME_TITLE_REQUIRED');
    }
    return trimmed;
  }

  private asCandidates(value: unknown): CandidateRecord[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is CandidateRecord =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as CandidateRecord).id === 'string' &&
        typeof (item as CandidateRecord).name === 'string',
    );
  }

  private recommendedName(session: ProjectNameSession): string | null {
    if (!session.recommendedCandidateId) return null;
    const match = this.asCandidates(session.candidates).find(
      (candidate) => candidate.id === session.recommendedCandidateId,
    );
    return match?.name ?? null;
  }

  async findAll(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<ProjectNameSessionSummary[]> {
    await this.projectsService.findOne(userId, orgId, projectId);
    const rows = await this.sessionRepository.find({
      where: { projectId },
      select: [
        'id',
        'title',
        'namingGoal',
        'candidates',
        'recommendedCandidateId',
        'createdAt',
        'updatedAt',
      ],
      order: { updatedAt: 'DESC' },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      namingGoal: row.namingGoal,
      recommendedName: this.recommendedName(row),
      candidateCount: this.asCandidates(row.candidates).length,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async create(
    userId: string,
    orgId: string,
    projectId: string,
    dto: CreateNameSessionDto,
  ): Promise<ProjectNameSession> {
    await this.projectsService.findOne(userId, orgId, projectId);
    let namingGoal = DEFAULT_NAMING_GOAL;
    if (dto.namingGoal) {
      if (!isNamingGoal(dto.namingGoal)) {
        throw appError('NAME_INVALID_GOAL');
      }
      namingGoal = dto.namingGoal;
    }
    const session = this.sessionRepository.create({
      projectId,
      title: this.requireTitle(dto.title),
      brief: dto.brief?.trim() ?? '',
      namingGoal,
      productDescription: dto.productDescription ?? {},
      lanes: [],
      candidates: [],
      shortlistIds: [],
      recommendedCandidateId: null,
      runnerUpCandidateId: null,
      decisionNote: null,
      feedbackRounds: [],
      createdById: userId,
    });
    return this.sessionRepository.save(session);
  }

  async findOne(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
  ): Promise<ProjectNameSession> {
    await this.projectsService.findOne(userId, orgId, projectId);
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, projectId },
    });
    if (!session) {
      throw appError('NAME_SESSION_NOT_FOUND');
    }
    return session;
  }

  async getView(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    return this.toView(session, userId);
  }

  async update(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    dto: UpdateNameSessionDto,
  ): Promise<unknown> {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    if (dto.title !== undefined) {
      session.title = this.requireTitle(dto.title);
    }
    if (dto.brief !== undefined) {
      session.brief = dto.brief;
    }
    if (dto.namingGoal !== undefined) {
      if (dto.namingGoal === null || dto.namingGoal === '') {
        session.namingGoal = null;
      } else if (!isNamingGoal(dto.namingGoal)) {
        throw appError('NAME_INVALID_GOAL');
      } else {
        session.namingGoal = dto.namingGoal;
      }
    }
    if (dto.productDescription !== undefined) {
      session.productDescription = dto.productDescription;
    }
    if (dto.lanes !== undefined) {
      session.lanes = dto.lanes;
    }
    if (dto.candidates !== undefined) {
      session.candidates = mergeIncomingCandidates(
        this.asCandidates(session.candidates),
        dto.candidates,
        userId,
        () => randomUUID(),
        new Date().toISOString(),
      );
    }
    if (dto.shortlistIds !== undefined) {
      session.shortlistIds = dto.shortlistIds.slice(0, 5);
    }
    if (dto.runnerUpCandidateId !== undefined) {
      session.runnerUpCandidateId = dto.runnerUpCandidateId;
    }
    if (dto.decisionNote !== undefined) {
      session.decisionNote = dto.decisionNote;
    }
    const saved = await this.sessionRepository.save(session);
    return this.toView(saved, userId);
  }

  async remove(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
  ): Promise<void> {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    await this.sessionRepository.remove(session);
  }

  async check(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    dto: CheckNameDto,
    source: CandidateSource = 'human',
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    const name = dto.name.trim();
    if (!name) {
      throw appError('NAME_REQUIRED');
    }
    const evidence = await this.collectCheckEvidence(name);
    const candidate = this.upsertCandidate(session, {
      name,
      source,
      domainChecks: evidence.domainChecks,
      domainHistory: evidence.domainHistory,
      takenEndingCount: evidence.takenEndingCount,
      comIncumbency: evidence.comIncumbency,
      organicCompetition: evidence.organicCompetition,
      googleQueryUrl: googleQueryUrl(name),
    });
    await this.sessionRepository.save(session);
    return this.exposeCandidate(
      withoutWaveHandles(session.shortlistIds, candidate),
      userId,
    );
  }

  async checkBatch(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    dto: CheckNamesBatchDto,
    source: CandidateSource = 'human',
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    const names = [
      ...new Set(
        dto.names
          .map((name) => name.trim())
          .filter(Boolean),
      ),
    ].slice(0, 20);
    if (!names.length) {
      throw appError('NAME_REQUIRED');
    }
    const evidenceByName = await this.mapPool(
      names,
      CHECK_BATCH_CONCURRENCY,
      async (name) => ({ name, evidence: await this.collectCheckEvidence(name) }),
    );
    const candidates = evidenceByName.map(({ name, evidence }) =>
      this.upsertCandidate(session, {
        name,
        source,
        domainChecks: evidence.domainChecks,
        domainHistory: evidence.domainHistory,
        takenEndingCount: evidence.takenEndingCount,
        comIncumbency: evidence.comIncumbency,
        organicCompetition: evidence.organicCompetition,
        googleQueryUrl: googleQueryUrl(name),
      }),
    );
    await this.sessionRepository.save(session);
    return {
      candidates: candidates.map((candidate) =>
        this.exposeCandidate(
          withoutWaveHandles(session.shortlistIds, candidate),
          userId,
        ),
      ),
    };
  }

  async checkHistory(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    dto: CheckNameDto,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    const name = dto.name.trim();
    const candidates = this.asCandidates(session.candidates);
    const existing = candidates.find(
      (item) => normalizeNameKey(item.name) === normalizeNameKey(name),
    );
    if (!existing) {
      throw appError('NAME_CHECK_FIRST');
    }
    const domainChecks = Array.isArray(existing.domainChecks)
      ? (existing.domainChecks as Array<{
          host?: string;
          tld?: string;
          availability?: string;
        }>)
      : [];
    const hosts = domainChecks
      .filter(
        (check) =>
          check.availability === 'available' || check.availability === 'unknown',
      )
      .map((check) => check.host)
      .filter((host): host is string => typeof host === 'string');
    if (hosts.length === 0) {
      hosts.push(
        ...domainChecks
          .map((check) => check.host)
          .filter((host): host is string => typeof host === 'string')
          .slice(0, 1),
      );
    }
    const domainHistory = await this.nameHistoryService.checkHistory(hosts);
    existing.domainHistory = domainHistory;
    existing.organicCompetition = shapeOrganicCompetition(
      domainChecks,
      domainHistory,
      existingAutocomplete(existing.organicCompetition),
    );
    session.candidates = candidates;
    await this.sessionRepository.save(session);
    return this.exposeCandidate(
      withoutWaveHandles(session.shortlistIds, existing),
      userId,
    );
  }

  async checkHandles(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    dto: CheckNameDto,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    const name = dto.name.trim();
    const candidates = this.asCandidates(session.candidates);
    const existing = candidates.find(
      (item) => normalizeNameKey(item.name) === normalizeNameKey(name),
    );
    if (!existing) {
      throw appError('NAME_CANDIDATE_NOT_FOUND');
    }
    const shortlistIds = Array.isArray(session.shortlistIds)
      ? session.shortlistIds
      : [];
    if (!shortlistIds.includes(existing.id)) {
      throw appError('NAME_HANDLES_NOT_KEPT');
    }
    existing.handleChecks = await this.nameOrganicService.probeHandles(
      existing.name,
    );
    session.candidates = candidates;
    await this.sessionRepository.save(session);
    return this.exposeCandidate(existing, userId);
  }

  async addCandidates(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    dto: AddNameCandidatesDto,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    const source = dto.source ?? 'human';
    const added: CandidateRecord[] = [];
    for (const item of dto.candidates) {
      added.push(
        this.upsertCandidate(session, {
          name: item.name,
          source,
          family: item.family,
          laneId: item.laneId,
          rationale: item.rationale,
        }),
      );
    }
    await this.sessionRepository.save(session);
    return {
      candidates: added.map((candidate) =>
        this.exposeCandidate(candidate, userId),
      ),
    };
  }

  async upsertCandidateRating(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    candidateId: string,
    dto: UpsertCandidateRatingDto,
  ) {
    return this.patchUserRating(userId, orgId, projectId, sessionId, candidateId, {
      ...(dto.overall !== undefined ? { overall: dto.overall } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });
  }

  async setCandidateReaction(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    candidateId: string,
    dto: SetCandidateReactionDto,
  ) {
    return this.patchUserRating(userId, orgId, projectId, sessionId, candidateId, {
      reaction: dto.reaction,
    });
  }

  private async patchUserRating(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    candidateId: string,
    patch: { overall?: number; notes?: string; reaction?: 'passed' | 'liked' | 'loved' | null },
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    const candidates = this.asCandidates(session.candidates);
    const target = candidates.find((item) => item.id === candidateId);
    if (!target) {
      throw appError('NAME_CANDIDATE_NOT_FOUND');
    }
    target.userRatings = upsertUserRating(
      asUserRatings(target.userRatings),
      userId,
      patch,
      new Date().toISOString(),
    );
    session.candidates = candidates;
    const saved = await this.sessionRepository.save(session);
    return this.toView(saved, userId);
  }

  async startBatch(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    dto: StartBatchDto,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    await this.assertCanManageFeedback(userId, session);
    const batches = asBatches(session.batches);
    if (hasOpenBatch(batches)) {
      throw appError('NAME_BATCH_OPEN');
    }
    const candidates = this.asCandidates(session.candidates);
    const parsed = validateNewBatch(
      dto.candidateIds,
      candidates,
      session.recommendedCandidateId,
    );
    if (!parsed.ok) {
      throw appError(batchValidationAppError(parsed.error));
    }
    stampOpenBatch(
      candidates,
      batches,
      parsed,
      new Date().toISOString(),
    );
    session.candidates = candidates;
    session.batches = batches;
    const saved = await this.sessionRepository.save(session);
    return this.toView(saved, userId);
  }

  async crownBatchWinner(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    batchNumber: number,
    dto: CrownBatchWinnerDto,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    await this.assertCanManageFeedback(userId, session);
    const batches = asBatches(session.batches);
    const batch = batches.find((item) => item.number === batchNumber);
    if (!batch) {
      throw appError('NAME_BATCH_NOT_FOUND');
    }
    const crown = canCrown(batch, batches);
    if (!crown.ok) {
      throw appError(
        crown.error === 'decided' ? 'NAME_BATCH_DECIDED' : 'NAME_BATCH_OPEN',
      );
    }
    if (!batch.candidateIds.includes(dto.candidateId)) {
      throw appError('NAME_BATCH_WINNER');
    }
    await this.assertWinnerReason(
      session,
      dto.candidateId,
      dto.decisionNote,
      batch.candidateIds,
    );
    const now = new Date().toISOString();
    decideBatch(batch, dto.candidateId, dto.decisionNote, now);
    session.batches = batches;
    this.applyRecommend(session, dto);
    const saved = await this.sessionRepository.save(session);
    return this.toView(saved, userId);
  }

  async recommend(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    dto: RecommendNameDto,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    await this.assertWinnerReason(
      session,
      dto.candidateId,
      dto.decisionNote,
    );
    this.applyRecommend(session, dto);
    const saved = await this.sessionRepository.save(session);
    return this.toView(saved, userId);
  }

  private applyRecommend(
    session: ProjectNameSession,
    dto: RecommendNameDto | CrownBatchWinnerDto,
  ) {
    const candidates = this.asCandidates(session.candidates);
    const target = candidates.find((item) => item.id === dto.candidateId);
    if (!target) {
      throw appError('NAME_CANDIDATE_NOT_FOUND');
    }
    for (const candidate of candidates) {
      if (candidate.id === dto.candidateId) {
        candidate.status = 'recommended';
      } else if (candidate.status === 'recommended') {
        candidate.status = 'active';
      }
    }
    session.candidates = candidates;
    session.recommendedCandidateId = dto.candidateId;
    if (dto.decisionNote !== undefined) {
      session.decisionNote = dto.decisionNote;
    }
  }

  private async assertWinnerReason(
    session: ProjectNameSession,
    candidateId: string,
    decisionNote: string | undefined,
    scopeIds?: string[],
  ) {
    const candidates = this.asCandidates(session.candidates);
    const batches = asBatches(session.batches);
    const batch =
      batches.find((item) => item.candidateIds.includes(candidateId)) ??
      null;
    const ids =
      scopeIds ??
      batch?.candidateIds ??
      candidates.map((candidate) => candidate.id);
    const rows = await this.feedbackRepository.find({
      where: { sessionId: session.id },
    });
    const points = winnerReactionPoints(rows, candidates, ids);
    if (isBelowTopPick(candidateId, ids, points, decisionNote)) {
      throw appError('NAME_BELOW_TOP');
    }
  }

  async setBatchFinalists(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    batchNumber: number,
    dto: SetBatchFinalistsDto,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    await this.assertCanManageFeedback(userId, session);
    const batches = asBatches(session.batches);
    const batch = batches.find((item) => item.number === batchNumber);
    if (!batch) {
      throw appError('NAME_BATCH_NOT_FOUND');
    }
    const roundOpen = asRounds(session.feedbackRounds).some(
      (round) => round.status === 'open',
    );
    const parsed = validateFinalists(
      dto.candidateIds,
      batch.candidateIds,
      roundOpen,
    );
    if (!parsed.ok) {
      throw appError(finalistAppError(parsed.error));
    }
    batch.finalistCandidateIds = parsed.ids;
    session.batches = batches;
    const saved = await this.sessionRepository.save(session);
    return this.toView(saved, userId);
  }

  async startFeedbackRound(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    dto: StartFeedbackRoundDto,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    await this.assertCanManageFeedback(userId, session);
    const ids = [...new Set(dto.candidateIds)];
    if (ids.length < 2 || ids.length > 5) {
      throw appError('NAME_ROUND_SIZE');
    }
    const candidates = this.asCandidates(session.candidates);
    for (const id of ids) {
      if (!candidates.some((item) => item.id === id)) {
        throw appError('NAME_ROUND_UNKNOWN');
      }
    }
    const rounds = asRounds(session.feedbackRounds);
    if (rounds.some((round) => round.status === 'open')) {
      throw appError('NAME_ROUND_OPEN');
    }
    rounds.push({
      id: randomUUID(),
      candidateIds: ids,
      status: 'open',
      createdAt: new Date().toISOString(),
      closedAt: null,
    });
    session.feedbackRounds = rounds;
    const saved = await this.sessionRepository.save(session);
    return this.toView(saved, userId);
  }

  async upsertFeedback(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    roundId: string,
    dto: UpsertFeedbackResponseDto,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    const round = asRounds(session.feedbackRounds).find(
      (item) => item.id === roundId,
    );
    if (!round) {
      throw appError('NAME_ROUND_NOT_FOUND');
    }
    if (round.status !== 'open') {
      throw appError('NAME_ROUND_CLOSED');
    }
    const entries = dto.responses?.length
      ? dto.responses
      : dto.candidateId
        ? [dto]
        : [];
    if (!entries.length || !entries[0].candidateId) {
      throw appError('NAME_CANDIDATE_NOT_IN_ROUND');
    }
    if (dto.responses?.length) {
      const gaps = ballotGaps(round.candidateIds, dto.responses);
      if (gaps.missingReactions.length || gaps.missingDepth.length) {
        throw appError('NAME_BALLOT_INCOMPLETE', ballotGapMessage(gaps), {
          missingReactions: gaps.missingReactions,
          missingDepth: gaps.missingDepth,
        });
      }
    }
    for (const entry of entries) {
      if (!entry.candidateId || !round.candidateIds.includes(entry.candidateId)) {
        throw appError('NAME_CANDIDATE_NOT_IN_ROUND');
      }
      let row = await this.feedbackRepository.findOne({
        where: { roundId, candidateId: entry.candidateId, userId },
      });
      if (!row) {
        row = this.feedbackRepository.create({
          sessionId: session.id,
          roundId,
          candidateId: entry.candidateId,
          userId,
        });
      }
      patchFeedbackRow(row, entry);
      await this.feedbackRepository.save(row);
    }
    return this.toView(session, userId);
  }

  async closeFeedbackRound(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    roundId: string,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
    await this.assertCanManageFeedback(userId, session);
    const rounds = asRounds(session.feedbackRounds);
    const round = rounds.find((item) => item.id === roundId);
    if (!round) {
      throw appError('NAME_ROUND_NOT_FOUND');
    }
    round.status = 'closed';
    round.closedAt = new Date().toISOString();
    session.feedbackRounds = rounds;
    const saved = await this.sessionRepository.save(session);
    return this.toView(saved, userId);
  }

  private async assertCanManageFeedback(
    userId: string,
    session: ProjectNameSession,
  ) {
    if (session.createdById === userId) return;
    if (await this.projectAccess.isAdmin(userId)) return;
    throw appError('ACL_NAME_FEEDBACK');
  }

  private exposeCandidate(candidate: CandidateRecord, userId: string) {
    return projectMyRating(candidate, userId);
  }

  private async collectDomainEvidence(name: string) {
    const domainChecks = await this.nameCheckService.checkName(name);
    const comCheck = domainChecks.find((check) => check.tld === 'com');
    if (!comCheck || comCheck.availability !== 'taken') {
      return shapeDomainEvidence({ domainChecks });
    }
    const [domainHistory, parking] = await Promise.all([
      this.nameHistoryService.checkHistory([comCheck.host]),
      this.nameHistoryService.probeParking(comCheck.host),
    ]);
    return shapeDomainEvidence({ domainChecks, domainHistory, parking });
  }

  private async collectCheckEvidence(name: string) {
    const [domain, autocomplete] = await Promise.all([
      this.collectDomainEvidence(name),
      this.nameOrganicService.lookupAutocomplete(name),
    ]);
    return shapeCheckEvidence(domain, autocomplete);
  }

  private async mapPool<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<R>,
  ): Promise<R[]> {
    if (!items.length) return [];
    const results = new Array<R>(items.length);
    let next = 0;
    const run = async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await worker(items[index]);
      }
    };
    const runners = Array.from(
      { length: Math.min(concurrency, items.length) },
      () => run(),
    );
    await Promise.all(runners);
    return results;
  }

  private upsertCandidate(
    session: ProjectNameSession,
    input: {
      name: string;
      source: CandidateSource;
      family?: string;
      laneId?: string;
      rationale?: string;
      domainChecks?: unknown;
      domainHistory?: unknown;
      takenEndingCount?: number;
      comIncumbency?: unknown;
      organicCompetition?: unknown;
      handleChecks?: unknown;
      googleQueryUrl?: string;
    },
  ): CandidateRecord {
    const candidates = this.asCandidates(session.candidates);
    const key = normalizeNameKey(input.name);
    let existing = candidates.find(
      (item) => normalizeNameKey(item.name) === key,
    );
    if (!existing) {
      existing = {
        id: randomUUID(),
        name: input.name.trim(),
        status: 'active',
        sources: [input.source],
        family: input.family ?? null,
        laneId: input.laneId ?? null,
        namingGoal: session.namingGoal,
        derivedFromCandidateId: null,
        rationale: input.rationale ?? '',
        notes: '',
        domainChecks: [],
        googleQueryUrl: input.googleQueryUrl ?? googleQueryUrl(input.name),
        brandChecks: [],
        domainHistory: [],
        takenEndingCount: 0,
        comIncumbency: null,
        organicCompetition: null,
        handleChecks: [],
        visualConcerns: { flags: [], note: '' },
        messaging: {},
        languageChecks: { aiAssisted: null, manual: [] },
        pronunciation: {},
        ratings: {},
        userRatings: {},
      };
      candidates.push(existing);
    } else {
      const sources = Array.isArray(existing.sources)
        ? (existing.sources as string[])
        : [];
      if (!sources.includes(input.source)) {
        existing.sources = [...sources, input.source];
      }
      if (input.family && !existing.family) {
        existing.family = input.family;
      }
      if (input.rationale && !existing.rationale) {
        existing.rationale = input.rationale;
      }
    }
    if (input.domainChecks) {
      existing.domainChecks = input.domainChecks;
      existing.googleQueryUrl =
        input.googleQueryUrl ?? googleQueryUrl(existing.name);
    }
    if (input.domainHistory !== undefined) {
      existing.domainHistory = input.domainHistory;
    }
    if (input.takenEndingCount !== undefined) {
      existing.takenEndingCount = input.takenEndingCount;
    }
    if (input.comIncumbency !== undefined) {
      existing.comIncumbency = input.comIncumbency;
    }
    if (input.organicCompetition !== undefined) {
      existing.organicCompetition = input.organicCompetition;
    }
    if (input.handleChecks !== undefined) {
      existing.handleChecks = input.handleChecks;
    }
    session.candidates = candidates;
    return existing;
  }

  private async toView(session: ProjectNameSession, userId: string) {
    const isOwner =
      session.createdById === userId ||
      (await this.projectAccess.isAdmin(userId));
    const rounds = asRounds(session.feedbackRounds);
    const allRows = await this.feedbackRepository.find({
      where: { sessionId: session.id },
    });
    const decision = shapeSessionDecision({
      rounds,
      allRows,
      userId,
      isOwner,
      batches: asBatches(session.batches),
    });

    let candidates = this.asCandidates(session.candidates);
    if (decision.redactCandidateIds) {
      const hide = new Set(decision.redactCandidateIds);
      candidates = candidates.map((candidate) =>
        hide.has(candidate.id) ? redactCandidate(candidate) : candidate,
      );
    }
    candidates = candidates.map((candidate) =>
      this.exposeCandidate(
        withoutWaveHandles(session.shortlistIds, candidate),
        userId,
      ),
    );

    return {
      id: session.id,
      projectId: session.projectId,
      title: session.title,
      brief: session.brief,
      namingGoal: session.namingGoal,
      productDescription: session.productDescription,
      lanes: session.lanes,
      candidates,
      shortlistIds: session.shortlistIds,
      recommendedCandidateId: session.recommendedCandidateId,
      runnerUpCandidateId: session.runnerUpCandidateId,
      decisionNote: session.decisionNote,
      batches: decision.batches,
      decisionPhase: decision.decisionPhase,
      createdById: session.createdById,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      canManageFeedback: isOwner,
      feedback: decision.feedback,
    };
  }
}
