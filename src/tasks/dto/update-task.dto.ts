import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TaskCriticity, TaskStatus } from '../task.enums';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskCriticity)
  criticity?: TaskCriticity;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  parentTaskId?: string | null;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
