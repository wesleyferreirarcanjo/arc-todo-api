import { IsOptional, IsUUID } from 'class-validator';

export class ListConversationsQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
