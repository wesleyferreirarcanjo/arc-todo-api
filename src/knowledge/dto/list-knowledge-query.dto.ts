import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { KnowledgeScope } from '../knowledge-scope.enum';

export class ListKnowledgeQueryDto {
  @IsOptional()
  @IsEnum(KnowledgeScope)
  scope?: KnowledgeScope;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  personId?: string;
}
