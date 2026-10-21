import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class InternalToolCallDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  machineId: string;

  @IsUUID()
  sessionId: string;

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
