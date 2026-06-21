import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateRagSettingsDto } from './dto/update-rag-settings.dto';
import { RagSetting } from './rag-setting.entity';

export interface RagSettingsResponse {
  enabled: boolean;
  chunkSizeTokens: number;
  chunkOverlapTokens: number;
  topKDefault: number;
  maxContextTokens: number;
  maxFileBytesForIndexing: number;
  enabledMimeTypes: string[];
  workerEnabled: boolean;
  workerConcurrency: number;
  jobBatchSize: number;
  minSecondsBetweenJobs: number;
  maxChunksPerJob: number;
  retryBackoffSeconds: number;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
  deepseekEnabled: boolean;
  deepseekBaseUrl: string;
  deepseekModel: string;
  deepseekTemperature: number;
  deepseekMaxHelperTokens: number;
  deepseekUseQueryRewrite: boolean;
  deepseekUseRerank: boolean;
  deepseekUseCompression: boolean;
  hasDeepseekApiKey: boolean;
}

export interface RagRuntimeSettingsResponse extends RagSettingsResponse {
  deepseekApiKey: string | null;
}

const DEFAULT_SETTINGS: Omit<RagSetting, 'createdAt' | 'updatedAt'> = {
  id: 'default',
  enabled: true,
  chunkSizeTokens: 512,
  chunkOverlapTokens: 64,
  topKDefault: 5,
  maxContextTokens: 4000,
  maxFileBytesForIndexing: '10485760',
  enabledMimeTypes: [
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
  ],
  workerEnabled: true,
  workerConcurrency: 1,
  jobBatchSize: 1,
  minSecondsBetweenJobs: 5,
  maxChunksPerJob: 200,
  retryBackoffSeconds: 30,
  embeddingProvider: 'local',
  embeddingModel: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
  embeddingDimensions: 384,
  deepseekEnabled: false,
  deepseekBaseUrl: 'https://api.deepseek.com',
  deepseekModel: 'deepseek-chat',
  deepseekApiKey: null,
  deepseekTemperature: 0.1,
  deepseekMaxHelperTokens: 500,
  deepseekUseQueryRewrite: false,
  deepseekUseRerank: false,
  deepseekUseCompression: false,
};

@Injectable()
export class RagSettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(RagSetting)
    private readonly settingsRepository: Repository<RagSetting>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  private toPublicResponse(setting: RagSetting): RagSettingsResponse {
    return {
      enabled: setting.enabled,
      chunkSizeTokens: setting.chunkSizeTokens,
      chunkOverlapTokens: setting.chunkOverlapTokens,
      topKDefault: setting.topKDefault,
      maxContextTokens: setting.maxContextTokens,
      maxFileBytesForIndexing: parseInt(setting.maxFileBytesForIndexing, 10),
      enabledMimeTypes: setting.enabledMimeTypes,
      workerEnabled: setting.workerEnabled,
      workerConcurrency: setting.workerConcurrency,
      jobBatchSize: setting.jobBatchSize,
      minSecondsBetweenJobs: setting.minSecondsBetweenJobs,
      maxChunksPerJob: setting.maxChunksPerJob,
      retryBackoffSeconds: setting.retryBackoffSeconds,
      embeddingProvider: setting.embeddingProvider,
      embeddingModel: setting.embeddingModel,
      embeddingDimensions: setting.embeddingDimensions,
      deepseekEnabled: setting.deepseekEnabled,
      deepseekBaseUrl: setting.deepseekBaseUrl,
      deepseekModel: setting.deepseekModel,
      deepseekTemperature: setting.deepseekTemperature,
      deepseekMaxHelperTokens: setting.deepseekMaxHelperTokens,
      deepseekUseQueryRewrite: setting.deepseekUseQueryRewrite,
      deepseekUseRerank: setting.deepseekUseRerank,
      deepseekUseCompression: setting.deepseekUseCompression,
      hasDeepseekApiKey: Boolean(setting.deepseekApiKey),
    };
  }

  private toRuntimeResponse(setting: RagSetting): RagRuntimeSettingsResponse {
    return {
      ...this.toPublicResponse(setting),
      deepseekApiKey: setting.deepseekApiKey,
    };
  }

  private async ensureDefaults() {
    const existing = await this.settingsRepository.findOne({
      where: { id: 'default' },
    });
    if (existing) {
      return;
    }

    const setting = this.settingsRepository.create(DEFAULT_SETTINGS);
    await this.settingsRepository.save(setting);
  }

  async getSettings(): Promise<RagSettingsResponse> {
    const setting = await this.settingsRepository.findOne({
      where: { id: 'default' },
    });
    if (!setting) {
      throw new NotFoundException('RAG settings not found');
    }
    return this.toPublicResponse(setting);
  }

  async getRuntimeSettings(): Promise<RagRuntimeSettingsResponse> {
    const setting = await this.settingsRepository.findOne({
      where: { id: 'default' },
    });
    if (!setting) {
      throw new NotFoundException('RAG settings not found');
    }
    return this.toRuntimeResponse(setting);
  }

  async updateSettings(dto: UpdateRagSettingsDto): Promise<RagSettingsResponse> {
    const setting = await this.settingsRepository.findOne({
      where: { id: 'default' },
    });
    if (!setting) {
      throw new NotFoundException('RAG settings not found');
    }

    if (dto.enabled !== undefined) setting.enabled = dto.enabled;
    if (dto.chunkSizeTokens !== undefined) setting.chunkSizeTokens = dto.chunkSizeTokens;
    if (dto.chunkOverlapTokens !== undefined) {
      setting.chunkOverlapTokens = dto.chunkOverlapTokens;
    }
    if (dto.topKDefault !== undefined) setting.topKDefault = dto.topKDefault;
    if (dto.maxContextTokens !== undefined) setting.maxContextTokens = dto.maxContextTokens;
    if (dto.maxFileBytesForIndexing !== undefined) {
      setting.maxFileBytesForIndexing = String(dto.maxFileBytesForIndexing);
    }
    if (dto.enabledMimeTypes !== undefined) setting.enabledMimeTypes = dto.enabledMimeTypes;
    if (dto.workerEnabled !== undefined) setting.workerEnabled = dto.workerEnabled;
    if (dto.workerConcurrency !== undefined) {
      setting.workerConcurrency = dto.workerConcurrency;
    }
    if (dto.jobBatchSize !== undefined) setting.jobBatchSize = dto.jobBatchSize;
    if (dto.minSecondsBetweenJobs !== undefined) {
      setting.minSecondsBetweenJobs = dto.minSecondsBetweenJobs;
    }
    if (dto.maxChunksPerJob !== undefined) setting.maxChunksPerJob = dto.maxChunksPerJob;
    if (dto.retryBackoffSeconds !== undefined) {
      setting.retryBackoffSeconds = dto.retryBackoffSeconds;
    }
    if (dto.embeddingProvider !== undefined) setting.embeddingProvider = dto.embeddingProvider;
    if (dto.embeddingModel !== undefined) setting.embeddingModel = dto.embeddingModel;
    if (dto.embeddingDimensions !== undefined) {
      setting.embeddingDimensions = dto.embeddingDimensions;
    }
    if (dto.deepseekEnabled !== undefined) setting.deepseekEnabled = dto.deepseekEnabled;
    if (dto.deepseekBaseUrl !== undefined) setting.deepseekBaseUrl = dto.deepseekBaseUrl;
    if (dto.deepseekModel !== undefined) setting.deepseekModel = dto.deepseekModel;
    if (dto.deepseekTemperature !== undefined) {
      setting.deepseekTemperature = dto.deepseekTemperature;
    }
    if (dto.deepseekMaxHelperTokens !== undefined) {
      setting.deepseekMaxHelperTokens = dto.deepseekMaxHelperTokens;
    }
    if (dto.deepseekUseQueryRewrite !== undefined) {
      setting.deepseekUseQueryRewrite = dto.deepseekUseQueryRewrite;
    }
    if (dto.deepseekUseRerank !== undefined) setting.deepseekUseRerank = dto.deepseekUseRerank;
    if (dto.deepseekUseCompression !== undefined) {
      setting.deepseekUseCompression = dto.deepseekUseCompression;
    }
    if (dto.deepseekApiKey !== undefined && dto.deepseekApiKey.trim().length > 0) {
      setting.deepseekApiKey = dto.deepseekApiKey.trim();
    }

    const saved = await this.settingsRepository.save(setting);
    return this.toPublicResponse(saved);
  }
}
