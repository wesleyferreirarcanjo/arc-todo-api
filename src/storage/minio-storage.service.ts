import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';
import { DataSource } from 'typeorm';
import { R2_BUCKET_DEFAULT } from './media-quota.util';

export interface StoredObjectStat {
  size: number;
  contentType: string;
}

export type StoredObjectRef = {
  objectKey: string;
  bucket?: string;
};

const MEDIA_QUOTA_LOCK_KEY_A = 664;
const MEDIA_QUOTA_LOCK_KEY_B = 11;

@Injectable()
export class MinioStorageService implements OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private client!: Minio.Client;
  private r2Client: Minio.Client | null = null;
  private bucket!: string;
  private r2Bucket = R2_BUCKET_DEFAULT;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    const endPoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin');
    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'arc-todo');

    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    await this.ensureBucket();
    await this.initR2Client();
  }

  getBucket(): string {
    return this.bucket;
  }

  getR2Bucket(): string {
    return this.r2Bucket;
  }

  isR2Configured(): boolean {
    return this.r2Client !== null;
  }

  getMaxUploadBytes(): number {
    const configured = this.configService.get<string>('MINIO_MAX_UPLOAD_BYTES');
    if (configured) {
      return parseInt(configured, 10);
    }
    return 100 * 1024 * 1024;
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`Created MinIO bucket "${this.bucket}"`);
    }
  }

  async putObject(
    objectKey: string,
    buffer: Buffer,
    contentType: string,
    bucket?: string,
  ): Promise<void> {
    const { client, name } = this.clientFor(bucket);
    await client.putObject(name, objectKey, buffer, buffer.length, {
      'Content-Type': contentType,
    });
  }

  async getObjectStream(
    objectKey: string,
    bucket?: string,
  ): Promise<{
    stream: Readable;
    stat: StoredObjectStat;
  }> {
    const { client, name } = this.clientFor(bucket);
    const stat = await client.statObject(name, objectKey);
    const stream = await client.getObject(name, objectKey);
    const contentType =
      stat.metaData['content-type'] ??
      stat.metaData['Content-Type'] ??
      'application/octet-stream';

    return {
      stream,
      stat: {
        size: stat.size,
        contentType,
      },
    };
  }

  async deleteObject(objectKey: string, bucket?: string): Promise<void> {
    const { client, name } = this.clientFor(bucket);
    await client.removeObject(name, objectKey);
  }

  async deleteObjects(
    objectKeys: Array<string | StoredObjectRef>,
  ): Promise<void> {
    if (objectKeys.length === 0) return;

    await Promise.all(
      objectKeys.map(async (ref) => {
        const objectKey = typeof ref === 'string' ? ref : ref.objectKey;
        const bucket = typeof ref === 'string' ? undefined : ref.bucket;
        try {
          await this.deleteObject(objectKey, bucket);
        } catch (error) {
          this.logger.warn(
            `Failed to delete object "${objectKey}": ${String(error)}`,
          );
        }
      }),
    );
  }

  async copyObjectToR2(objectKey: string): Promise<void> {
    const { stream, stat } = await this.getObjectStream(objectKey, this.bucket);
    const buffer = await readableToBuffer(stream);
    await this.putObject(objectKey, buffer, stat.contentType, this.r2Bucket);
  }

  async withMediaQuotaLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.dataSource.query('SELECT pg_advisory_lock($1, $2)', [
      MEDIA_QUOTA_LOCK_KEY_A,
      MEDIA_QUOTA_LOCK_KEY_B,
    ]);
    try {
      return await fn();
    } finally {
      await this.dataSource.query('SELECT pg_advisory_unlock($1, $2)', [
        MEDIA_QUOTA_LOCK_KEY_A,
        MEDIA_QUOTA_LOCK_KEY_B,
      ]);
    }
  }

  async sumCloudflareBytes(): Promise<number> {
    const evidence = await this.dataSource.query(
      `SELECT COALESCE(SUM(size_bytes), 0)::text AS total
       FROM task_evidence
       WHERE bucket = $1`,
      [this.r2Bucket],
    );
    const videos = await this.dataSource.query(
      `SELECT COALESCE(SUM((e.value->>'sizeBytes')::bigint), 0)::text AS total
       FROM project_videos v,
            LATERAL jsonb_each(COALESCE(v.files, '{}'::jsonb)) AS e(key, value)
       WHERE e.value->>'bucket' = $1`,
      [this.r2Bucket],
    );
    return Number(evidence[0]?.total ?? 0) + Number(videos[0]?.total ?? 0);
  }

  async sumServerMediaBytes(): Promise<number> {
    const evidence = await this.dataSource.query(
      `SELECT COALESCE(SUM(size_bytes), 0)::text AS total
       FROM task_evidence
       WHERE bucket IS DISTINCT FROM $1`,
      [this.r2Bucket],
    );
    const videos = await this.dataSource.query(
      `SELECT COALESCE(SUM((e.value->>'sizeBytes')::bigint), 0)::text AS total
       FROM project_videos v,
            LATERAL jsonb_each(COALESCE(v.files, '{}'::jsonb)) AS e(key, value)
       WHERE e.key IN ('recording', 'export', 'background')
         AND COALESCE(e.value->>'bucket', $1) IS DISTINCT FROM $2`,
      [this.bucket, this.r2Bucket],
    );
    return Number(evidence[0]?.total ?? 0) + Number(videos[0]?.total ?? 0);
  }

  private async initR2Client(): Promise<void> {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID', '').trim();
    const accessKey = this.configService
      .get<string>('R2_ACCESS_KEY_ID', '')
      .trim();
    const secretKey = this.configService
      .get<string>('R2_SECRET_ACCESS_KEY', '')
      .trim();
    this.r2Bucket =
      this.configService.get<string>('R2_BUCKET', R2_BUCKET_DEFAULT).trim() ||
      R2_BUCKET_DEFAULT;

    if (!accountId || !accessKey || !secretKey) {
      this.logger.warn(
        'R2 is not configured; image and video uploads will be unavailable',
      );
      return;
    }

    this.r2Client = new Minio.Client({
      endPoint: `${accountId}.r2.cloudflarestorage.com`,
      port: 443,
      useSSL: true,
      accessKey,
      secretKey,
      region: 'auto',
    });

    try {
      const exists = await this.r2Client.bucketExists(this.r2Bucket);
      if (!exists) {
        await this.r2Client.makeBucket(this.r2Bucket);
        this.logger.log(`Created R2 bucket "${this.r2Bucket}"`);
      }
    } catch (error) {
      this.logger.warn(
        `Could not ensure R2 bucket "${this.r2Bucket}": ${String(error)}`,
      );
    }
  }

  private clientFor(bucket?: string): { client: Minio.Client; name: string } {
    const name = bucket || this.bucket;
    if (name === this.r2Bucket) {
      if (!this.r2Client) {
        throw new Error('R2 is not configured');
      }
      return { client: this.r2Client, name };
    }
    return { client: this.client, name };
  }
}

async function readableToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
