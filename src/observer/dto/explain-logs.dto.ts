import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ExplainLogsDto {
  @IsOptional()
  @IsUUID()
  serverId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  app?: string;

  /** How far back to look for errors, capped at 24h. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes?: number;

  /** Optional extra context or question for the explanation. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  query?: string;
}
