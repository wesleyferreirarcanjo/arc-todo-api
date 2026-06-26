import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { MinioStorageService } from '../storage/minio-storage.service';
import {
  buildTaskEvidenceObjectKey,
  contentDispositionFilename,
  newAttachmentId,
} from '../storage/storage.utils';
import { TaskEvidence } from './task-evidence.entity';
import { TasksService } from './tasks.service';

const ALLOWED_MIME_PREFIXES = ['image/', 'video/'];

export interface TaskEvidenceResponse {
  id: string;
  taskId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: string;
}

interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class TaskEvidenceService {
  constructor(
    @InjectRepository(TaskEvidence)
    private readonly evidenceRepository: Repository<TaskEvidence>,
    private readonly tasksService: TasksService,
    private readonly storageService: MinioStorageService,
  ) {}

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
  ): Promise<TaskEvidenceResponse> {
    await this.tasksService.findOne(userId, orgId, projectId, taskId);
    this.validateFile(file);

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

  private toResponse(evidence: TaskEvidence): TaskEvidenceResponse {
    return {
      id: evidence.id,
      taskId: evidence.taskId,
      originalFilename: evidence.originalFilename,
      mimeType: evidence.mimeType,
      sizeBytes: Number(evidence.sizeBytes),
      uploadedById: evidence.uploadedById,
      createdAt: evidence.createdAt.toISOString(),
    };
  }
}
