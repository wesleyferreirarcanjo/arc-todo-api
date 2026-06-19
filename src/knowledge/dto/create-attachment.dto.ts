import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAttachmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string;
}
