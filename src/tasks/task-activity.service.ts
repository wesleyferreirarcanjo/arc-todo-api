import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectAccessService } from '../projects/project-access.service';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { TaskComment } from './task-comment.entity';
import { TaskHistoryEntry } from './task-history-entry.entity';
import { TasksService } from './tasks.service';

export interface TaskCommentResponse {
  id: string;
  taskId: string;
  body: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskHistoryEntryResponse {
  id: string;
  taskId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedById: string | null;
  createdAt: string;
}

@Injectable()
export class TaskActivityService {
  constructor(
    @InjectRepository(TaskComment)
    private readonly commentsRepository: Repository<TaskComment>,
    @InjectRepository(TaskHistoryEntry)
    private readonly historyRepository: Repository<TaskHistoryEntry>,
    private readonly tasksService: TasksService,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async findComments(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
  ): Promise<TaskCommentResponse[]> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);

    const comments = await this.commentsRepository.find({
      where: { taskId },
      order: { createdAt: 'ASC' },
    });

    return comments.map((comment) => this.toCommentResponse(comment));
  }

  async createComment(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    dto: CreateTaskCommentDto,
  ): Promise<TaskCommentResponse> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);

    const comment = this.commentsRepository.create({
      taskId,
      body: dto.body.trim(),
      createdById: userId,
    });

    const saved = await this.commentsRepository.save(comment);
    return this.toCommentResponse(saved);
  }

  async updateComment(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    dto: CreateTaskCommentDto,
  ): Promise<TaskCommentResponse> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);
    const comment = await this.findCommentForTask(taskId, commentId);
    await this.assertCanMutateComment(userId, comment);

    comment.body = dto.body.trim();
    const saved = await this.commentsRepository.save(comment);
    return this.toCommentResponse(saved);
  }

  async deleteComment(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    commentId: string,
  ): Promise<void> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);
    const comment = await this.findCommentForTask(taskId, commentId);
    await this.assertCanMutateComment(userId, comment);
    await this.commentsRepository.remove(comment);
  }

  async findHistory(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
  ): Promise<TaskHistoryEntryResponse[]> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);

    const entries = await this.historyRepository.find({
      where: { taskId },
      order: { createdAt: 'DESC' },
    });

    return entries.map((entry) => this.toHistoryResponse(entry));
  }

  private async findCommentForTask(
    taskId: string,
    commentId: string,
  ): Promise<TaskComment> {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId, taskId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  private async assertCanMutateComment(
    userId: string,
    comment: TaskComment,
  ): Promise<void> {
    if (comment.createdById === userId) {
      return;
    }
    if (await this.projectAccessService.isAdmin(userId)) {
      return;
    }
    throw new ForbiddenException(
      'Only the comment author or an admin can modify this comment',
    );
  }

  private toCommentResponse(comment: TaskComment): TaskCommentResponse {
    return {
      id: comment.id,
      taskId: comment.taskId,
      body: comment.body,
      createdById: comment.createdById,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  private toHistoryResponse(entry: TaskHistoryEntry): TaskHistoryEntryResponse {
    return {
      id: entry.id,
      taskId: entry.taskId,
      field: entry.field,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      changedById: entry.changedById,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
