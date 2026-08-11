import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateProjectDiagramDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsObject()
  sceneJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  thumbnail?: string | null;
}
