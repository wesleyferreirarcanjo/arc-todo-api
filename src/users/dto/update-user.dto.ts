import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @MinLength(6)
  password?: string;

  /** Pass null or "" to clear SSO assignment. */
  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsEmail()
  ssoAssign?: string | null;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  projectIds?: string[];
}
