import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  projectIds?: string[];
}
