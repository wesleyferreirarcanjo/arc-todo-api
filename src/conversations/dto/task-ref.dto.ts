import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class TaskRefDto {
  @IsUUID()
  taskId: string;

  @IsUUID()
  organizationId: string;

  @IsUUID()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  title: string;
}
