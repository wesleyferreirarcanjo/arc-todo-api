import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { formatTaskDisplayId } from '../common/utils/acronym.util';
import { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { TaskEvidenceService } from '../tasks/task-evidence.service';
import { Task } from '../tasks/task.entity';
import { TaskStatus } from '../tasks/task.enums';
import { TaskResponse, TasksService } from '../tasks/tasks.service';
import { BoardCycleHistoryEntry } from './board-cycle-history-entry.entity';
import { BoardCycle } from './board-cycle.entity';
import {
  BoardCycleStatus,
  COMPLETION_TIMESTAMP_SOURCE_TASK_UPDATED_AT,
} from './board-cycle.enums';
import {
  compareDateStrings,
  getNextCycleBounds,
  getProjectAnchoredCycleBounds,
  isCyclePeriodEnded,
  selectTasksForArchival,
} from './board-cycle.util';

export interface BoardCycleResponse {
  id: string;
  organizationId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  status: BoardCycleStatus;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardCycleHistoryEntryResponse {
  id: string;
  cycleId: string;
  organizationId: string;
  projectId: string;
  taskId: string;
  parentTaskId: string | null;
  displayId: string;
  taskNumber: number;
  title: string;
  status: TaskStatus;
  completedAt: string;
  completionTimestampSource: string;
  archivedAt: string;
  createdAt: string;
}

export interface CurrentBoardCycleResponse {
  cycle: BoardCycleResponse;
  tasks: TaskResponse[];
  autoClosesOn: string;
}

export interface AdvanceBoardCycleResponse {
  closedCycle: BoardCycleResponse;
  nextCycle: BoardCycleResponse;
  archivedCount: number;
}

export interface BoardCycleHistoryResponse {
  cycles: Array<
    BoardCycleResponse & { entries: BoardCycleHistoryEntryResponse[] }
  >;
}

@Injectable()
export class BoardCyclesService {
  private readonly logger = new Logger(BoardCyclesService.name);

  constructor(
    @InjectRepository(BoardCycle)
    private readonly cyclesRepository: Repository<BoardCycle>,
    @InjectRepository(BoardCycleHistoryEntry)
    private readonly historyRepository: Repository<BoardCycleHistoryEntry>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
    private readonly evidenceService: TaskEvidenceService,
    private readonly dataSource: DataSource,
  ) {}

  async getCurrentCycle(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<CurrentBoardCycleResponse> {
    const project = await this.projectsService.findOne(userId, orgId, projectId);
    const cycle = await this.syncProjectCycles(project);
    const tasks = await this.tasksService.findAll(userId, orgId, projectId);
    return {
      cycle: this.toCycleResponse(cycle),
      tasks,
      autoClosesOn: cycle.endDate,
    };
  }

  async advanceCycle(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<AdvanceBoardCycleResponse> {
    const project = await this.projectsService.findOne(userId, orgId, projectId);

    const archivedTaskIds: string[] = [];
    const result = await this.dataSource.transaction(async (manager) => {
      const cycleRepo = manager.getRepository(BoardCycle);
      let activeCycle = await cycleRepo.findOne({
        where: {
          projectId,
          status: BoardCycleStatus.ACTIVE,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!activeCycle) {
        activeCycle = await this.bootstrapProjectCycles(manager, project);
      }

      const closed = await this.closeAndAdvanceInTransaction(
        manager,
        project,
        activeCycle,
      );
      archivedTaskIds.push(...closed.archivedTaskIds);
      return closed.response;
    });

    await this.purgeArchivedTaskEvidence(archivedTaskIds);
    return result;
  }

  async syncAllOverdueProjects(): Promise<number> {
    const overdueCycles = await this.cyclesRepository
      .createQueryBuilder('cycle')
      .innerJoin(Project, 'project', 'project.id = cycle.project_id')
      .where('cycle.status = :status', { status: BoardCycleStatus.ACTIVE })
      .andWhere('cycle.end_date < CURRENT_DATE')
      .select(['cycle.project_id AS project_id'])
      .distinct(true)
      .getRawMany<{ project_id: string }>();

    const projectIds = overdueCycles.map((row) => row.project_id);
    let advanced = 0;

    for (const projectId of projectIds) {
      const project = await this.projectsRepository.findOne({
        where: { id: projectId },
      });
      if (!project) {
        continue;
      }
      const before = await this.cyclesRepository.findOne({
        where: { projectId, status: BoardCycleStatus.ACTIVE },
      });
      await this.syncProjectCycles(project);
      const after = await this.cyclesRepository.findOne({
        where: { projectId, status: BoardCycleStatus.ACTIVE },
      });
      if (before && after && before.id !== after.id) {
        advanced += 1;
      }
    }

    return advanced;
  }

  async getHistory(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<BoardCycleHistoryResponse> {
    const project = await this.projectsService.findOne(userId, orgId, projectId);
    await this.syncProjectCycles(project);

    const cycles = await this.cyclesRepository.find({
      where: {
        projectId,
        status: BoardCycleStatus.CLOSED,
      },
      order: { closedAt: 'DESC' },
    });

    if (cycles.length === 0) {
      return { cycles: [] };
    }

    const cycleIds = cycles.map((cycle) => cycle.id);
    const entries = await this.historyRepository.find({
      where: { cycleId: In(cycleIds) },
      order: { archivedAt: 'DESC' },
    });

    const entriesByCycle = new Map<string, BoardCycleHistoryEntryResponse[]>();
    for (const entry of entries) {
      const group = entriesByCycle.get(entry.cycleId) ?? [];
      group.push(this.toHistoryEntryResponse(entry));
      entriesByCycle.set(entry.cycleId, group);
    }

    return {
      cycles: cycles.map((cycle) => ({
        ...this.toCycleResponse(cycle),
        entries: entriesByCycle.get(cycle.id) ?? [],
      })),
    };
  }

  private async syncProjectCycles(project: Project): Promise<BoardCycle> {
    const archivedTaskIds: string[] = [];
    const activeCycle = await this.dataSource.transaction(async (manager) => {
      const cycleRepo = manager.getRepository(BoardCycle);
      let activeCycle = await cycleRepo.findOne({
        where: {
          projectId: project.id,
          status: BoardCycleStatus.ACTIVE,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!activeCycle) {
        return this.bootstrapProjectCycles(manager, project);
      }

      while (isCyclePeriodEnded(activeCycle.endDate)) {
        const closed = await this.closeAndAdvanceInTransaction(
          manager,
          project,
          activeCycle,
        );
        archivedTaskIds.push(...closed.archivedTaskIds);
        activeCycle = await cycleRepo.findOne({
          where: {
            projectId: project.id,
            status: BoardCycleStatus.ACTIVE,
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (!activeCycle) {
          return this.bootstrapProjectCycles(manager, project);
        }
      }

      return activeCycle;
    });

    await this.purgeArchivedTaskEvidence(archivedTaskIds);
    return activeCycle;
  }

  private async bootstrapProjectCycles(
    manager: EntityManager,
    project: Project,
  ): Promise<BoardCycle> {
    const cycleRepo = manager.getRepository(BoardCycle);
    const currentBounds = getProjectAnchoredCycleBounds(
      project.createdAt,
      new Date(),
    );
    let bounds = getProjectAnchoredCycleBounds(
      project.createdAt,
      project.createdAt,
    );

    while (compareDateStrings(bounds.endDate, currentBounds.startDate) < 0) {
      await this.createClosedEmptyCycle(manager, project, bounds);
      bounds = getNextCycleBounds(bounds.endDate);
    }

    const activeCycle = cycleRepo.create({
      organizationId: project.organizationId,
      projectId: project.id,
      startDate: currentBounds.startDate,
      endDate: currentBounds.endDate,
      status: BoardCycleStatus.ACTIVE,
    });
    return cycleRepo.save(activeCycle);
  }

  private async createClosedEmptyCycle(
    manager: EntityManager,
    project: Project,
    bounds: { startDate: string; endDate: string },
  ): Promise<BoardCycle> {
    const cycleRepo = manager.getRepository(BoardCycle);
    const closedAt = new Date(`${bounds.endDate}T23:59:59.000Z`);
    const cycle = cycleRepo.create({
      organizationId: project.organizationId,
      projectId: project.id,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      status: BoardCycleStatus.CLOSED,
      closedAt,
    });
    return cycleRepo.save(cycle);
  }

  private async closeAndAdvanceInTransaction(
    manager: EntityManager,
    project: Project,
    activeCycle: BoardCycle,
  ): Promise<{
    response: AdvanceBoardCycleResponse;
    archivedTaskIds: string[];
  }> {
    const cycleRepo = manager.getRepository(BoardCycle);
    const historyRepo = manager.getRepository(BoardCycleHistoryEntry);
    const taskRepo = manager.getRepository(Task);

    const projectTasks = await taskRepo.find({
      where: { projectId: project.id },
    });
    const archivalCandidates = selectTasksForArchival(projectTasks);
    const archivedAt = new Date();

    for (const task of archivalCandidates) {
      await historyRepo
        .createQueryBuilder()
        .insert()
        .into(BoardCycleHistoryEntry)
        .values({
          cycleId: activeCycle.id,
          organizationId: project.organizationId,
          projectId: project.id,
          taskId: task.id,
          parentTaskId: task.parentTaskId,
          displayId: formatTaskDisplayId(project.acronym, task.taskNumber),
          taskNumber: task.taskNumber,
          title: task.title,
          status: task.status,
          completedAt: task.updatedAt,
          completionTimestampSource:
            COMPLETION_TIMESTAMP_SOURCE_TASK_UPDATED_AT,
          archivedAt,
        })
        .orIgnore()
        .execute();
    }

    if (archivalCandidates.length > 0) {
      await taskRepo
        .createQueryBuilder()
        .update(Task)
        .set({ archivedInCycleId: activeCycle.id })
        .where('project_id = :projectId', { projectId: project.id })
        .andWhere('status = :status', { status: TaskStatus.DONE })
        .andWhere('archived_in_cycle_id IS NULL')
        .execute();
    }

    activeCycle.status = BoardCycleStatus.CLOSED;
    activeCycle.closedAt = archivedAt;
    await cycleRepo.save(activeCycle);

    const nextBounds = getNextCycleBounds(activeCycle.endDate);
    const nextCycle = cycleRepo.create({
      organizationId: project.organizationId,
      projectId: project.id,
      startDate: nextBounds.startDate,
      endDate: nextBounds.endDate,
      status: BoardCycleStatus.ACTIVE,
    });
    const savedNextCycle = await cycleRepo.save(nextCycle);

    return {
      response: {
        closedCycle: this.toCycleResponse(activeCycle),
        nextCycle: this.toCycleResponse(savedNextCycle),
        archivedCount: archivalCandidates.length,
      },
      archivedTaskIds: archivalCandidates.map((task) => task.id),
    };
  }

  private async purgeArchivedTaskEvidence(taskIds: string[]): Promise<void> {
    const uniqueTaskIds = [...new Set(taskIds)];
    for (const taskId of uniqueTaskIds) {
      try {
        await this.evidenceService.cleanupForTask(taskId);
      } catch (error) {
        this.logger.warn(
          `Failed to purge QA evidence for archived task ${taskId}: ${String(error)}`,
        );
      }
    }
  }

  private toCycleResponse(cycle: BoardCycle): BoardCycleResponse {
    return {
      id: cycle.id,
      organizationId: cycle.organizationId,
      projectId: cycle.projectId,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      status: cycle.status,
      closedAt: cycle.closedAt ? cycle.closedAt.toISOString() : null,
      createdAt: cycle.createdAt.toISOString(),
      updatedAt: cycle.updatedAt.toISOString(),
    };
  }

  private toHistoryEntryResponse(
    entry: BoardCycleHistoryEntry,
  ): BoardCycleHistoryEntryResponse {
    return {
      id: entry.id,
      cycleId: entry.cycleId,
      organizationId: entry.organizationId,
      projectId: entry.projectId,
      taskId: entry.taskId,
      parentTaskId: entry.parentTaskId,
      displayId: entry.displayId,
      taskNumber: entry.taskNumber,
      title: entry.title,
      status: entry.status,
      completedAt: entry.completedAt.toISOString(),
      completionTimestampSource: entry.completionTimestampSource,
      archivedAt: entry.archivedAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
