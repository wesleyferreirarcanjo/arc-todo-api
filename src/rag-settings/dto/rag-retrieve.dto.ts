import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class RagRetrieveDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;

  @IsOptional()
  @IsInt()
  @Min(256)
  @Max(32000)
  maxContextTokens?: number;

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

export class RagProjectRetrieveDto extends RagRetrieveDto {
  @IsUUID()
  organizationId: string;

  @IsUUID()
  projectId: string;
}

export class RagTokenEstimateDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsOptional()
  @IsString()
  mode?: 'general' | 'project';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;

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
  @Min(256)
  @Max(32000)
  maxContextTokens?: number;

  @IsOptional()
  @IsBoolean()
  deepseekEnabled?: boolean;

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
