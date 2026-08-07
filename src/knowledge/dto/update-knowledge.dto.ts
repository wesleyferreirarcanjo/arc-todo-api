import { IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class UpdateKnowledgeDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  /** Set to a task UUID to link, or null to clear. Omit to leave unchanged. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  taskId?: string | null;
}
