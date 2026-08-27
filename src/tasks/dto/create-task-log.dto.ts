import { Allow, IsOptional, IsString } from 'class-validator';

export class CreateTaskLogDto {
  @Allow()
  capture?: unknown;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  checklistItemId?: string;
}
