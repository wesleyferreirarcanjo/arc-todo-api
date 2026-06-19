import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

export interface StoredObjectStat {
  size: number;
  contentType: string;
}

@Injectable()
export class MinioStorageService implements OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private client!: Minio.Client;
  private bucket!: string;

  constructor(private readonly configService: ConfigService) {}

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
  }

  getBucket(): string {
    return this.bucket;
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
  ): Promise<void> {
    await this.client.putObject(this.bucket, objectKey, buffer, buffer.length, {
      'Content-Type': contentType,
    });
  }

  async getObjectStream(objectKey: string): Promise<{
    stream: Readable;
    stat: StoredObjectStat;
  }> {
    const stat = await this.client.statObject(this.bucket, objectKey);
    const stream = await this.client.getObject(this.bucket, objectKey);
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

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }

  async deleteObjects(objectKeys: string[]): Promise<void> {
    if (objectKeys.length === 0) return;

    await Promise.all(
      objectKeys.map(async (objectKey) => {
        try {
          await this.deleteObject(objectKey);
        } catch (error) {
          this.logger.warn(
            `Failed to delete MinIO object "${objectKey}": ${String(error)}`,
          );
        }
      }),
    );
  }
}
