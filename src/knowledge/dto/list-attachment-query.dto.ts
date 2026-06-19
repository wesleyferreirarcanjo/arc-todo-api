import { IsOptional, IsString } from 'class-validator';

export class ListAttachmentQueryDto {
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  tag?: string;
}
