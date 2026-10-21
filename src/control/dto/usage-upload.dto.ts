import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UsageUploadDto {
  @IsString()
  @MaxLength(200)
  turnId: string;

  @IsUUID()
  arcTodoUserId: string;

  @IsOptional()
  @IsUUID()
  controlSessionId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedInputTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedOutputTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reportedInputTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reportedOutputTokens?: number;

  @IsOptional()
  @IsNumber()
  costDelta?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  costCurrency?: string;

  @IsString()
  @MaxLength(40)
  source: string;
}
