import { IsOptional, IsString, MaxLength } from 'class-validator';
import { WIREFRAME_HTML_MAX_CHARS } from '../default-wireframe-html';

export class UpdateProjectWireframeDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(WIREFRAME_HTML_MAX_CHARS)
  html?: string;
}
