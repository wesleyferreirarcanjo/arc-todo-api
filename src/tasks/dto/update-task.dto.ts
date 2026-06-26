import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TaskCriticity, TaskStatus } from '../task.enums';
import { UpdateQaChecklistStateDto } from './update-qa-checklist-state.dto';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  businessDescription?: string;

  @IsOptional()
  @IsString()
  planCodeDescription?: string;

  @IsOptional()
  @IsString()
  testDescription?: string;

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

  @IsOptional()
  @IsBoolean()
  isBug?: boolean;

  @IsOptional()
  @IsString()
  bugReason?: string | null;

  @IsOptional()
  @IsObject()
  qaChecklistState?: UpdateQaChecklistStateDto;
}
