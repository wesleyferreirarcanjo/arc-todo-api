import { IsNotEmpty, IsString } from 'class-validator';

export class CreateKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
