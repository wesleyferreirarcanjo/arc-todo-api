import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdateNameSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  brief?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  namingGoal?: string | null;

  @IsOptional()
  @IsObject()
  productDescription?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  lanes?: unknown[];

  @IsOptional()
  @IsArray()
  candidates?: unknown[];

  @IsOptional()
  @IsArray()
  shortlistIds?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  runnerUpCandidateId?: string | null;

  @IsOptional()
  @IsString()
  decisionNote?: string | null;
}
