import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePersonDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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
