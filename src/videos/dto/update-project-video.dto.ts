import { IsOptional, IsString } from 'class-validator';

export class UpdateProjectVideoDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  editState?: unknown;
}
