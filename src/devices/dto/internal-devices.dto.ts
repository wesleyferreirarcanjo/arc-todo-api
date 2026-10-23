import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CONSENT_MODES,
  DEVICE_CLOSE_REASONS,
  DEVICE_KINDS,
  type ConsentMode,
  type DeviceCloseReason,
  type DeviceKind,
} from '../device.util';

const TOKEN_HASH = /^[a-fA-F0-9]{64}$/;

export class InternalRegisterDeviceDto {
  @IsIn(DEVICE_KINDS)
  kind: DeviceKind;

  /** Required except kind `ide`, which falls back to the first admin. */
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsString()
  @Matches(TOKEN_HASH)
  tokenHash: string;

  /** Relay-native id (Hub `devices.id`). Commands/revoke still use this. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  sourceId?: string;

  @IsOptional()
  @IsIn(CONSENT_MODES)
  consentMode?: ConsentMode;

  @IsOptional()
  @IsBoolean()
  remoteEnabled?: boolean;
}

export class InternalHeartbeatDeviceDto {
  @IsUUID()
  deviceId: string;

  @IsOptional()
  @IsIn(CONSENT_MODES)
  consentMode?: ConsentMode;

  @IsOptional()
  @IsBoolean()
  remoteEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  paused?: boolean;
}

export class InternalDeviceSessionOpenDto {
  @IsUUID()
  deviceId: string;

  @IsUUID()
  callerUserId: string;
}

export class InternalDeviceSessionTouchDto {
  @IsUUID()
  sessionId: string;
}

export class InternalDeviceSessionCloseDto {
  @IsUUID()
  sessionId: string;

  @IsIn(DEVICE_CLOSE_REASONS)
  reason: DeviceCloseReason;
}

export class InternalDeviceAuditDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  deviceId: string;

  /** Hub command audit has no control session (admin cannot open one). */
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsString()
  @MaxLength(120)
  tool: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @IsBoolean()
  success: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  error?: string;

  @IsOptional()
  @IsObject()
  inputsRedacted?: Record<string, unknown>;
}

export class InternalRevokeDeviceDto {
  @IsUUID()
  deviceId: string;
}
