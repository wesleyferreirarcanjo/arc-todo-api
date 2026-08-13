import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { WIREFRAME_HTML_MAX_CHARS } from '../default-wireframe-html';

export class CreateProjectWireframeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(WIREFRAME_HTML_MAX_CHARS)
  html?: string;
}
