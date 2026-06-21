import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateRagSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(64)
  @Max(8192)
  chunkSizeTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2048)
  chunkOverlapTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topKDefault?: number;

  @IsOptional()
  @IsInt()
  @Min(256)
  @Max(32000)
  maxContextTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(1024)
  maxFileBytesForIndexing?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledMimeTypes?: string[];

  @IsOptional()
  @IsBoolean()
  workerEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  workerConcurrency?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  jobBatchSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  minSecondsBetweenJobs?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  maxChunksPerJob?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(3600)
  retryBackoffSeconds?: number;

  @IsOptional()
  @IsString()
  embeddingProvider?: string;

  @IsOptional()
  @IsString()
  embeddingModel?: string;

  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(4096)
  embeddingDimensions?: number;

  @IsOptional()
  @IsBoolean()
  deepseekEnabled?: boolean;

  @IsOptional()
  @IsString()
  deepseekBaseUrl?: string;

  @IsOptional()
  @IsString()
  deepseekModel?: string;

  @IsOptional()
  @IsString()
  deepseekApiKey?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  deepseekTemperature?: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(8000)
  deepseekMaxHelperTokens?: number;

  @IsOptional()
  @IsBoolean()
  deepseekUseQueryRewrite?: boolean;

  @IsOptional()
  @IsBoolean()
  deepseekUseRerank?: boolean;

  @IsOptional()
  @IsBoolean()
  deepseekUseCompression?: boolean;
}
