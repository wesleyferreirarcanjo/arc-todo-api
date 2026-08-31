import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { formatTaskDisplayId } from '../common/utils/acronym.util';
import { appError } from '../errors/app-errors';
import { ProjectsService } from '../projects/projects.service';
import { Task } from '../tasks/task.entity';
import { AddQaQueueItemsDto } from './dto/add-qa-queue-items.dto';
import { QaQueueEventsService } from './qa-queue-events.service';
import { QaQueueItem } from './qa-queue-item.entity';
import {
  assertSingleIncomingProject,
  currentProjectIdForUser,
  detectProjectConflict,
  emptyQueueResponse,
  enqueueParentsOnly,
  findDuplicateTaskIds,
  nextPosition,
  normalizeAddItemsDto,
  type QaQueueListResponse,
  validateReorder,
} from './qa-queue.util';

@Injectable()
export class QaQueueService {
  constructor(
    @InjectRepository(QaQueueItem)
    private readonly queueRepository: Repository<QaQueueItem>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly projectsService: ProjectsService,
    private readonly qaQueueEvents: QaQueueEventsService,
  ) {}

  async listForUser(userId: string): Promise<QaQueueListResponse> {
    const rows = await this.loadRows(userId);
    return this.toListResponse(rows);
  }

  async add(
    userId: string,
    dto: AddQaQueueItemsDto,
  ): Promise<QaQueueListResponse> {
    const normalized = normalizeAddItemsDto(dto);
    if (!normalized.ok) {
      throw appError('VAL_REQUEST');
    }

    const tasks = await this.tasksRepository.find({
      where: { id: In(normalized.taskIds) },
      relations: ['project'],
    });
    if (tasks.length !== normalized.taskIds.length) {
      throw appError('TASK_NOT_FOUND');
    }

    const byId = new Map(tasks.map((task) => [task.id, task]));
    const orderedTasks = normalized.taskIds.map((id) => byId.get(id)!);
    if (!enqueueParentsOnly(orderedTasks)) {
      throw appError('VAL_REQUEST');
    }
    const projectCheck = assertSingleIncomingProject(
      orderedTasks.map((task) => task.projectId),
    );
    if (!projectCheck.ok) {
      throw appError('VAL_REQUEST');
    }

    const sample = orderedTasks[0];
    const organizationId = sample.project?.organizationId;
    if (!organizationId) {
      throw appError('PROJ_MISSING_FOR_TASK');
    }
    await this.projectsService.findOne(
      userId,
      organizationId,
      sample.projectId,
    );

    const result = await this.queueRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(QaQueueItem);
      const existing = await repo.find({
        where: { userId },
        order: { position: 'ASC' },
      });
      const conflict = detectProjectConflict(
        currentProjectIdForUser(existing),
        sample.projectId,
        normalized.replaceProject,
      );
      if (conflict.kind === 'conflict') {
        throw appError('QA_QUEUE_PROJECT_CONFLICT', undefined, {
          currentProjectId: conflict.currentProjectId,
        });
      }
      if (conflict.kind === 'replace') {
        await repo.delete({ userId });
      }

      const remaining =
        conflict.kind === 'replace'
          ? []
          : existing;
      const duplicates = findDuplicateTaskIds(
        remaining.map((row) => row.taskId),
        normalized.taskIds,
      );
      if (duplicates.length > 0) {
        throw appError('QA_QUEUE_DUPLICATE');
      }

      let position = nextPosition(
        remaining.length > 0
          ? remaining[remaining.length - 1].position
          : null,
      );
      const created = normalized.taskIds.map((taskId) => {
        const task = byId.get(taskId)!;
        const row = repo.create({
          userId,
          taskId,
          projectId: task.projectId,
          organizationId: task.project.organizationId,
          position,
        });
        position += 1;
        return row;
      });
      await repo.save(created);

      const rows = await repo.find({
        where: { userId },
        relations: ['task', 'task.project'],
        order: { position: 'ASC' },
      });
      return this.toListResponse(rows);
    });
    this.qaQueueEvents.emitQueue(userId, result);
    return result;
  }

  async remove(userId: string, taskId: string): Promise<QaQueueListResponse> {
    const result = await this.queueRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(QaQueueItem);
      const existing = await repo.findOne({ where: { userId, taskId } });
      if (!existing) {
        throw appError('QA_QUEUE_ITEM_NOT_FOUND');
      }
      await repo.delete({ id: existing.id });
      const remaining = await repo.find({
        where: { userId },
        order: { position: 'ASC' },
      });
      await this.rewritePositions(repo, remaining);
      const rows = await repo.find({
        where: { userId },
        relations: ['task', 'task.project'],
        order: { position: 'ASC' },
      });
      return this.toListResponse(rows);
    });
    this.qaQueueEvents.emitQueue(userId, result);
    return result;
  }

  async reorder(
    userId: string,
    itemIds: string[],
  ): Promise<QaQueueListResponse> {
    const result = await this.queueRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(QaQueueItem);
      const existing = await repo.find({
        where: { userId },
        order: { position: 'ASC' },
      });
      if (!validateReorder(existing.map((row) => row.id), itemIds)) {
        throw appError('VAL_REQUEST');
      }
      const byId = new Map(existing.map((row) => [row.id, row]));
      const ordered = itemIds.map((id) => byId.get(id)!);
      await this.rewritePositions(repo, ordered);
      const rows = await repo.find({
        where: { userId },
        relations: ['task', 'task.project'],
        order: { position: 'ASC' },
      });
      return this.toListResponse(rows);
    });
    this.qaQueueEvents.emitQueue(userId, result);
    return result;
  }

  async clear(userId: string): Promise<QaQueueListResponse> {
    await this.queueRepository.delete({ userId });
    const result = emptyQueueResponse();
    this.qaQueueEvents.emitQueue(userId, result);
    return result;
  }

  async removeTaskFromAllQueues(taskId: string): Promise<void> {
    const affected = await this.queueRepository.find({ where: { taskId } });
    if (affected.length === 0) {
      return;
    }
    const userIds = [...new Set(affected.map((row) => row.userId))];
    await this.queueRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(QaQueueItem);
      await repo.delete({ taskId });
      for (const userId of userIds) {
        const remaining = await repo.find({
          where: { userId },
          order: { position: 'ASC' },
        });
        await this.rewritePositions(repo, remaining);
      }
    });
    for (const userId of userIds) {
      this.qaQueueEvents.emitQueue(userId, await this.listForUser(userId));
    }
  }

  private async loadRows(userId: string): Promise<QaQueueItem[]> {
    return this.queueRepository.find({
      where: { userId },
      relations: ['task', 'task.project'],
      order: { position: 'ASC' },
    });
  }

  private async rewritePositions(
    repo: Repository<QaQueueItem>,
    ordered: QaQueueItem[],
  ): Promise<void> {
    for (let i = 0; i < ordered.length; i++) {
      ordered[i].position = -(i + 1);
    }
    if (ordered.length > 0) {
      await repo.save(ordered);
    }
    for (let i = 0; i < ordered.length; i++) {
      ordered[i].position = i;
    }
    if (ordered.length > 0) {
      await repo.save(ordered);
    }
  }

  private toListResponse(rows: QaQueueItem[]): QaQueueListResponse {
    if (rows.length === 0) {
      return emptyQueueResponse();
    }
    return {
      projectId: rows[0].projectId,
      organizationId: rows[0].organizationId,
      items: rows.map((row) => ({
        id: row.id,
        taskId: row.taskId,
        position: row.position,
        displayId: formatTaskDisplayId(
          row.task.project.acronym,
          row.task.taskNumber,
        ),
        title: row.task.title,
        status: row.task.status,
      })),
    };
  }
}
