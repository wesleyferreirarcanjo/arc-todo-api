import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateNameSessionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  brief?: string;

  @IsOptional()
  @IsString()
  namingGoal?: string;

  @IsOptional()
  @IsObject()
  productDescription?: Record<string, unknown>;
}
