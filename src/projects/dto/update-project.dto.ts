import { IsOptional, IsString, IsUUID, Matches, ValidateIf } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color (e.g. #737373)',
  })
  color?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  defaultAssigneeId?: string | null;
}
