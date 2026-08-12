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

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsEmail()
  ssoAssign?: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  projectIds?: string[];
}
