import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CheckNameDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CheckNamesBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  names: string[];
}

export class RecommendNameDto {
  @IsUUID()
  candidateId: string;

  @IsOptional()
  @IsString()
  decisionNote?: string;
}

export class AddNameCandidateItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  family?: string;

  @IsOptional()
  @IsString()
  laneId?: string;

  @IsOptional()
  @IsString()
  rationale?: string;
}

export class AddNameCandidatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AddNameCandidateItemDto)
  candidates: AddNameCandidateItemDto[];

  @IsOptional()
  @IsIn(['human', 'chatbot', 'mcp'])
  source?: 'human' | 'chatbot' | 'mcp';
}

export class StartFeedbackRoundDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  candidateIds: string[];
}

export class FeedbackRatingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  easyToSay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  memorable?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  fitsProduct?: number;
}

export class UpsertCandidateRatingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  overall?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class FeedbackBallotEntryDto {
  @IsUUID()
  candidateId: string;

  @IsIn(['passed', 'liked', 'loved'])
  reaction: 'passed' | 'liked' | 'loved';

  @IsOptional()
  @IsString()
  firstImpression?: string;

  @IsOptional()
  @IsString()
  rememberedSpelling?: string;

  @IsOptional()
  @IsString()
  perceivedPurpose?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FeedbackRatingsDto)
  ratings?: FeedbackRatingsDto;

  @IsOptional()
  @IsString()
  concern?: string;
}

export class UpsertFeedbackResponseDto {
  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @IsIn(['passed', 'liked', 'loved'])
  reaction?: 'passed' | 'liked' | 'loved';

  @IsOptional()
  @IsString()
  firstImpression?: string;

  @IsOptional()
  @IsString()
  rememberedSpelling?: string;

  @IsOptional()
  @IsString()
  perceivedPurpose?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FeedbackRatingsDto)
  ratings?: FeedbackRatingsDto;

  @IsOptional()
  @IsString()
  concern?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FeedbackBallotEntryDto)
  responses?: FeedbackBallotEntryDto[];
}

export class SetCandidateReactionDto {
  @ValidateIf((_, value) => value !== null)
  @IsIn(['passed', 'liked', 'loved'])
  reaction: 'passed' | 'liked' | 'loved' | null;
}

export class StartBatchDto {
  @IsArray()
  @ArrayMinSize(10)
  @ArrayMaxSize(21)
  @IsUUID('4', { each: true })
  candidateIds: string[];
}

export class CrownBatchWinnerDto {
  @IsUUID()
  candidateId: string;

  @IsOptional()
  @IsString()
  decisionNote?: string;
}

export class SetBatchFinalistsDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsUUID('4', { each: true })
  candidateIds: string[];
}
