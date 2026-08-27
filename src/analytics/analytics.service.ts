import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { BoardCycleHistoryEntry } from '../board-cycles/board-cycle-history-entry.entity';
import { appError } from '../errors/app-errors';
import { Organization } from '../organizations/organization.entity';
import { Project } from '../projects/project.entity';
import { TaskHistoryField } from '../tasks/task-history-field.enum';
import { TaskHistoryEntry } from '../tasks/task-history-entry.entity';
import {
  computeQaChecklistProgress,
  normalizeQaChecklistState,
  parseQaChecklistItems,
} from '../tasks/task-qa-checklist.util';
import { Task } from '../tasks/task.entity';
import { TaskStatus } from '../tasks/task.enums';
import { UserActivityAction } from '../user-activity/user-activity-action.enum';
import { UserActivity } from '../user-activity/user-activity.entity';
import { User } from '../users/user.entity';
import {
  formatIsoDateUtc,
  growthMetric,
  inRange,
  resolveAnalyticsPeriod,
  type TimeWindow,
} from './analytics-period.util';
import {
  ANALYTICS_COMPLETION_TIMESTAMP_SOURCE,
  ANALYTICS_TEST_DURATION_SOURCE,
  analyticsTrendGranularity,
  appendArchiveClosures,
  closedBugSolves,
  closedTestDwells,
  countEventsIntoTrend,
  countRecentWork,
  emptyTrendBuckets,
  fillTrendField,
  meanMs,
  mergeLastInteractions,
  mergePersonIds,
  timestampMs,
} from './analytics-summary.util';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary-query.dto';
import { CreateBugFlagDossierDto } from './dto/create-bug-flag-dossier.dto';
import { formatTaskDisplayId } from '../common/utils/acronym.util';
import { normalizeBugFlagFields } from './bug-flag-dossier.util';
import { TaskBugFlagDossier } from './task-bug-flag-dossier.entity';
import type {
  AnalyticsBugFlagDossier,
  AnalyticsByStatus,
  AnalyticsDwellByStatus,
  AnalyticsLastInteractionRow,
  AnalyticsLongestStay,
  AnalyticsPersonRow,
  AnalyticsSummary,
  AnalyticsTrendGranularity,
} from './analytics.types';

const UNASSIGNED_USERNAME = 'Unassigned';

const STATUS_LABEL: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'To Do',
  [TaskStatus.IN_PROGRESS]: 'In Progress',
  [TaskStatus.DEV_TEST]: 'Dev Test',
  [TaskStatus.QA_TEST]: 'QA Test',
  [TaskStatus.DONE]: 'Done',
};

interface SnapshotRow {
  activeCount: string;
  archivedCount: string;
  todo: string;
  in_progress: string;
  dev_test: string;
  qa_test: string;
  done: string;
  openBugs: string;
}

interface PersonCountRow {
  userId: string | null;
  tasksCreated: string;
  openBugs: string;
}

interface DurationRow {
  taskId: string;
  userId: string | null;
  ms: string;
  completedAt: Date | string;
  archivedAt: Date | string | null;
}

interface StatusEventRow {
  taskId: string;
  createdAt: Date;
  status: string | null;
  createdById: string | null;
  actorUserId: string | null;
}

interface BugEventRow {
  taskId: string;
  createdAt: Date;
  newValue: string | null;
}

interface LastActivityRow {
  userId: string;
  lastInteractedAt: Date | string;
  action: string;
  summary: string;
}

interface RecentActivityRow {
  userId: string;
  action: string;
  entityId: string | null;
  createdAt: Date | string;
  summary: string | null;
  metadata: unknown;
}

interface RecentBugFlagRow {
  userId: string | null;
  createdAt: Date | string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserActivity)
    private readonly activityRepository: Repository<UserActivity>,
    @InjectRepository(TaskHistoryEntry)
    private readonly historyRepository: Repository<TaskHistoryEntry>,
    @InjectRepository(BoardCycleHistoryEntry)
    private readonly cycleHistoryRepository: Repository<BoardCycleHistoryEntry>,
    @InjectRepository(TaskBugFlagDossier)
    private readonly bugFlagRepository: Repository<TaskBugFlagDossier>,
  ) {}

  async getSummary(query: AnalyticsSummaryQueryDto): Promise<AnalyticsSummary> {
    await this.assertScope(query);

    const resolved = resolveAnalyticsPeriod(query);
    if (!resolved.ok) {
      throw appError('ANALYTICS_INVALID_RANGE');
    }
    const period = resolved.value;

    const granularity = analyticsTrendGranularity(period.key, period.current);

    const [
      snapshot,
      createdCurrent,
      createdPrevious,
      doneDurations,
      checklist,
      statusEvents,
      bugEvents,
      personCreated,
      personOpenBugs,
      createdSeries,
      lastInteractions,
    ] = await Promise.all([
      this.loadSnapshot(query),
      this.loadCreatedCount(query, period.current, 'createdCurrent'),
      period.previous
        ? this.loadCreatedCount(query, period.previous, 'createdPrevious')
        : Promise.resolve(null as number | null),
      this.loadDoneDurations(query),
      this.loadChecklist(query),
      this.loadStatusEvents(query),
      this.loadBugEvents(query),
      this.loadPersonCreated(query, period.current),
      this.loadPersonOpenBugs(query),
      this.loadCreatedSeries(query, period.current, granularity, 'createdSeries'),
      this.loadLastInteractions(query),
    ]);

    const mappedEvents = statusEvents.map((row) => ({
      taskId: row.taskId,
      atMs: new Date(row.createdAt).getTime(),
      status: row.status ?? '',
      createdById: row.createdById,
      actorUserId: row.actorUserId,
    }));
    const dwellEvents = appendArchiveClosures(
      mappedEvents,
      doneDurations
        .filter((row) => Number.isFinite(timestampMs(row.archivedAt)))
        .map((row) => ({
          taskId: row.taskId,
          archivedAtMs: timestampMs(row.archivedAt),
          completedAtMs: timestampMs(row.completedAt),
          createdById: row.userId,
        })),
    );
    const mappedBugs = bugEvents.map((row) => ({
      taskId: row.taskId,
      atMs: new Date(row.createdAt).getTime(),
      newValue: row.newValue,
    }));

    const currentMoves = mappedEvents.filter((event) => inRange(event.atMs, period.current));
    const movesCurrent = currentMoves.length;
    const movesPrevious = period.previous
      ? mappedEvents.filter((event) => inRange(event.atMs, period.previous as TimeWindow)).length
      : null;

    const currentBugReports = mappedBugs.filter(
      (event) => event.newValue === 'true' && inRange(event.atMs, period.current),
    );
    const bugReportsCurrent = currentBugReports.length;
    const bugReportsPrevious = period.previous
      ? mappedBugs.filter(
          (event) => event.newValue === 'true' && inRange(event.atMs, period.previous as TimeWindow),
        ).length
      : null;

    const doneCurrent = doneDurations.filter((row) => {
      const completedAtMs = timestampMs(row.completedAt);
      return Number.isFinite(completedAtMs) && inRange(completedAtMs, period.current);
    });
    const donePrevious = period.previous
      ? doneDurations.filter((row) => {
          const completedAtMs = timestampMs(row.completedAt);
          return (
            Number.isFinite(completedAtMs) &&
            inRange(completedAtMs, period.previous as TimeWindow)
          );
        }).length
      : null;
    const doneMean = meanMs(doneCurrent.map((row) => Number(row.ms)));

    const bugSolves = closedBugSolves(mappedBugs);
    const bugSolveMs = bugSolves.solves
      .filter((solve) => inRange(solve.resolvedAtMs, period.current))
      .map((solve) => solve.durationMs);
    const bugMean = meanMs(bugSolveMs);

    const dwells = closedTestDwells(dwellEvents, (dwell) => inRange(dwell.endMs, period.current));
    const dwellByStatus = this.toDwellByStatus(dwells.byStatus);
    const longestStay = this.toLongestStay(dwellByStatus);
    const devMean = meanMs(dwells.devTest);
    const qaMean = meanMs(dwells.qaTest);

    const byPerson = await this.buildByPerson({
      personCreated,
      personOpenBugs,
      doneDurations: doneCurrent,
      moveEvents: currentMoves,
      dwells,
    });

    const extraDates = [
      ...createdSeries.map((row) => row.date),
      ...currentMoves.map((event) => formatIsoDateUtc(event.atMs)),
      ...currentBugReports.map((event) => formatIsoDateUtc(event.atMs)),
      ...doneCurrent.map((row) => formatIsoDateUtc(timestampMs(row.completedAt))),
    ];
    const buckets = emptyTrendBuckets(period.current, granularity, extraDates);
    fillTrendField(
      buckets,
      createdSeries.map((row) => ({ date: row.date, count: row.count })),
      'tasksCreated',
    );
    countEventsIntoTrend(
      buckets,
      doneCurrent.map((row) => ({ atMs: timestampMs(row.completedAt) })),
      'tasksCompleted',
      granularity,
    );
    countEventsIntoTrend(buckets, currentMoves, 'moves', granularity);
    countEventsIntoTrend(buckets, currentBugReports, 'bugReports', granularity);

    return {
      period: {
        key: period.key,
        label: period.label,
        from: period.fromDate,
        to: period.toDate,
        previousLabel: period.previousLabel,
        compareFrom: period.compareFromDate,
        compareTo: period.compareToDate,
      },
      growth: {
        tasksCreated: growthMetric(createdCurrent, createdPrevious),
        tasksCompleted: growthMetric(doneCurrent.length, donePrevious),
        moves: growthMetric(movesCurrent, movesPrevious),
        bugReports: growthMetric(bugReportsCurrent, bugReportsPrevious),
      },
      tasksCreated: createdCurrent,
      tasksCompleted: doneCurrent.length,
      activeCount: Number(snapshot.activeCount),
      archivedCount: Number(snapshot.archivedCount),
      byStatus: {
        [TaskStatus.TODO]: Number(snapshot.todo),
        [TaskStatus.IN_PROGRESS]: Number(snapshot.in_progress),
        [TaskStatus.DEV_TEST]: Number(snapshot.dev_test),
        [TaskStatus.QA_TEST]: Number(snapshot.qa_test),
        [TaskStatus.DONE]: Number(snapshot.done),
      } satisfies AnalyticsByStatus,
      openBugs: Number(snapshot.openBugs),
      bugReports: bugReportsCurrent,
      moves: movesCurrent,
      averageMsToDone: doneMean.averageMs,
      sampleSize: doneMean.sampleSize,
      completionTimestampSource: ANALYTICS_COMPLETION_TIMESTAMP_SOURCE,
      averageMsToSolveBug: bugMean.averageMs,
      sampleSizeBugSolves: bugMean.sampleSize,
      averageMsInDevTest: devMean.averageMs,
      sampleSizeDevTestDwells: devMean.sampleSize,
      averageMsInQaTest: qaMean.averageMs,
      sampleSizeQaTestDwells: qaMean.sampleSize,
      testDurationSource: ANALYTICS_TEST_DURATION_SOURCE,
      dwellByStatus,
      longestStay,
      ...checklist,
      byPerson,
      lastInteractions,
      trend: {
        granularity,
        buckets,
      },
    };
  }

  private toDwellByStatus(byStatus: Record<TaskStatus, number[]>): AnalyticsDwellByStatus {
    return {
      [TaskStatus.TODO]: meanMs(byStatus.todo),
      [TaskStatus.IN_PROGRESS]: meanMs(byStatus.in_progress),
      [TaskStatus.DEV_TEST]: meanMs(byStatus.dev_test),
      [TaskStatus.QA_TEST]: meanMs(byStatus.qa_test),
      [TaskStatus.DONE]: meanMs(byStatus.done),
    };
  }

  private toLongestStay(dwellByStatus: AnalyticsDwellByStatus): AnalyticsLongestStay | null {
    let longest: AnalyticsLongestStay | null = null;
    for (const status of Object.values(TaskStatus)) {
      const stat = dwellByStatus[status];
      if (stat.averageMs === null || stat.sampleSize === 0) {
        continue;
      }
      if (!longest || stat.averageMs > longest.averageMs) {
        longest = {
          status,
          label: STATUS_LABEL[status],
          averageMs: stat.averageMs,
          sampleSize: stat.sampleSize,
        };
      }
    }
    return longest;
  }

  private async assertScope(query: AnalyticsSummaryQueryDto): Promise<void> {
    if (query.organizationId) {
      const organization = await this.organizationsRepository.findOne({
        where: { id: query.organizationId },
      });
      if (!organization) {
        throw appError('ORG_NOT_FOUND');
      }
    }

    if (query.projectId) {
      const project = await this.projectsRepository.findOne({
        where: { id: query.projectId },
      });
      if (!project) {
        throw appError('PROJ_NOT_FOUND');
      }
      if (query.organizationId && project.organizationId !== query.organizationId) {
        throw appError('PROJ_NOT_FOUND');
      }
    }
  }

  private applyTaskScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    query: AnalyticsSummaryQueryDto,
    projectAlias = 'project',
  ): void {
    if (query.organizationId) {
      qb.andWhere(`${projectAlias}.organizationId = :organizationId`, {
        organizationId: query.organizationId,
      });
    }
    if (query.projectId) {
      qb.andWhere(`${projectAlias}.id = :projectId`, {
        projectId: query.projectId,
      });
    }
  }

  private applyActivityScope(
    qb: SelectQueryBuilder<UserActivity>,
    query: AnalyticsSummaryQueryDto,
  ): void {
    qb.andWhere('activity.action = :action', {
      action: UserActivityAction.TASK_STATUS_CHANGED,
    });
    this.applyInteractionScope(qb, query);
  }

  private applyInteractionScope(
    qb: SelectQueryBuilder<UserActivity>,
    query: AnalyticsSummaryQueryDto,
  ): void {
    if (query.organizationId) {
      qb.andWhere('activity.organizationId = :organizationId', {
        organizationId: query.organizationId,
      });
    }
    if (query.projectId) {
      qb.andWhere("activity.metadata ->> 'projectId' = :projectId", {
        projectId: query.projectId,
      });
    }
  }

  private applyTimeWindow(
    qb: SelectQueryBuilder<ObjectLiteral>,
    columnSql: string,
    window: TimeWindow,
    key: string,
  ): void {
    if (window.startMs !== null) {
      qb.andWhere(`${columnSql} >= :${key}Start`, {
        [`${key}Start`]: new Date(window.startMs),
      });
    }
    if (window.endMs !== null) {
      qb.andWhere(`${columnSql} < :${key}End`, {
        [`${key}End`]: new Date(window.endMs),
      });
    }
  }

  private async loadSnapshot(query: AnalyticsSummaryQueryDto): Promise<SnapshotRow> {
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('COUNT(*) FILTER (WHERE task.archived_in_cycle_id IS NULL)', 'activeCount')
      .addSelect(
        'COUNT(*) FILTER (WHERE task.archived_in_cycle_id IS NOT NULL)',
        'archivedCount',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE task.archived_in_cycle_id IS NULL AND task.status = '${TaskStatus.TODO}')`,
        'todo',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE task.archived_in_cycle_id IS NULL AND task.status = '${TaskStatus.IN_PROGRESS}')`,
        'in_progress',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE task.archived_in_cycle_id IS NULL AND task.status = '${TaskStatus.DEV_TEST}')`,
        'dev_test',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE task.archived_in_cycle_id IS NULL AND task.status = '${TaskStatus.QA_TEST}')`,
        'qa_test',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE task.archived_in_cycle_id IS NULL AND task.status = '${TaskStatus.DONE}')`,
        'done',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE task.archived_in_cycle_id IS NULL AND task.is_bug = true)',
        'openBugs',
      );
    this.applyTaskScope(qb, query);
    const row = await qb.getRawOne<SnapshotRow>();
    return (
      row ?? {
        activeCount: '0',
        archivedCount: '0',
        todo: '0',
        in_progress: '0',
        dev_test: '0',
        qa_test: '0',
        done: '0',
        openBugs: '0',
      }
    );
  }

  private async loadCreatedCount(
    query: AnalyticsSummaryQueryDto,
    window: TimeWindow,
    key: string,
  ): Promise<number> {
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('COUNT(*)', 'count');
    this.applyTaskScope(qb, query);
    this.applyTimeWindow(qb, 'task.created_at', window, key);
    const row = await qb.getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private async loadCreatedSeries(
    query: AnalyticsSummaryQueryDto,
    window: TimeWindow,
    granularity: AnalyticsTrendGranularity,
    key: string,
  ): Promise<Array<{ date: string; count: number }>> {
    const trunc = granularity === 'day' ? 'day' : 'week';
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select(
        `to_char(date_trunc('${trunc}', timezone('UTC', task.created_at)), 'YYYY-MM-DD')`,
        'date',
      )
      .addSelect('COUNT(*)', 'count')
      .groupBy('date')
      .orderBy('date', 'ASC');
    this.applyTaskScope(qb, query);
    this.applyTimeWindow(qb, 'task.created_at', window, key);
    const rows = await qb.getRawMany<{ date: string; count: string }>();
    return rows
      .filter((row) => row.date)
      .map((row) => ({
        date: String(row.date).slice(0, 10),
        count: Number(row.count),
      }));
  }

  private async loadDoneDurations(
    query: AnalyticsSummaryQueryDto,
  ): Promise<DurationRow[]> {
    const archivedQb = this.cycleHistoryRepository
      .createQueryBuilder('history')
      .innerJoin(Task, 'task', 'task.id = history.task_id')
      .innerJoin(Project, 'project', 'project.id = task.project_id')
      .select('task.id', 'taskId')
      .addSelect('task.created_by_id', 'userId')
      .addSelect(
        'EXTRACT(EPOCH FROM (history.completed_at - task.created_at)) * 1000',
        'ms',
      )
      .addSelect('history.completed_at', 'completedAt')
      .addSelect('history.archived_at', 'archivedAt')
      .where('task.archived_in_cycle_id IS NOT NULL');
    this.applyTaskScope(archivedQb, query);

    const activeQb = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('task.id', 'taskId')
      .addSelect('task.created_by_id', 'userId')
      .addSelect(
        'EXTRACT(EPOCH FROM (task.updated_at - task.created_at)) * 1000',
        'ms',
      )
      .addSelect('task.updated_at', 'completedAt')
      .addSelect('NULL', 'archivedAt')
      .where('task.archived_in_cycle_id IS NULL')
      .andWhere('task.status = :done', { done: TaskStatus.DONE });
    this.applyTaskScope(activeQb, query);

    const [archived, active] = await Promise.all([
      archivedQb.getRawMany<DurationRow>(),
      activeQb.getRawMany<DurationRow>(),
    ]);
    return [...archived, ...active].filter((row) => {
      const ms = Number(row.ms);
      return Number.isFinite(ms) && Number.isFinite(timestampMs(row.completedAt));
    });
  }

  private async loadChecklist(query: AnalyticsSummaryQueryDto): Promise<{
    checklistTasks: number;
    checklistItemsTotal: number;
    checklistItemsChecked: number;
    checklistCompleteTasks: number;
    checklistOpenBugs: number;
  }> {
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select(['task.id', 'task.testDescription', 'task.qaChecklistState'])
      .where('task.parentTaskId IS NULL')
      .andWhere('task.archivedInCycleId IS NULL');
    this.applyTaskScope(qb, query);
    const parents = await qb.getMany();

    let checklistTasks = 0;
    let checklistItemsTotal = 0;
    let checklistItemsChecked = 0;
    let checklistCompleteTasks = 0;
    let checklistOpenBugs = 0;

    for (const task of parents) {
      const items = parseQaChecklistItems(task.testDescription);
      if (items.length === 0) {
        continue;
      }
      const state = normalizeQaChecklistState(task.qaChecklistState);
      const progress = computeQaChecklistProgress(task.testDescription, state);
      if (!progress) {
        continue;
      }
      checklistTasks += 1;
      checklistItemsTotal += progress.total;
      checklistItemsChecked += progress.done;
      if (progress.done === progress.total) {
        checklistCompleteTasks += 1;
      }
      const knownIds = new Set(items.map((item) => item.id));
      checklistOpenBugs += state.buggedItemIds.filter((id) => knownIds.has(id)).length;
    }

    return {
      checklistTasks,
      checklistItemsTotal,
      checklistItemsChecked,
      checklistCompleteTasks,
      checklistOpenBugs,
    };
  }

  private async loadStatusEvents(
    query: AnalyticsSummaryQueryDto,
  ): Promise<StatusEventRow[]> {
    const qb = this.activityRepository
      .createQueryBuilder('activity')
      .leftJoin(Task, 'task', 'task.id = activity.entity_id')
      .select('activity.entity_id', 'taskId')
      .addSelect('activity.created_at', 'createdAt')
      .addSelect("activity.metadata ->> 'status'", 'status')
      .addSelect('task.created_by_id', 'createdById')
      .addSelect('activity.actor_user_id', 'actorUserId');
    this.applyActivityScope(qb, query);
    return qb.getRawMany<StatusEventRow>();
  }

  private async loadBugEvents(
    query: AnalyticsSummaryQueryDto,
  ): Promise<BugEventRow[]> {
    const qb = this.historyRepository
      .createQueryBuilder('history')
      .innerJoin(Task, 'task', 'task.id = history.task_id')
      .innerJoin(Project, 'project', 'project.id = task.project_id')
      .select('history.task_id', 'taskId')
      .addSelect('history.created_at', 'createdAt')
      .addSelect('history.new_value', 'newValue')
      .where('history.field = :field', { field: TaskHistoryField.IS_BUG });
    this.applyTaskScope(qb, query);
    return qb.getRawMany<BugEventRow>();
  }

  private async loadPersonCreated(
    query: AnalyticsSummaryQueryDto,
    window: TimeWindow,
  ): Promise<PersonCountRow[]> {
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('task.created_by_id', 'userId')
      .addSelect('COUNT(*)', 'tasksCreated')
      .addSelect('0', 'openBugs')
      .groupBy('task.created_by_id');
    this.applyTaskScope(qb, query);
    this.applyTimeWindow(qb, 'task.created_at', window, 'personCreated');
    return qb.getRawMany<PersonCountRow>();
  }

  private async loadPersonOpenBugs(
    query: AnalyticsSummaryQueryDto,
  ): Promise<PersonCountRow[]> {
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('task.created_by_id', 'userId')
      .addSelect('0', 'tasksCreated')
      .addSelect(
        'COUNT(*) FILTER (WHERE task.archived_in_cycle_id IS NULL AND task.is_bug = true)',
        'openBugs',
      )
      .groupBy('task.created_by_id');
    this.applyTaskScope(qb, query);
    return qb.getRawMany<PersonCountRow>();
  }

  private async buildByPerson(input: {
    personCreated: PersonCountRow[];
    personOpenBugs: PersonCountRow[];
    doneDurations: DurationRow[];
    moveEvents: Array<{ actorUserId: string | null }>;
    dwells: ReturnType<typeof closedTestDwells>;
  }): Promise<AnalyticsPersonRow[]> {
    const doneByUser = new Map<string | null, number[]>();
    for (const row of input.doneDurations) {
      const key = row.userId;
      const list = doneByUser.get(key) ?? [];
      list.push(Number(row.ms));
      doneByUser.set(key, list);
    }

    const movesByUser = new Map<string | null, number>();
    for (const event of input.moveEvents) {
      const key = event.actorUserId;
      movesByUser.set(key, (movesByUser.get(key) ?? 0) + 1);
    }

    const createdByUser = new Map<string | null, number>();
    for (const row of input.personCreated) {
      createdByUser.set(row.userId, Number(row.tasksCreated));
    }

    const openBugsByUser = new Map<string | null, number>();
    for (const row of input.personOpenBugs) {
      openBugsByUser.set(row.userId, Number(row.openBugs));
    }

    const ids = mergePersonIds(
      createdByUser.keys(),
      doneByUser.keys(),
      movesByUser.keys(),
      openBugsByUser.keys(),
      input.dwells.byCreator.keys(),
    );
    const namedIds = ids.filter((id): id is string => typeof id === 'string');
    const users = namedIds.length
      ? await this.usersRepository.find({
          where: { id: In(namedIds) },
          select: ['id', 'username'],
        })
      : [];
    const usernameById = new Map(users.map((user) => [user.id, user.username]));

    const rows = ids.map((userId) => {
      const done = meanMs(doneByUser.get(userId) ?? []);
      const creatorDwells = input.dwells.byCreator.get(userId);
      const testMean = meanMs([
        ...(creatorDwells?.devTest ?? []),
        ...(creatorDwells?.qaTest ?? []),
      ]);
      return {
        userId,
        username: userId ? (usernameById.get(userId) ?? userId) : UNASSIGNED_USERNAME,
        tasksCreated: createdByUser.get(userId) ?? 0,
        tasksCompleted: done.sampleSize,
        moves: movesByUser.get(userId) ?? 0,
        openBugs: openBugsByUser.get(userId) ?? 0,
        averageMsToDone: done.averageMs,
        sampleSizeToDone: done.sampleSize,
        averageMsInTest: testMean.averageMs,
        sampleSizeTestDwells: testMean.sampleSize,
      };
    });

    rows.sort((left, right) => {
      if (right.tasksCreated !== left.tasksCreated) {
        return right.tasksCreated - left.tasksCreated;
      }
      return left.username.localeCompare(right.username);
    });
    return rows;
  }

  private async loadLastInteractions(
    query: AnalyticsSummaryQueryDto,
  ): Promise<AnalyticsLastInteractionRow[]> {
    const [members, activityRows, recentRows, bugRows] = await Promise.all([
      this.loadScopedUsers(query),
      this.loadLatestActivityByUser(query),
      this.loadRecentTaskWork(query),
      this.loadRecentBugFlags(query),
    ]);

    const extraIds = [
      ...activityRows.map((row) => row.userId),
      ...recentRows.map((row) => row.userId),
      ...bugRows.map((row) => row.userId),
    ].filter((userId) => !members.some((member) => member.userId === userId));
    const uniqueExtra = [...new Set(extraIds)];
    const extraUsers = uniqueExtra.length
      ? await this.usersRepository.find({
          where: { id: In(uniqueExtra) },
          select: ['id', 'username'],
        })
      : [];

    return mergeLastInteractions(
      [
        ...members,
        ...extraUsers.map((user) => ({ userId: user.id, username: user.username })),
      ],
      activityRows,
      countRecentWork(recentRows, Date.now(), bugRows),
    );
  }

  private async loadScopedUsers(
    query: AnalyticsSummaryQueryDto,
  ): Promise<Array<{ userId: string; username: string }>> {
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.username'])
      .orderBy('user.username', 'ASC');

    if (query.projectId) {
      qb.innerJoin('user.projectMemberships', 'membership').andWhere(
        'membership.projectId = :projectId',
        { projectId: query.projectId },
      );
    } else if (query.organizationId) {
      qb.innerJoin('user.projectMemberships', 'membership')
        .innerJoin('membership.project', 'project')
        .andWhere('project.organizationId = :organizationId', {
          organizationId: query.organizationId,
        })
        .distinct(true);
    }

    const rows = await qb.getMany();
    return rows.map((user) => ({ userId: user.id, username: user.username }));
  }

  private async loadLatestActivityByUser(
    query: AnalyticsSummaryQueryDto,
  ): Promise<
    Array<{
      userId: string;
      lastInteractedAt: string;
      action: string;
      summary: string;
    }>
  > {
    const qb = this.activityRepository
      .createQueryBuilder('activity')
      .distinctOn(['activity.actorUserId'])
      .select('activity.actorUserId', 'userId')
      .addSelect('activity.createdAt', 'lastInteractedAt')
      .addSelect('activity.action', 'action')
      .addSelect('activity.summary', 'summary')
      .orderBy('activity.actorUserId')
      .addOrderBy('activity.createdAt', 'DESC');
    this.applyInteractionScope(qb, query);
    const rows = await qb.getRawMany<LastActivityRow>();
    return rows
      .filter((row) => Boolean(row.userId))
      .map((row) => ({
        userId: row.userId,
        lastInteractedAt:
          row.lastInteractedAt instanceof Date
            ? row.lastInteractedAt.toISOString()
            : new Date(row.lastInteractedAt).toISOString(),
        action: row.action,
        summary: row.summary,
      }));
  }

  private async loadRecentTaskWork(
    query: AnalyticsSummaryQueryDto,
  ): Promise<
    Array<{
      userId: string;
      atMs: number;
      action: string;
      entityId: string | null;
      metadata: unknown;
      summary: string | null;
    }>
  > {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const qb = this.activityRepository
      .createQueryBuilder('activity')
      .select('activity.actorUserId', 'userId')
      .addSelect('activity.action', 'action')
      .addSelect('activity.entityId', 'entityId')
      .addSelect('activity.createdAt', 'createdAt')
      .addSelect('activity.summary', 'summary')
      .addSelect('activity.metadata', 'metadata')
      .where('activity.createdAt >= :since', { since })
      .andWhere('activity.action IN (:...taskActions)', {
        taskActions: [
          UserActivityAction.TASK_CREATED,
          UserActivityAction.TASK_UPDATED,
          UserActivityAction.TASK_STATUS_CHANGED,
          UserActivityAction.TASK_DELETED,
          UserActivityAction.TASK_CHECKLIST_CHECKED,
        ],
      });
    this.applyInteractionScope(qb, query);
    const rows = await qb.getRawMany<RecentActivityRow>();
    return rows
      .filter((row) => Boolean(row.userId))
      .map((row) => ({
        userId: row.userId,
        atMs: new Date(row.createdAt).getTime(),
        action: row.action,
        entityId: row.entityId,
        metadata: row.metadata,
        summary: row.summary,
      }));
  }

  private async loadRecentBugFlags(
    query: AnalyticsSummaryQueryDto,
  ): Promise<Array<{ userId: string; atMs: number }>> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const qb = this.historyRepository
      .createQueryBuilder('history')
      .innerJoin(Task, 'task', 'task.id = history.task_id')
      .innerJoin(Project, 'project', 'project.id = task.project_id')
      .select('history.changed_by_id', 'userId')
      .addSelect('history.created_at', 'createdAt')
      .where('history.field = :field', { field: TaskHistoryField.IS_BUG })
      .andWhere('history.new_value = :newValue', { newValue: 'true' })
      .andWhere('history.created_at >= :since', { since })
      .andWhere('history.changed_by_id IS NOT NULL');
    this.applyTaskScope(qb, query);
    const rows = await qb.getRawMany<RecentBugFlagRow>();
    return rows
      .filter((row) => Boolean(row.userId))
      .map((row) => ({
        userId: row.userId as string,
        atMs: new Date(row.createdAt).getTime(),
      }));
  }

  async listBugFlags(
    query: AnalyticsSummaryQueryDto,
  ): Promise<{ items: AnalyticsBugFlagDossier[] }> {
    await this.assertScope(query);

    const resolved = resolveAnalyticsPeriod(query);
    if (!resolved.ok) {
      throw appError('ANALYTICS_INVALID_RANGE');
    }
    const window = resolved.value.current;

    const qb = this.bugFlagRepository
      .createQueryBuilder('dossier')
      .distinctOn(['dossier.taskId'])
      .innerJoinAndSelect('dossier.task', 'task')
      .innerJoinAndSelect('task.project', 'project')
      .orderBy('dossier.taskId')
      .addOrderBy('dossier.createdAt', 'DESC');

    this.applyTaskScope(qb, query, 'project');
    if (window.startMs !== null) {
      qb.andWhere('dossier.createdAt >= :flagStart', {
        flagStart: new Date(window.startMs),
      });
    }
    if (window.endMs !== null) {
      qb.andWhere('dossier.createdAt < :flagEnd', {
        flagEnd: new Date(window.endMs),
      });
    }

    const rows = await qb.getMany();
    const items = rows
      .map((row) => this.toBugFlagRow(row))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return { items };
  }

  async getLatestBugFlag(taskId: string): Promise<{ flag: AnalyticsBugFlagDossier | null }> {
    const row = await this.bugFlagRepository.findOne({
      where: { taskId },
      relations: ['task', 'task.project'],
      order: { createdAt: 'DESC' },
    });
    if (!row) {
      const task = await this.tasksRepository.findOne({ where: { id: taskId } });
      if (!task) {
        throw appError('TASK_NOT_FOUND');
      }
      return { flag: null };
    }
    return { flag: this.toBugFlagRow(row) };
  }

  async createBugFlag(
    userId: string,
    dto: CreateBugFlagDossierDto,
  ): Promise<AnalyticsBugFlagDossier> {
    const fields = normalizeBugFlagFields(dto);
    if (!fields.ok) {
      throw appError('ANALYTICS_INVALID_BUG_FLAG');
    }

    const task = await this.tasksRepository.findOne({
      where: { id: dto.taskId },
      relations: ['project'],
    });
    if (!task?.project) {
      throw appError('TASK_NOT_FOUND');
    }

    const saved = await this.bugFlagRepository.save(
      this.bugFlagRepository.create({
        taskId: task.id,
        primary: fields.value.primary,
        secondary: fields.value.secondary,
        motivo: fields.value.motivo,
        evidence: fields.value.evidence,
        taskScore: fields.value.taskScore,
        flagScore: fields.value.flagScore,
        createdById: userId,
      }),
    );
    saved.task = task;
    return this.toBugFlagRow(saved);
  }

  private toBugFlagRow(row: TaskBugFlagDossier): AnalyticsBugFlagDossier {
    const task = row.task;
    const acronym = task?.project?.acronym ?? '';
    const taskNumber = task?.taskNumber ?? 0;
    return {
      id: row.id,
      taskId: row.taskId,
      displayId: task ? formatTaskDisplayId(acronym, taskNumber) : row.taskId,
      title: task?.title ?? '',
      primary: row.primary,
      secondary: row.secondary ?? [],
      motivo: row.motivo,
      evidence: row.evidence,
      taskScore: row.taskScore,
      flagScore: row.flagScore,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date(row.createdAt).toISOString(),
      createdById: row.createdById,
    };
  }
}
