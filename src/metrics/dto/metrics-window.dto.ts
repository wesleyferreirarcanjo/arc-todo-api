import { IsIn } from 'class-validator';

export const METRICS_WINDOWS = ['1h', '24h', '7d', '30d', '1y'] as const;

export type MetricsWindow = (typeof METRICS_WINDOWS)[number];

export class MetricsWindowDto {
  @IsIn(METRICS_WINDOWS)
  window!: MetricsWindow;
}
