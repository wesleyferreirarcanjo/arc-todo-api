import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { REMOTE_ACTIONS } from '../device-control.util';

export class EnqueueDeviceCommandDto {
  @IsString()
  @IsIn([...REMOTE_ACTIONS])
  action!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}
