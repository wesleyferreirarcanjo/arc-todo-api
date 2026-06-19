import { IsBoolean } from 'class-validator';

export class UpdateMcpToolSettingDto {
  @IsBoolean()
  enabled: boolean;
}
