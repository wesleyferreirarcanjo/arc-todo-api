import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { ProjectsService } from '../projects/projects.service';
import { MinioStorageService } from '../storage/minio-storage.service';
import {
  buildProjectVideoObjectKey,
  contentDispositionFilename,
} from '../storage/storage.utils';
import { CreateProjectVideoDto } from './dto/create-project-video.dto';
import { UpdateProjectVideoDto } from './dto/update-project-video.dto';
import {
  ProjectVideo,
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
    const objectKeys = Object.values(video.files ?? {})
      .map((entry) => entry?.objectKey)
      .filter((key): key is string => Boolean(key));
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

    // ponytail: whole upload buffered in memory (FileInterceptor + putObject(buffer)); ceiling = MINIO_MAX_UPLOAD_BYTES per request; upgrade = stream multipart to MinIO
    await this.storageService
      .putObject(objectKey, file.buffer, file.mimetype)
      .catch(() => {
        throw appError('FILE_STORAGE_UNAVAILABLE');
      });

    const files: ProjectVideoFiles = { ...(video.files ?? {}) };
    const staleKeys: string[] = [];

    const previous = files[kind];
    if (previous && previous.objectKey !== objectKey) {
      staleKeys.push(previous.objectKey);
    }

    if (kind === 'recording') {
      for (const staleKind of ['cursor', 'export'] as const) {
        const stale = files[staleKind];
        if (stale) {
          staleKeys.push(stale.objectKey);
          delete files[staleKind];
        }
      }
      const parsed = Number(durationMs);
      video.durationMs = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      video.editState = null;
    }

    if (staleKeys.length > 0) {
      await this.storageService.deleteObjects(staleKeys);
    }

    files[kind] = {
      objectKey,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
    };
    video.files = files;

    return this.toResponse(await this.videoRepository.save(video));
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
