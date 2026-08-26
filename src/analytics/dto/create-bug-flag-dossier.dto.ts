import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
