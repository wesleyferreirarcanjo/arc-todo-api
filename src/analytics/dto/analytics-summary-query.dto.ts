import { IsOptional, IsUUID } from 'class-validator';

export class AnalyticsSummaryQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
