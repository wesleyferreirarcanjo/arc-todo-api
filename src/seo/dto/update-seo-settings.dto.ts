import { IsInt, Max, Min } from 'class-validator';

export class UpdateSeoSettingsDto {
  @IsInt()
  @Min(1)
  @Max(2000)
  maxPagesPerAudit: number;
}
