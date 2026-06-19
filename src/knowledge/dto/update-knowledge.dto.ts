import { IsOptional, IsString } from 'class-validator';

export class UpdateKnowledgeDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
