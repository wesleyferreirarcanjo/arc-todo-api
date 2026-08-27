import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { LessThan, Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { MinioStorageService } from '../storage/minio-storage.service';
import {
  buildTaskLogObjectKey,
  contentDispositionFilename,
  newAttachmentId,
} from '../storage/storage.utils';
import { TaskLog } from './task-log.entity';
import {
  isAllowedLogMime,
  normalizeLogChecklistItemId,
  TASK_LOG_MIME,
} from './task-log.util';
import { TasksService } from './tasks.service';

const DEFAULT_LOG_RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface TaskLogResponse {
  id: string;
  taskId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  checklistItemId: string | null;
  createdAt: string;
}

interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class TaskLogService {
  private readonly logger = new Logger(TaskLogService.name);

  constructor(
    @InjectRepository(TaskLog)
    private readonly logRepository: Repository<TaskLog>,
    private readonly tasksService: TasksService,
    private readonly storageService: MinioStorageService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Same clock as BR-TASK-15 (`EVIDENCE_RETENTION_DAYS`). Session logs are QA
   * artifacts, not a separate retention setting (BR-TASK-20).
   */
  getRetentionDays(): number {
    const raw = this.configService.get<string>(
      'EVIDENCE_RETENTION_DAYS',
      String(DEFAULT_LOG_RETENTION_DAYS),
    );
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return DEFAULT_LOG_RETENTION_DAYS;
    }
    return parsed;
  }

  async cleanupExpiredLogs(): Promise<number> {
    const retentionDays = this.getRetentionDays();
    const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);
    const rows = await this.logRepository.find({
      where: { createdAt: LessThan(cutoff) },
    });
    if (rows.length === 0) {
      return 0;
    }

    await this.storageService.deleteObjects(rows.map((row) => row.objectKey));
    await this.logRepository.remove(rows);
    this.logger.log(
      `Session-log retention: deleted ${rows.length} file(s) older than ${retentionDays} day(s) (before ${cutoff.toISOString()})`,
    );
    return rows.length;
  }

  async list(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
  ): Promise<TaskLogResponse[]> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);
    const rows = await this.logRepository.find({
      where: { taskId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.toResponse(row));
  }

  async upload(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    file: UploadedFilePayload,
    checklistItemId?: string | null,
  ): Promise<TaskLogResponse> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);
    this.validateFile(file);

    const normalizedChecklistItemId = this.normalizeChecklistItemId(
      checklistItemId,
    );

    const logId = newAttachmentId();
    const objectKey = buildTaskLogObjectKey(taskId, logId, file.originalname);
    const bucket = this.storageService.getBucket();

    await this.storageService
      .putObject(objectKey, file.buffer, file.mimetype || TASK_LOG_MIME)
      .catch(() => {
        throw appError('FILE_STORAGE_UNAVAILABLE');
      });

    const log = this.logRepository.create({
      id: logId,
      taskId,
      bucket,
      objectKey,
      originalFilename: file.originalname || 'session-log.json',
      mimeType: file.mimetype || TASK_LOG_MIME,
      sizeBytes: String(file.size),
      uploadedById: userId,
      checklistItemId: normalizedChecklistItemId,
    });

    try {
      const saved = await this.logRepository.save(log);
      return this.toResponse(saved);
    } catch (error) {
      await this.storageService.deleteObject(objectKey);
      throw error;
    }
  }

  async download(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    logId: string,
    res: Response,
  ): Promise<void> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);
    const log = await this.logRepository.findOne({
      where: { id: logId, taskId },
    });
    if (!log) {
      throw appError('FILE_LOG_NOT_FOUND');
    }

    const { stream, stat } = await this.storageService.getObjectStream(
      log.objectKey,
    );

    res.setHeader('Content-Type', log.mimeType || stat.contentType);
    res.setHeader('Content-Length', stat.size.toString());
    res.setHeader(
      'Content-Disposition',
      contentDispositionFilename(log.originalFilename),
    );
    stream.pipe(res);
  }

  async remove(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    logId: string,
  ): Promise<void> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);
    const log = await this.logRepository.findOne({
      where: { id: logId, taskId },
    });
    if (!log) {
      throw appError('FILE_LOG_NOT_FOUND');
    }

    await this.logRepository.remove(log);
    await this.storageService.deleteObject(log.objectKey);
  }

  async cleanupForTask(taskId: string): Promise<void> {
    const rows = await this.logRepository.find({ where: { taskId } });
    if (rows.length === 0) {
      return;
    }

    await this.storageService.deleteObjects(rows.map((row) => row.objectKey));
    await this.logRepository.remove(rows);
  }

  private validateFile(file: UploadedFilePayload): void {
    if (!file) {
      throw appError('FILE_REQUIRED');
    }

    if (!file.buffer || file.size <= 0) {
      throw appError('FILE_EMPTY');
    }

    if (!isAllowedLogMime(file.mimetype)) {
      throw appError('FILE_LOG_TYPE');
    }

    const maxBytes = this.storageService.getMaxUploadBytes();
    if (file.size > maxBytes) {
      throw appError('FILE_TOO_LARGE');
    }
  }

  private normalizeChecklistItemId(
    value: string | null | undefined,
  ): string | null {
    const result = normalizeLogChecklistItemId(value);
    if (!result.ok) {
      throw appError('FILE_CHECKLIST_ID');
    }
    return result.value;
  }

  private toResponse(log: TaskLog): TaskLogResponse {
    return {
      id: log.id,
      taskId: log.taskId,
      originalFilename: log.originalFilename,
      mimeType: log.mimeType,
      sizeBytes: Number(log.sizeBytes),
      uploadedById: log.uploadedById,
      checklistItemId: log.checklistItemId ?? null,
      createdAt: log.createdAt.toISOString(),
    };
  }
}
