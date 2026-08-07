import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  /** Optional link to a task (project-scoped knowledge only). */
  @IsOptional()
  @IsUUID()
  taskId?: string | null;
}
