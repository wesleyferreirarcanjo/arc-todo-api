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
  RecommendNameDto,
  StartFeedbackRoundDto,
  UpsertFeedbackResponseDto,
} from './dto/name-session-actions.dto';
import { UpdateNameSessionDto } from './dto/update-name-session.dto';
import { NameCandidateFeedback } from './name-candidate-feedback.entity';
import { NameCheckService, type DomainCheck } from './name-check.service';
import {
  CandidateSource,
  DEFAULT_NAMING_GOAL,
  countTakenEndings,
  gradeComIncumbency,
  googleQueryUrl,
  isNamingGoal,
  median,
  normalizeNameKey,
  type IncumbencyGrade,
  type ParkingSignal,
} from './name-check.util';
import {
  NameHistoryService,
  type DomainHistory,
} from './name-history.service';
import { ProjectNameSession } from './project-name-session.entity';

const CHECK_BATCH_CONCURRENCY = 4;

export type ProjectNameSessionSummary = {
  id: string;
  title: string;
  namingGoal: string | null;
  recommendedName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CandidateRecord = Record<string, unknown> & {
  id: string;
  name: string;
};

type FeedbackRound = {
  id: string;
  candidateIds: string[];
  status: 'open' | 'closed';
  createdAt: string;
  closedAt: string | null;
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

  private asRounds(value: unknown): FeedbackRound[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is FeedbackRound =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as FeedbackRound).id === 'string' &&
        Array.isArray((item as FeedbackRound).candidateIds),
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
      session.candidates = this.sanitizeCandidates(dto.candidates);
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
    const evidence = await this.collectDomainEvidence(name);
    const candidate = this.upsertCandidate(session, {
      name,
      source,
      domainChecks: evidence.domainChecks,
      domainHistory: evidence.domainHistory,
      takenEndingCount: evidence.takenEndingCount,
      comIncumbency: evidence.comIncumbency,
      googleQueryUrl: googleQueryUrl(name),
    });
    await this.sessionRepository.save(session);
    return candidate;
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
      async (name) => ({ name, evidence: await this.collectDomainEvidence(name) }),
    );
    const candidates = evidenceByName.map(({ name, evidence }) =>
      this.upsertCandidate(session, {
        name,
        source,
        domainChecks: evidence.domainChecks,
        domainHistory: evidence.domainHistory,
        takenEndingCount: evidence.takenEndingCount,
        comIncumbency: evidence.comIncumbency,
        googleQueryUrl: googleQueryUrl(name),
      }),
    );
    await this.sessionRepository.save(session);
    return { candidates };
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
      ? (existing.domainChecks as Array<{ host?: string; availability?: string }>)
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
    session.candidates = candidates;
    await this.sessionRepository.save(session);
    return existing;
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
    return { candidates: added };
  }

  async recommend(
    userId: string,
    orgId: string,
    projectId: string,
    sessionId: string,
    dto: RecommendNameDto,
  ) {
    const session = await this.findOne(userId, orgId, projectId, sessionId);
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
    const rounds = this.asRounds(session.feedbackRounds);
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
    const round = this.asRounds(session.feedbackRounds).find(
      (item) => item.id === roundId,
    );
    if (!round) {
      throw appError('NAME_ROUND_NOT_FOUND');
    }
    if (round.status !== 'open') {
      throw appError('NAME_ROUND_CLOSED');
    }
    if (!round.candidateIds.includes(dto.candidateId)) {
      throw appError('NAME_CANDIDATE_NOT_IN_ROUND');
    }
    let row = await this.feedbackRepository.findOne({
      where: { roundId, candidateId: dto.candidateId, userId },
    });
    if (!row) {
      row = this.feedbackRepository.create({
        sessionId: session.id,
        roundId,
        candidateId: dto.candidateId,
        userId,
      });
    }
    if (dto.firstImpression !== undefined) {
      row.firstImpression = dto.firstImpression;
    }
    if (dto.rememberedSpelling !== undefined) {
      row.rememberedSpelling = dto.rememberedSpelling;
    }
    if (dto.perceivedPurpose !== undefined) {
      row.perceivedPurpose = dto.perceivedPurpose;
    }
    if (dto.ratings !== undefined) {
      row.ratings = { ...dto.ratings };
    }
    if (dto.concern !== undefined) {
      row.concern = dto.concern;
    }
    await this.feedbackRepository.save(row);
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
    const rounds = this.asRounds(session.feedbackRounds);
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

  private sanitizeCandidates(value: unknown[]): CandidateRecord[] {
    return value
      .filter(
        (item): item is CandidateRecord =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as CandidateRecord).name === 'string',
      )
      .map((item) => ({
        ...item,
        id: typeof item.id === 'string' && item.id ? item.id : randomUUID(),
        name: String(item.name).trim(),
      }))
      .filter((item) => item.name);
  }

  private async collectDomainEvidence(name: string): Promise<{
    domainChecks: DomainCheck[];
    domainHistory: DomainHistory[];
    takenEndingCount: number;
    comIncumbency: {
      grade: IncumbencyGrade;
      parking: ParkingSignal;
      gradedAt: string;
    } | null;
  }> {
    const domainChecks = await this.nameCheckService.checkName(name);
    const takenEndingCount = countTakenEndings(domainChecks);
    const comCheck = domainChecks.find((check) => check.tld === 'com');
    if (!comCheck || comCheck.availability !== 'taken') {
      return {
        domainChecks,
        domainHistory: [],
        takenEndingCount,
        comIncumbency: null,
      };
    }
    const [domainHistory, parking] = await Promise.all([
      this.nameHistoryService.checkHistory([comCheck.host]),
      this.nameHistoryService.probeParking(comCheck.host),
    ]);
    const history = domainHistory[0];
    const grade = gradeComIncumbency({
      comAvailability: comCheck.availability,
      historyStatus: history?.status ?? 'unknown',
      lastCapture: history?.wayback.lastCapture ?? null,
      captureCount: history?.wayback.captureCount ?? null,
      ctLatest: history?.ct.latest ?? null,
      ctCount: history?.ct.count ?? null,
      parking,
    });
    return {
      domainChecks,
      domainHistory,
      takenEndingCount,
      comIncumbency: {
        grade,
        parking,
        gradedAt: new Date().toISOString(),
      },
    };
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
        visualConcerns: { flags: [], note: '' },
        messaging: {},
        languageChecks: { aiAssisted: null, manual: [] },
        pronunciation: {},
        ratings: {},
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
    session.candidates = candidates;
    return existing;
  }

  private hashSeed(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  private shuffledIds(ids: string[], seed: string): string[] {
    const copy = [...ids];
    let n = this.hashSeed(seed) + 1;
    for (let i = copy.length - 1; i > 0; i--) {
      n = (n * 1103515245 + 12345) & 0x7fffffff;
      const j = n % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private redactCandidate(candidate: CandidateRecord): CandidateRecord {
    return {
      id: candidate.id,
      name: candidate.name,
      status: 'active',
      sources: [],
      family: null,
      laneId: candidate.laneId ?? null,
      namingGoal: null,
      derivedFromCandidateId: null,
      rationale: '',
      notes: '',
      domainChecks: [],
      googleQueryUrl: '',
      brandChecks: [],
      domainHistory: [],
      takenEndingCount: 0,
      comIncumbency: null,
      visualConcerns: { flags: [], note: '' },
      messaging: {},
      languageChecks: { aiAssisted: null, manual: [] },
      pronunciation: {},
      ratings: {},
    };
  }

  private aggregateRound(rows: NameCandidateFeedback[]) {
    const participantIds = new Set(rows.map((row) => row.userId));
    const byCandidate: Record<
      string,
      {
        responses: number;
        easyToSay: number | null;
        memorable: number | null;
        fitsProduct: number | null;
        repeatedConcerns: string[];
      }
    > = {};
    const grouped = new Map<string, NameCandidateFeedback[]>();
    for (const row of rows) {
      const list = grouped.get(row.candidateId) ?? [];
      list.push(row);
      grouped.set(row.candidateId, list);
    }
    for (const [candidateId, list] of grouped) {
      const num = (key: string) =>
        list
          .map((row) => {
            const value = (row.ratings ?? {})[key];
            return typeof value === 'number' ? value : null;
          })
          .filter((value): value is number => value != null);
      const concernCounts = new Map<string, number>();
      for (const row of list) {
        const concern = row.concern.trim().toLowerCase();
        if (!concern) continue;
        concernCounts.set(concern, (concernCounts.get(concern) ?? 0) + 1);
      }
      byCandidate[candidateId] = {
        responses: list.length,
        easyToSay: median(num('easyToSay')),
        memorable: median(num('memorable')),
        fitsProduct: median(num('fitsProduct')),
        repeatedConcerns: [...concernCounts.entries()]
          .filter(([, count]) => count >= 2)
          .map(([text]) => text),
      };
    }
    return {
      participantCount: participantIds.size,
      byCandidate,
    };
  }

  private async toView(session: ProjectNameSession, userId: string) {
    const isOwner =
      session.createdById === userId ||
      (await this.projectAccess.isAdmin(userId));
    const rounds = this.asRounds(session.feedbackRounds);
    const openRound = rounds.find((round) => round.status === 'open');
    const allRows = await this.feedbackRepository.find({
      where: { sessionId: session.id },
    });
    const mine = allRows.filter((row) => row.userId === userId);
    const submittedOpen =
      !!openRound &&
      openRound.candidateIds.every((id) =>
        mine.some((row) => row.roundId === openRound.id && row.candidateId === id),
      );

    let candidates = this.asCandidates(session.candidates);
    if (openRound && !isOwner && !submittedOpen) {
      candidates = candidates.map((candidate) =>
        openRound.candidateIds.includes(candidate.id)
          ? this.redactCandidate(candidate)
          : candidate,
      );
    }

    const feedback = rounds.map((round) => {
      const roundRows = allRows.filter((row) => row.roundId === round.id);
      const myRows = roundRows.filter((row) => row.userId === userId);
      const reveal =
        round.status === 'closed' ||
        isOwner ||
        (round.status === 'open' &&
          round.candidateIds.every((id) =>
            myRows.some((row) => row.candidateId === id),
          ));
      return {
        ...round,
        order: this.shuffledIds(round.candidateIds, `${round.id}:${userId}`),
        mine: myRows.map((row) => ({
          candidateId: row.candidateId,
          firstImpression: row.firstImpression,
          rememberedSpelling: row.rememberedSpelling,
          perceivedPurpose: row.perceivedPurpose,
          ratings: row.ratings,
          concern: row.concern,
          updatedAt: row.updatedAt,
        })),
        aggregate: reveal ? this.aggregateRound(roundRows) : null,
      };
    });

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
      createdById: session.createdById,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      canManageFeedback: isOwner,
      feedback,
    };
  }
}
