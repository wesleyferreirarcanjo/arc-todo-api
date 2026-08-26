import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateBugFlagDossierDto {
  @IsUUID()
  taskId!: string;

  @IsString()
  primary!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondary?: string[];

  @IsString()
  motivo!: string;

  @IsOptional()
  @IsString()
  evidence?: string | null;

  @IsInt()
  @Min(1)
  @Max(10)
  taskScore!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  flagScore!: number;
}
