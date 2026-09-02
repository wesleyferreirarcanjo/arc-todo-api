import { IsOptional, IsString } from 'class-validator';

export class CreateSeoSiteDto {
  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  title?: string;
}
