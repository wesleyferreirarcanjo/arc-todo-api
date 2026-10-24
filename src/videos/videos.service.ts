import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { ProjectsService } from '../projects/projects.service';
import { mediaFits } from '../storage/media-quota.util';
import { MinioStorageService } from '../storage/minio-storage.service';
import {
  buildProjectVideoObjectKey,
  contentDispositionFilename,
} from '../storage/storage.utils';
import { CreateProjectVideoDto } from './dto/create-project-video.dto';
import { UpdateProjectVideoDto } from './dto/update-project-video.dto';
import {
  ProjectVideo,
  ProjectVideoFileEntry,
  ProjectVideoFiles,
} from './project-video.entity';
import { assertVideoEditState } from './video-edit-state';
import {
  baseMime,
  extensionFor,
  isVideoFileKind,
  VIDEO_FILE_RULES,
  VideoFileKind,
} from './video-files';

export interface ProjectVideoSummary {
  id: string;
  title: string;
  durationMs: number | null;
  hasRecording: boolean;
  hasExport: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectVideoFileResponse {
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface ProjectVideoResponse extends ProjectVideoSummary {
  editState: Record<string, unknown> | null;
  files: Partial<Record<VideoFileKind, ProjectVideoFileResponse>>;
}

interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(ProjectVideo)
    private readonly videoRepository: Repository<ProjectVideo>,
    private readonly projectsService: ProjectsService,
    private readonly storageService: MinioStorageService,
  ) {}

  private requireTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) {
      throw appError('VIDEO_TITLE_REQUIRED');
    }
    return trimmed;
  }

  private async findVideo(
    userId: string,
    orgId: string,
    projectId: string,
    videoId: string,
  ): Promise<ProjectVideo> {
    await this.projectsService.findOne(userId, orgId, projectId);
    const video = await this.videoRepository.findOne({
      where: { id: videoId, projectId },
    });
    if (!video) {
      throw appError('VIDEO_NOT_FOUND');
    }
    return video;
  }

  async findAll(
    userId: string,
    orgId: string,
    projectId: string,
  ): Promise<ProjectVideoSummary[]> {
    await this.projectsService.findOne(userId, orgId, projectId);
    const rows = await this.videoRepository.find({
      where: { projectId },
      order: { updatedAt: 'DESC' },
    });
    return rows.map((row) => this.toSummary(row));
  }

  async create(
    userId: string,
    orgId: string,
    projectId: string,
    dto: CreateProjectVideoDto,
  ): Promise<ProjectVideoResponse> {
    await this.projectsService.findOne(userId, orgId, projectId);

    const video = this.videoRepository.create({
      projectId,
      title: this.requireTitle(dto.title),
      createdById: userId,
    });

    return this.toResponse(await this.videoRepository.save(video));
  }

  async findOne(
    userId: string,
    orgId: string,
    projectId: string,
    videoId: string,
  ): Promise<ProjectVideoResponse> {
    return this.toResponse(
      await this.findVideo(userId, orgId, projectId, videoId),
    );
  }

  async update(
    userId: string,
    orgId: string,
    projectId: string,
    videoId: string,
    dto: UpdateProjectVideoDto,
  ): Promise<ProjectVideoResponse> {
    const video = await this.findVideo(userId, orgId, projectId, videoId);

    if (dto.title !== undefined) {
      video.title = this.requireTitle(dto.title);
    }
    if (dto.editState !== undefined) {
      try {
        video.editState = assertVideoEditState(dto.editState);
      } catch {
        throw appError('VIDEO_INVALID_EDIT_STATE');
      }
    }

    return this.toResponse(await this.videoRepository.save(video));
  }

  async remove(
    userId: string,
    orgId: string,
    projectId: string,
    videoId: string,
  ): Promise<void> {
    const video = await this.findVideo(userId, orgId, projectId, videoId);
    const minioBucket = this.storageService.getBucket();
    const objectKeys = Object.values(video.files ?? {})
      .filter((entry): entry is ProjectVideoFileEntry => Boolean(entry?.objectKey))
      .map((entry) => ({
        objectKey: entry.objectKey,
        bucket: entry.bucket ?? minioBucket,
      }));
    await this.storageService.deleteObjects(objectKeys);
    await this.videoRepository.remove(video);
  }

  async uploadFile(
    userId: string,
    orgId: string,
    projectId: string,
    videoId: string,
    kind: string,
    file: UploadedFilePayload | undefined,
    durationMs?: string,
  ): Promise<ProjectVideoResponse> {
    const video = await this.findVideo(userId, orgId, projectId, videoId);

    if (!isVideoFileKind(kind)) {
      throw appError('VIDEO_FILE_KIND');
    }
    if (!file) {
      throw appError('FILE_REQUIRED');
    }
    if (!file.buffer || file.size <= 0) {
      throw appError('FILE_EMPTY');
    }

    const rule = VIDEO_FILE_RULES[kind];
    const mime = baseMime(file.mimetype || '');
    if (!rule.mimeTypes.includes(mime)) {
      throw appError('VIDEO_FILE_TYPE');
    }

    const maxBytes = rule.maxBytes ?? this.storageService.getMaxUploadBytes();
    if (file.size > maxBytes) {
      throw appError('FILE_TOO_LARGE');
    }

    const objectKey = buildProjectVideoObjectKey(
      projectId,
      videoId,
      kind,
      extensionFor(kind, mime),
    );

    const storesOnR2 = kind !== 'cursor';
    if (storesOnR2 && !this.storageService.isR2Configured()) {
      throw appError('FILE_STORAGE_UNAVAILABLE');
    }

    const minioBucket = this.storageService.getBucket();
    const r2Bucket = this.storageService.getR2Bucket();
    const targetBucket = storesOnR2 ? r2Bucket : minioBucket;

    const saveUpload = async (): Promise<ProjectVideoResponse> => {
      // ponytail: whole upload buffered in memory (FileInterceptor + putObject(buffer)); ceiling = MINIO_MAX_UPLOAD_BYTES per request; upgrade = stream multipart to MinIO
      await this.storageService
        .putObject(objectKey, file.buffer, file.mimetype, targetBucket)
        .catch(() => {
          throw appError('FILE_STORAGE_UNAVAILABLE');
        });

      const files: ProjectVideoFiles = { ...(video.files ?? {}) };
      const staleRefs: Array<{ objectKey: string; bucket?: string }> = [];

      const previous = files[kind];
      if (
        previous &&
        (previous.objectKey !== objectKey ||
          (previous.bucket ?? minioBucket) !== targetBucket)
      ) {
        staleRefs.push({
          objectKey: previous.objectKey,
          bucket: previous.bucket ?? minioBucket,
        });
      }

      if (kind === 'recording') {
        for (const staleKind of ['cursor', 'export'] as const) {
          const stale = files[staleKind];
          if (stale) {
            staleRefs.push({
              objectKey: stale.objectKey,
              bucket: stale.bucket ?? minioBucket,
            });
            delete files[staleKind];
          }
        }
        const parsed = Number(durationMs);
        video.durationMs = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        video.editState = null;
      }

      if (staleRefs.length > 0) {
        await this.storageService.deleteObjects(staleRefs);
      }

      files[kind] = {
        objectKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        ...(storesOnR2 ? { bucket: r2Bucket } : {}),
      };
      video.files = files;

      return this.toResponse(await this.videoRepository.save(video));
    };

    if (!storesOnR2) {
      return saveUpload();
    }

    return this.storageService.withMediaQuotaLock(async () => {
      const usedBytes = await this.storageService.sumCloudflareBytes();
      const usedAfterFree = Math.max(
        0,
        usedBytes - this.r2BytesFreedByUpload(video, kind),
      );
      if (!mediaFits(usedAfterFree, file.size)) {
        throw appError('FILE_STORAGE_FULL');
      }
      return saveUpload();
    });
  }

  async downloadFile(
    userId: string,
    orgId: string,
    projectId: string,
    videoId: string,
    kind: string,
    res: Response,
  ): Promise<void> {
    const video = await this.findVideo(userId, orgId, projectId, videoId);
    if (!isVideoFileKind(kind)) {
      throw appError('VIDEO_FILE_KIND');
    }
    const entry = video.files?.[kind];
    if (!entry) {
      throw appError('VIDEO_FILE_NOT_FOUND');
    }

    const { stream, stat } = await this.storageService.getObjectStream(
      entry.objectKey,
      entry.bucket ?? this.storageService.getBucket(),
    );

    res.setHeader('Content-Type', entry.mimeType || stat.contentType);
    res.setHeader('Content-Length', stat.size.toString());
    res.setHeader(
      'Content-Disposition',
      contentDispositionFilename(
        `${video.title}-${kind}.${extensionFor(kind, entry.mimeType)}`,
      ),
    );
    // ponytail: no Range; web fetches once into a blob URL. Upgrade = Range via getPartialObject or signed URLs
    stream.pipe(res);
  }

  private r2BytesFreedByUpload(
    video: ProjectVideo,
    kind: VideoFileKind,
  ): number {
    const r2Bucket = this.storageService.getR2Bucket();
    let freed = 0;
    const previous = video.files?.[kind];
    if (previous?.bucket === r2Bucket) {
      freed += previous.sizeBytes;
    }
    if (kind === 'recording') {
      const staleExport = video.files?.export;
      if (staleExport?.bucket === r2Bucket) {
        freed += staleExport.sizeBytes;
      }
    }
    return freed;
  }

  private toSummary(video: ProjectVideo): ProjectVideoSummary {
    const files = video.files ?? {};
    return {
      id: video.id,
      title: video.title,
      durationMs: video.durationMs,
      hasRecording: Boolean(files.recording),
      hasExport: Boolean(files.export),
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
    };
  }

  private toResponse(video: ProjectVideo): ProjectVideoResponse {
    const files: Partial<Record<VideoFileKind, ProjectVideoFileResponse>> = {};
    for (const [kind, entry] of Object.entries(video.files ?? {})) {
      if (!entry) {
        continue;
      }
      files[kind as VideoFileKind] = {
        mimeType: entry.mimeType,
        sizeBytes: entry.sizeBytes,
        uploadedAt: entry.uploadedAt,
      };
    }
    return {
      ...this.toSummary(video),
      editState: video.editState,
      files,
    };
  }
}
