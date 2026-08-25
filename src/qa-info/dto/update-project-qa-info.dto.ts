import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateProjectQaInfoDto {
  @IsOptional()
  @IsArray()
  environments?: unknown[];

  @IsOptional()
  @IsArray()
  users?: unknown[];

  @IsOptional()
  @IsString()
  notes?: string | null;
}
