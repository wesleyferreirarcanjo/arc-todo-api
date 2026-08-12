import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePushPreferencesDto {
  @IsOptional()
  @IsBoolean()
  notifyComment?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyStatusGate?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyDueToday?: boolean;

  /** Explicit opt-in / opt-out. When true, sets optedInAt if missing. When false, clears optedInAt. */
  @IsOptional()
  @IsBoolean()
  optedIn?: boolean;
}
