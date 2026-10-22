import { IsString } from 'class-validator';

export class CreateProjectVideoDto {
  @IsString()
  title: string;
}
