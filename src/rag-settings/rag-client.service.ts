import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import type {
  RagProjectRetrieveDto,
  RagRetrieveDto,
  RagTokenEstimateDto,
} from './dto/rag-retrieve.dto';

export interface RagIndexJobSummary {
  id: string;
  jobType: string;
  knowledgeEntryId: string | null;
  attachmentId: string | null;
  status: string;
  lastError: string | null;
  pipelineStep: number;
  pipelineSteps: string[];
  chunkCount: number;
}

export interface AttachmentIndexMetadata {
  indexStatus: 'queued' | 'processing' | 'completed' | 'failed' | 'unavailable';
  indexPipelineStep:
    | 'queued'
    | 'extracting'
    | 'chunking'
    | 'embedding'
    | 'indexed'
    | null;
  chunkCount: number;
  tokenCount: number;
  lastIndexError: string | null;
}

@Injectable()
export class RagClientService {
  private readonly logger = new Logger(RagClientService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  private getBaseUrl(): string | null {
    const configured = this.configService.get<string>('ARC_TODO_RAG_BASE_URL');
    return configured?.trim() || null;
  }

  isConfigured(): boolean {
    return Boolean(this.getBaseUrl());
  }

  async enqueueEntryIndex(knowledgeEntryId: string): Promise<void> {
    await this.enqueueJob({
      jobType: 'entry',
      knowledgeEntryId,
    });
  }

  async enqueueAttachmentIndex(
    knowledgeEntryId: string,
    attachmentId: string,
  ): Promise<void> {
    await this.enqueueJob({
      jobType: 'attachment',
      knowledgeEntryId,
      attachmentId,
    });
  }

  retrieveGeneral(dto: RagRetrieveDto): Promise<unknown> {
    return this.requestRag('/retrieve/general', { method: 'POST', body: dto });
  }

  retrieveProject(dto: RagProjectRetrieveDto): Promise<unknown> {
    return this.requestRag('/retrieve/project', { method: 'POST', body: dto });
  }

  estimateTokens(dto: RagTokenEstimateDto): Promise<unknown> {
    return this.requestRag('/tokens/estimate', { method: 'POST', body: dto });
  }

  syncIndex(): Promise<unknown> {
    return this.requestRag('/index/sync', { method: 'POST', body: {} });
  }

  listJobs(): Promise<unknown> {
    return this.requestRag('/index/jobs');
  }

  getIndexStatus(): Promise<unknown> {
    return this.requestRag('/index/status');
  }

  async getAttachmentIndexMetadata(
    knowledgeEntryId: string,
    attachmentId: string,
  ): Promise<AttachmentIndexMetadata> {
    if (!this.getBaseUrl()) {
      return this.unavailableAttachmentMetadata();
    }

    try {
      const [aggregate, jobs] = await Promise.all([
        this.aggregateChunks({ knowledgeEntryId, attachmentId }),
        this.listIndexJobs(),
      ]);
      return this.buildAttachmentMetadata(
        knowledgeEntryId,
        attachmentId,
        aggregate,
        jobs,
      );
    } catch {
      return this.unavailableAttachmentMetadata();
    }
  }

  async enrichAttachmentResponses(
    knowledgeEntryId: string,
    attachments: Array<{ id: string }>,
  ): Promise<Map<string, AttachmentIndexMetadata>> {
    const metadata = new Map<string, AttachmentIndexMetadata>();
    if (attachments.length === 0) {
      return metadata;
    }

    if (!this.getBaseUrl()) {
      for (const attachment of attachments) {
        metadata.set(attachment.id, this.unavailableAttachmentMetadata());
      }
      return metadata;
    }

    const jobs = await this.listIndexJobs();
    await Promise.all(
      attachments.map(async (attachment) => {
        const aggregate = await this.aggregateChunks({
          knowledgeEntryId,
          attachmentId: attachment.id,
        });
        metadata.set(
          attachment.id,
          this.buildAttachmentMetadata(
            knowledgeEntryId,
            attachment.id,
            aggregate,
            jobs,
          ),
        );
      }),
    );

    return metadata;
  }

  listChunks(query: {
    limit?: number;
    offset?: number;
    scope?: string;
    organizationId?: string;
    projectId?: string;
    personId?: string;
    knowledgeEntryId?: string;
    attachmentId?: string;
    mimeType?: string;
  }): Promise<unknown> {
    const params = new URLSearchParams();
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.offset !== undefined) params.set('offset', String(query.offset));
    if (query.scope) params.set('scope', query.scope);
    if (query.organizationId) params.set('organizationId', query.organizationId);
    if (query.projectId) params.set('projectId', query.projectId);
    if (query.personId) params.set('personId', query.personId);
    if (query.knowledgeEntryId) params.set('knowledgeEntryId', query.knowledgeEntryId);
    if (query.attachmentId) params.set('attachmentId', query.attachmentId);
    if (query.mimeType) params.set('mimeType', query.mimeType);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.requestRag(`/chunks${suffix}`);
  }

  aggregateChunks(query: {
    knowledgeEntryId?: string;
    attachmentId?: string;
  }): Promise<{ totalChunks: number; totalTokens: number } | null> {
    const params = new URLSearchParams();
    if (query.knowledgeEntryId) {
      params.set('knowledgeEntryId', query.knowledgeEntryId);
    }
    if (query.attachmentId) params.set('attachmentId', query.attachmentId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.requestRag<{ totalChunks: number; totalTokens: number }>(
      `/chunks/aggregate${suffix}`,
      { throwOnError: false },
    ).catch(() => null);
  }

  listIndexJobs(): Promise<RagIndexJobSummary[]> {
    return this.requestRag<RagIndexJobSummary[]>('/index/jobs', {
      throwOnError: false,
    }).catch(() => []);
  }

  private unavailableAttachmentMetadata(): AttachmentIndexMetadata {
    return {
      indexStatus: 'unavailable',
      indexPipelineStep: null,
      chunkCount: 0,
      tokenCount: 0,
      lastIndexError: null,
    };
  }

  private buildAttachmentMetadata(
    knowledgeEntryId: string,
    attachmentId: string,
    aggregate: { totalChunks: number; totalTokens: number } | null,
    jobs: RagIndexJobSummary[],
  ): AttachmentIndexMetadata {
    const chunkCount = aggregate?.totalChunks ?? 0;
    const tokenCount = aggregate?.totalTokens ?? 0;
    const job = jobs.find(
      (item) =>
        item.attachmentId === attachmentId &&
        item.knowledgeEntryId === knowledgeEntryId,
    );

    if (!job) {
      if (chunkCount > 0) {
        return {
          indexStatus: 'completed',
          indexPipelineStep: 'indexed',
          chunkCount,
          tokenCount,
          lastIndexError: null,
        };
      }
      return this.unavailableAttachmentMetadata();
    }

    const pipelineStep =
      job.pipelineStep >= 0 && job.pipelineStep < job.pipelineSteps.length
        ? (job.pipelineSteps[
            job.pipelineStep
          ] as AttachmentIndexMetadata['indexPipelineStep'])
        : null;

    let indexStatus: AttachmentIndexMetadata['indexStatus'] = 'unavailable';
    if (job.status === 'queued') indexStatus = 'queued';
    if (job.status === 'processing') indexStatus = 'processing';
    if (job.status === 'completed') indexStatus = 'completed';
    if (job.status === 'failed') indexStatus = 'failed';

    return {
      indexStatus,
      indexPipelineStep: pipelineStep,
      chunkCount: Math.max(chunkCount, job.chunkCount ?? 0),
      tokenCount,
      lastIndexError: job.lastError,
    };
  }

  private async enqueueJob(input: {
    jobType: string;
    knowledgeEntryId: string;
    attachmentId?: string;
  }): Promise<void> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return;
    }

    try {
      await this.requestRag('/index/jobs', {
        method: 'POST',
        body: {
          jobType: input.jobType,
          knowledgeEntryId: input.knowledgeEntryId,
          attachmentId: input.attachmentId,
        },
        throwOnError: false,
      });
    } catch (error) {
      this.logger.warn(`Failed to enqueue RAG job: ${String(error)}`);
    }
  }

  private async requestRag<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      throwOnError?: boolean;
    } = {},
  ): Promise<T> {
    const throwOnError = options.throwOnError ?? true;
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      if (throwOnError) {
        throw new ServiceUnavailableException('RAG service is not configured');
      }
      throw new Error('RAG service is not configured');
    }

    try {
      const token = await this.getServiceToken();
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        let message = `RAG request failed (${response.status})`;
        try {
          const data = (await response.json()) as {
            detail?: string;
            message?: string;
          };
          message = data.detail ?? data.message ?? message;
        } catch {
          // ignore
        }
        if (throwOnError) {
          throw new HttpException(message, response.status);
        }
        throw new Error(message);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (throwOnError) {
        throw new ServiceUnavailableException('RAG service unavailable');
      }
      throw error;
    }
  }

  private async getServiceToken(): Promise<string> {
    const username = this.configService.get<string>('ADMIN_USERNAME', 'admin');
    const password = this.configService.get<string>(
      'ADMIN_PASSWORD',
      'admin123',
    );
    const result = await this.authService.login({ username, password });
    return result.access_token;
  }
}
