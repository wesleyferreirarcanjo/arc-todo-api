import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CONSENT_MODES, type ConsentMode } from '../device.util';

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(CONSENT_MODES)
  consentMode?: ConsentMode;
}
