import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdatePersonDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
