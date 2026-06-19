import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsString,
  ValidateNested,
} from 'class-validator';

class BulkMcpToolSettingItemDto {
  @IsString()
  key: string;

  @IsBoolean()
  enabled: boolean;
}

export class UpdateMcpToolSettingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkMcpToolSettingItemDto)
  tools: BulkMcpToolSettingItemDto[];
}
