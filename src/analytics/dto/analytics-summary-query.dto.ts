import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import {
  ANALYTICS_COMPARE_MODES,
  ANALYTICS_PERIODS,
} from '../analytics-period.util';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function emptyToUndefined({ value }: { value: unknown }): unknown {
  return value === '' ? undefined : value;
}

export class AnalyticsSummaryQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(ANALYTICS_PERIODS)
  period?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(ISO_DATE)
  from?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(ISO_DATE)
  to?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(ANALYTICS_COMPARE_MODES)
  compareMode?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(ISO_DATE)
  compareFrom?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(ISO_DATE)
  compareTo?: string;
}
