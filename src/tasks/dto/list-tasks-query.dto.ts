import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskCriticity, TaskStatus } from '../task.enums';

export class ListTasksQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskCriticity)
  criticity?: TaskCriticity;

  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
