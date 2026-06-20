import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveScopeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  organizationHint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  projectHint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
