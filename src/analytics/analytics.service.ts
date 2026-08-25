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
  ANALYTICS_COMPLETION_TIMESTAMP_SOURCE,
  ANALYTICS_TEST_DURATION_SOURCE,
  closedBugSolveMs,
  closedTestDwells,
  meanMs,
  mergePersonIds,
} from './analytics-summary.util';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary-query.dto';
import type {
  AnalyticsByStatus,
  AnalyticsPersonRow,
  AnalyticsSummary,
} from './analytics.types';

const UNASSIGNED_USERNAME = 'Unassigned';

interface CountRow {
  tasksCreated: string;
  tasksCreatedLast7Days: string;
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
  userId: string | null;
  ms: string;
}

interface MoveRow {
  userId: string | null;
  moves: string;
}

interface StatusEventRow {
  taskId: string;
  createdAt: Date;
  status: string | null;
  createdById: string | null;
}

interface BugEventRow {
  taskId: string;
  createdAt: Date;
  newValue: string | null;
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
  ) {}

  async getSummary(query: AnalyticsSummaryQueryDto): Promise<AnalyticsSummary> {
    await this.assertScope(query);

    const [
      counts,
      doneDurations,
      checklist,
      moves,
      moveRows,
      statusEvents,
      bugEvents,
      personCounts,
    ] = await Promise.all([
      this.loadCounts(query),
      this.loadDoneDurations(query),
      this.loadChecklist(query),
      this.loadMoveCount(query),
      this.loadMovesByActor(query),
      this.loadStatusEvents(query),
      this.loadBugEvents(query),
      this.loadPersonCounts(query),
    ]);

    const doneMean = meanMs(doneDurations.map((row) => Number(row.ms)));
    const bugPairs = closedBugSolveMs(
      bugEvents.map((row) => ({
        taskId: row.taskId,
        atMs: new Date(row.createdAt).getTime(),
        newValue: row.newValue,
      })),
    );
    const bugMean = meanMs(bugPairs.durations);
    const dwells = closedTestDwells(
      statusEvents.map((row) => ({
        taskId: row.taskId,
        atMs: new Date(row.createdAt).getTime(),
        status: row.status ?? '',
        createdById: row.createdById,
      })),
    );
    const devMean = meanMs(dwells.devTest);
    const qaMean = meanMs(dwells.qaTest);

    const byPerson = await this.buildByPerson({
      personCounts,
      doneDurations,
      moveRows,
      dwells,
    });

    return {
      tasksCreated: Number(counts.tasksCreated),
      tasksCreatedLast7Days: Number(counts.tasksCreatedLast7Days),
      activeCount: Number(counts.activeCount),
      archivedCount: Number(counts.archivedCount),
      byStatus: {
        [TaskStatus.TODO]: Number(counts.todo),
        [TaskStatus.IN_PROGRESS]: Number(counts.in_progress),
        [TaskStatus.DEV_TEST]: Number(counts.dev_test),
        [TaskStatus.QA_TEST]: Number(counts.qa_test),
        [TaskStatus.DONE]: Number(counts.done),
      } satisfies AnalyticsByStatus,
      openBugs: Number(counts.openBugs),
      bugReports: bugPairs.reports,
      moves,
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
      ...checklist,
      byPerson,
    };
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

  private async loadCounts(query: AnalyticsSummaryQueryDto): Promise<CountRow> {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('COUNT(*)', 'tasksCreated')
      .addSelect(
        'COUNT(*) FILTER (WHERE task.created_at >= :since7d)',
        'tasksCreatedLast7Days',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE task.archived_in_cycle_id IS NULL)',
        'activeCount',
      )
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
      )
      .setParameter('since7d', since7d);

    this.applyTaskScope(qb, query);
    const row = await qb.getRawOne<CountRow>();
    return (
      row ?? {
        tasksCreated: '0',
        tasksCreatedLast7Days: '0',
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

  private async loadDoneDurations(
    query: AnalyticsSummaryQueryDto,
  ): Promise<DurationRow[]> {
    const archivedQb = this.cycleHistoryRepository
      .createQueryBuilder('history')
      .innerJoin(Task, 'task', 'task.id = history.task_id')
      .innerJoin(Project, 'project', 'project.id = task.project_id')
      .select('task.created_by_id', 'userId')
      .addSelect(
        'EXTRACT(EPOCH FROM (history.completed_at - task.created_at)) * 1000',
        'ms',
      )
      .where('task.archived_in_cycle_id IS NOT NULL');
    this.applyTaskScope(archivedQb, query);

    const activeQb = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('task.created_by_id', 'userId')
      .addSelect(
        'EXTRACT(EPOCH FROM (task.updated_at - task.created_at)) * 1000',
        'ms',
      )
      .where('task.archived_in_cycle_id IS NULL')
      .andWhere('task.status = :done', { done: TaskStatus.DONE });
    this.applyTaskScope(activeQb, query);

    const [archived, active] = await Promise.all([
      archivedQb.getRawMany<DurationRow>(),
      activeQb.getRawMany<DurationRow>(),
    ]);
    return [...archived, ...active].filter((row) => Number.isFinite(Number(row.ms)));
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
      .where('task.parentTaskId IS NULL');
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

  private async loadMoveCount(query: AnalyticsSummaryQueryDto): Promise<number> {
    const qb = this.activityRepository.createQueryBuilder('activity');
    this.applyActivityScope(qb, query);
    return qb.getCount();
  }

  private async loadMovesByActor(
    query: AnalyticsSummaryQueryDto,
  ): Promise<MoveRow[]> {
    const qb = this.activityRepository
      .createQueryBuilder('activity')
      .select('activity.actor_user_id', 'userId')
      .addSelect('COUNT(*)', 'moves')
      .groupBy('activity.actor_user_id');
    this.applyActivityScope(qb, query);
    return qb.getRawMany<MoveRow>();
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
      .addSelect('task.created_by_id', 'createdById');
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

  private async loadPersonCounts(
    query: AnalyticsSummaryQueryDto,
  ): Promise<PersonCountRow[]> {
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('task.created_by_id', 'userId')
      .addSelect('COUNT(*)', 'tasksCreated')
      .addSelect(
        'COUNT(*) FILTER (WHERE task.archived_in_cycle_id IS NULL AND task.is_bug = true)',
        'openBugs',
      )
      .groupBy('task.created_by_id');
    this.applyTaskScope(qb, query);
    return qb.getRawMany<PersonCountRow>();
  }

  private async buildByPerson(input: {
    personCounts: PersonCountRow[];
    doneDurations: DurationRow[];
    moveRows: MoveRow[];
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
    for (const row of input.moveRows) {
      movesByUser.set(row.userId, Number(row.moves));
    }

    const countByUser = new Map<string | null, PersonCountRow>();
    for (const row of input.personCounts) {
      countByUser.set(row.userId, row);
    }

    const ids = mergePersonIds(
      countByUser.keys(),
      movesByUser.keys(),
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
      const counts = countByUser.get(userId);
      const done = meanMs(doneByUser.get(userId) ?? []);
      const creatorDwells = input.dwells.byCreator.get(userId);
      const testMean = meanMs([
        ...(creatorDwells?.devTest ?? []),
        ...(creatorDwells?.qaTest ?? []),
      ]);
      return {
        userId,
        username: userId ? (usernameById.get(userId) ?? userId) : UNASSIGNED_USERNAME,
        tasksCreated: Number(counts?.tasksCreated ?? 0),
        moves: movesByUser.get(userId) ?? 0,
        openBugs: Number(counts?.openBugs ?? 0),
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
}
