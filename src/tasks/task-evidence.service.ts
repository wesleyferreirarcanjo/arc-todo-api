import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { LessThan, Repository } from 'typeorm';
import { MinioStorageService } from '../storage/minio-storage.service';
import {
  buildTaskEvidenceObjectKey,
  contentDispositionFilename,
  newAttachmentId,
} from '../storage/storage.utils';
import { TaskEvidence } from './task-evidence.entity';
import { TasksService } from './tasks.service';

const ALLOWED_MIME_PREFIXES = ['image/', 'video/'];
const DEFAULT_EVIDENCE_RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface TaskEvidenceResponse {
  id: string;
  taskId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  checklistItemId: string | null;
  createdAt: string;
}

export interface EvidenceStorageUsage {
  fileCount: number;
  totalBytes: number;
  retentionDays: number;
  oldestCreatedAt: string | null;
}

interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class TaskEvidenceService {
  private readonly logger = new Logger(TaskEvidenceService.name);

  constructor(
    @InjectRepository(TaskEvidence)
    private readonly evidenceRepository: Repository<TaskEvidence>,
    private readonly tasksService: TasksService,
    private readonly storageService: MinioStorageService,
    private readonly configService: ConfigService,
  ) {}

  getRetentionDays(): number {
    const raw = this.configService.get<string>(
      'EVIDENCE_RETENTION_DAYS',
      String(DEFAULT_EVIDENCE_RETENTION_DAYS),
    );
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return DEFAULT_EVIDENCE_RETENTION_DAYS;
    }
    return parsed;
  }

  async getEvidenceUsage(): Promise<EvidenceStorageUsage> {
    const raw = await this.evidenceRepository
      .createQueryBuilder('e')
      .select('COUNT(*)', 'fileCount')
      .addSelect('COALESCE(SUM(e.size_bytes), 0)', 'totalBytes')
      .addSelect('MIN(e.created_at)', 'oldestCreatedAt')
      .getRawOne<{
        fileCount: string;
        totalBytes: string;
        oldestCreatedAt: Date | string | null;
      }>();

    const oldest = raw?.oldestCreatedAt ?? null;
    let oldestCreatedAt: string | null = null;
    if (oldest) {
      oldestCreatedAt =
        oldest instanceof Date
          ? oldest.toISOString()
          : new Date(oldest).toISOString();
    }

    return {
      fileCount: Number(raw?.fileCount ?? 0),
      totalBytes: Number(raw?.totalBytes ?? 0),
      retentionDays: this.getRetentionDays(),
      oldestCreatedAt,
    };
  }

  /**
   * Age-based retention (BR-TASK-15). Additive to cycle purge (BR-CYCLE-05).
   * Best-effort MinIO deletes; DB rows removed after object delete attempts.
   */
  async cleanupExpiredEvidence(): Promise<number> {
    const retentionDays = this.getRetentionDays();
    const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);
    const rows = await this.evidenceRepository.find({
      where: { createdAt: LessThan(cutoff) },
    });
    if (rows.length === 0) {
      return 0;
    }

    await this.storageService.deleteObjects(rows.map((row) => row.objectKey));
    await this.evidenceRepository.remove(rows);
    this.logger.log(
      `Evidence retention: deleted ${rows.length} file(s) older than ${retentionDays} day(s) (before ${cutoff.toISOString()})`,
    );
    return rows.length;
  }

  async list(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
  ): Promise<TaskEvidenceResponse[]> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);
    const rows = await this.evidenceRepository.find({
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
  ): Promise<TaskEvidenceResponse> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);
    this.validateFile(file);

    const normalizedChecklistItemId = this.normalizeChecklistItemId(
      checklistItemId,
    );

    const evidenceId = newAttachmentId();
    const objectKey = buildTaskEvidenceObjectKey(
      taskId,
      evidenceId,
      file.originalname,
    );
    const bucket = this.storageService.getBucket();

    await this.storageService.putObject(
      objectKey,
      file.buffer,
      file.mimetype || 'application/octet-stream',
    ).catch(() => {
      throw new ServiceUnavailableException(
        'Unable to store evidence file. Check MinIO storage configuration.',
      );
    });

    const evidence = this.evidenceRepository.create({
      id: evidenceId,
      taskId,
      bucket,
      objectKey,
      originalFilename: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: String(file.size),
      uploadedById: userId,
      checklistItemId: normalizedChecklistItemId,
    });

    try {
      const saved = await this.evidenceRepository.save(evidence);
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
    evidenceId: string,
    res: Response,
  ): Promise<void> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId, taskId },
    });
    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    const { stream, stat } = await this.storageService.getObjectStream(
      evidence.objectKey,
    );

    res.setHeader('Content-Type', evidence.mimeType || stat.contentType);
    res.setHeader('Content-Length', stat.size.toString());
    res.setHeader(
      'Content-Disposition',
      contentDispositionFilename(evidence.originalFilename),
    );
    stream.pipe(res);
  }

  async remove(
    userId: string,
    orgId: string,
    projectId: string,
    taskId: string,
    evidenceId: string,
  ): Promise<void> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId, taskId },
    });
    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    await this.evidenceRepository.remove(evidence);
    await this.storageService.deleteObject(evidence.objectKey);
  }

  async cleanupForTask(taskId: string): Promise<void> {
    const rows = await this.evidenceRepository.find({ where: { taskId } });
    if (rows.length === 0) {
      return;
    }

    await this.storageService.deleteObjects(rows.map((row) => row.objectKey));
    await this.evidenceRepository.remove(rows);
  }

  private validateFile(file: UploadedFilePayload): void {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!file.buffer || file.size <= 0) {
      throw new BadRequestException('File cannot be empty');
    }

    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
      throw new BadRequestException(
        'Only image and video files are allowed as QA evidence',
      );
    }

    const maxBytes = this.storageService.getMaxUploadBytes();
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File exceeds maximum upload size of ${maxBytes} bytes`,
      );
    }
  }

  private normalizeChecklistItemId(
    value: string | null | undefined,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = String(value).trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.length > 64) {
      throw new BadRequestException(
        'checklistItemId must be at most 64 characters',
      );
    }
    return trimmed;
  }

  private toResponse(evidence: TaskEvidence): TaskEvidenceResponse {
    return {
      id: evidence.id,
      taskId: evidence.taskId,
      originalFilename: evidence.originalFilename,
      mimeType: evidence.mimeType,
      sizeBytes: Number(evidence.sizeBytes),
      uploadedById: evidence.uploadedById,
      checklistItemId: evidence.checklistItemId ?? null,
      createdAt: evidence.createdAt.toISOString(),
    };
  }
}
