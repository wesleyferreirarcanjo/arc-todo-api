import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { formatTaskDisplayId } from '../common/utils/acronym.util';
import { ProjectsService } from '../projects/projects.service';
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
  getNextWeekBounds,
  getWeekBounds,
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
  constructor(
    @InjectRepository(BoardCycle)
    private readonly cyclesRepository: Repository<BoardCycle>,
    @InjectRepository(BoardCycleHistoryEntry)
    private readonly historyRepository: Repository<BoardCycleHistoryEntry>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
    private readonly dataSource: DataSource,
  ) {}

  async getCurrentCycle(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<CurrentBoardCycleResponse> {
    await this.projectsService.findOne(userId, orgId, projectId);
    const cycle = await this.ensureActiveCycle(orgId, projectId);
    const tasks = await this.tasksService.findAll(userId, orgId, projectId);
    return {
      cycle: this.toCycleResponse(cycle),
      tasks,
    };
  }

  async advanceCycle(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<AdvanceBoardCycleResponse> {
    await this.projectsService.findOne(userId, orgId, projectId);

    return this.dataSource.transaction(async (manager) => {
      const cycleRepo = manager.getRepository(BoardCycle);
      const historyRepo = manager.getRepository(BoardCycleHistoryEntry);
      const taskRepo = manager.getRepository(Task);

      let activeCycle = await cycleRepo.findOne({
        where: {
          projectId,
          status: BoardCycleStatus.ACTIVE,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!activeCycle) {
        activeCycle = await this.createActiveCycleInTransaction(
          manager,
          orgId,
          projectId,
        );
      }

      const project = await this.projectsService.findOne(
        userId,
        orgId,
        projectId,
      );
      const projectTasks = await taskRepo.find({
        where: { projectId },
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
            organizationId: orgId,
            projectId,
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
          .where('project_id = :projectId', { projectId })
          .andWhere('status = :status', { status: TaskStatus.DONE })
          .andWhere('archived_in_cycle_id IS NULL')
          .execute();
      }

      activeCycle.status = BoardCycleStatus.CLOSED;
      activeCycle.closedAt = archivedAt;
      await cycleRepo.save(activeCycle);

      const nextBounds = getNextWeekBounds(activeCycle.endDate);
      const nextCycle = cycleRepo.create({
        organizationId: orgId,
        projectId,
        startDate: nextBounds.startDate,
        endDate: nextBounds.endDate,
        status: BoardCycleStatus.ACTIVE,
      });
      const savedNextCycle = await cycleRepo.save(nextCycle);

      return {
        closedCycle: this.toCycleResponse(activeCycle),
        nextCycle: this.toCycleResponse(savedNextCycle),
        archivedCount: archivalCandidates.length,
      };
    });
  }

  async getHistory(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<BoardCycleHistoryResponse> {
    await this.projectsService.findOne(userId, orgId, projectId);

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

  private async ensureActiveCycle(
    orgId: string,
    projectId: string,
  ): Promise<BoardCycle> {
    const existing = await this.cyclesRepository.findOne({
      where: {
        projectId,
        status: BoardCycleStatus.ACTIVE,
      },
    });
    if (existing) {
      return existing;
    }

    return this.dataSource.transaction(async (manager) => {
      const cycleRepo = manager.getRepository(BoardCycle);
      const locked = await cycleRepo.findOne({
        where: {
          projectId,
          status: BoardCycleStatus.ACTIVE,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (locked) {
        return locked;
      }
      return this.createActiveCycleInTransaction(manager, orgId, projectId);
    });
  }

  private async createActiveCycleInTransaction(
    manager: EntityManager,
    orgId: string,
    projectId: string,
  ): Promise<BoardCycle> {
    const cycleRepo = manager.getRepository(BoardCycle);
    const bounds = getWeekBounds(new Date());
    const cycle = cycleRepo.create({
      organizationId: orgId,
      projectId,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      status: BoardCycleStatus.ACTIVE,
    });
    return cycleRepo.save(cycle);
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
