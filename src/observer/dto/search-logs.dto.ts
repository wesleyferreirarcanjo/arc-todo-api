import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Query params for search and tail; every field optional and pass-through. */
export class SearchLogsDto {
  /** Server uuid or server name. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  server?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  app?: string;

  /** Free-text substring filter. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(LOG_LEVELS)
  level?: LogLevel;

  /** Inclusive lower bound, epoch millis. */
  @IsOptional()
  @Matches(/^\d{1,16}$/)
  fromMs?: string;

  /** Inclusive upper bound, epoch millis. */
  @IsOptional()
  @Matches(/^\d{1,16}$/)
  toMs?: string;

  /** Exclusive upper bound for the next older page. */
  @IsOptional()
  @Matches(/^\d{1,16}$/)
  beforeMs?: string;

  /** Tail cursor: exclusive lower bound for newer lines. */
  @IsOptional()
  @Matches(/^\d{1,16}$/)
  afterMs?: string;

  @IsOptional()
  @Matches(/^\d{1,4}$/)
  limit?: string;
}
