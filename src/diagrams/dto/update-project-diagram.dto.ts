import { IsObject, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateProjectDiagramDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsObject()
  sceneJson?: Record<string, unknown>;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  thumbnail?: string | null;
}
