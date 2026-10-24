import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { nextCopy } from '../storage/media-quota.util';
import { MinioStorageService } from '../storage/minio-storage.service';
import {
  ProjectVideo,
  ProjectVideoFiles,
} from '../videos/project-video.entity';
import { VideoFileKind } from '../videos/video-files';
import { TaskEvidence } from './task-evidence.entity';
import { TaskEvidenceService } from './task-evidence.service';
import { TaskLogService } from './task-log.service';

const VIDEO_MEDIA_KINDS: VideoFileKind[] = [
  'recording',
  'export',
  'background',
];

type PromoteCandidate = {
  id: string;
  sizeBytes: number;
  createdAt: Date;
  objectKey: string;
  source: 'evidence' | 'video';
  videoId?: string;
  kind?: VideoFileKind;
};

@Injectable()
export class EvidenceRetentionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(EvidenceRetentionSchedulerService.name);
  private readonly intervalMs = 60 * 60 * 1000;

  constructor(
    private readonly evidenceService: TaskEvidenceService,
    private readonly logService: TaskLogService,
    private readonly storageService: MinioStorageService,
    @InjectRepository(TaskEvidence)
    private readonly evidenceRepository: Repository<TaskEvidence>,
    @InjectRepository(ProjectVideo)
    private readonly videoRepository: Repository<ProjectVideo>,
  ) {}

  onModuleInit(): void {
    void this.tick();
    setInterval(() => void this.tick(), this.intervalMs);
  }

  private async tick(): Promise<void> {
    try {
      const deleted = await this.evidenceService.cleanupExpiredEvidence();
      if (deleted > 0) {
        this.logger.log(
          `Evidence retention tick removed ${deleted} expired file(s)`,
        );
      }
    } catch (error) {
      this.logger.error('Evidence retention tick failed', error);
    }

    try {
      const deleted = await this.logService.cleanupExpiredLogs();
      if (deleted > 0) {
        this.logger.log(
          `Session-log retention tick removed ${deleted} expired file(s)`,
        );
      }
    } catch (error) {
      this.logger.error('Session-log retention tick failed', error);
    }

    try {
      const copied = await this.promoteFittingMinioMedia();
      if (copied > 0) {
        this.logger.log(
          `Copied ${copied} MinIO image/video file(s) to Cloudflare`,
        );
      }
    } catch (error) {
      this.logger.error('MinIO-to-R2 media copy failed', error);
    }
  }

  private async promoteFittingMinioMedia(): Promise<number> {
    if (!this.storageService.isR2Configured()) {
      return 0;
    }

    const r2Bucket = this.storageService.getR2Bucket();
    const minioBucket = this.storageService.getBucket();
    const candidates = await this.listMinioMediaCandidates(r2Bucket, minioBucket);
    if (candidates.length === 0) {
      return 0;
    }

    return this.storageService.withMediaQuotaLock(async () => {
      let usedBytes = await this.storageService.sumCloudflareBytes();
      const remaining = [...candidates];
      let copied = 0;

      while (remaining.length > 0) {
        const pick = nextCopy(remaining, usedBytes);
        if (!pick) {
          break;
        }
        const candidate = remaining.find((row) => row.id === pick.id);
        remaining.splice(
          remaining.findIndex((row) => row.id === pick.id),
          1,
        );
        if (!candidate) {
          continue;
        }

        try {
          await this.storageService.copyObjectToR2(candidate.objectKey);
          await this.markCopied(candidate, r2Bucket);
          await this.storageService.deleteObject(
            candidate.objectKey,
            minioBucket,
          );
          usedBytes += candidate.sizeBytes;
          copied += 1;
        } catch (error) {
          this.logger.warn(
            `Failed to copy "${candidate.objectKey}" to R2: ${String(error)}`,
          );
        }
      }

      return copied;
    });
  }

  private async listMinioMediaCandidates(
    r2Bucket: string,
    minioBucket: string,
  ): Promise<PromoteCandidate[]> {
    // ponytail: full table scan of evidence + videos hourly; ceiling = every media row in memory; upgrade = SQL WHERE bucket <> r2 ORDER BY created_at DESC LIMIT
    const evidenceRows = await this.evidenceRepository.find();
    const videoRows = await this.videoRepository.find();
    const candidates: PromoteCandidate[] = [];

    for (const row of evidenceRows) {
      if (row.bucket === r2Bucket) {
        continue;
      }
      candidates.push({
        id: `evidence:${row.id}`,
        sizeBytes: Number(row.sizeBytes),
        createdAt: row.createdAt,
        objectKey: row.objectKey,
        source: 'evidence',
      });
    }

    for (const video of videoRows) {
      const files = video.files ?? {};
      for (const kind of VIDEO_MEDIA_KINDS) {
        const entry = files[kind];
        if (!entry?.objectKey) {
          continue;
        }
        if ((entry.bucket ?? minioBucket) === r2Bucket) {
          continue;
        }
        candidates.push({
          id: `video:${video.id}:${kind}`,
          sizeBytes: entry.sizeBytes,
          createdAt: new Date(entry.uploadedAt),
          objectKey: entry.objectKey,
          source: 'video',
          videoId: video.id,
          kind,
        });
      }
    }

    candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return candidates;
  }

  private async markCopied(
    candidate: PromoteCandidate,
    r2Bucket: string,
  ): Promise<void> {
    if (candidate.source === 'evidence') {
      const id = candidate.id.slice('evidence:'.length);
      await this.evidenceRepository.update({ id }, { bucket: r2Bucket });
      return;
    }

    if (!candidate.videoId || !candidate.kind) {
      return;
    }
    const video = await this.videoRepository.findOne({
      where: { id: candidate.videoId },
    });
    if (!video) {
      return;
    }
    const files: ProjectVideoFiles = { ...(video.files ?? {}) };
    const entry = files[candidate.kind];
    if (!entry) {
      return;
    }
    files[candidate.kind] = { ...entry, bucket: r2Bucket };
    video.files = files;
    await this.videoRepository.save(video);
  }
}
