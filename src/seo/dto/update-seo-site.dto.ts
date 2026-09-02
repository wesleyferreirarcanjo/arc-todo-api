import { IsOptional, IsString } from 'class-validator';

export class UpdateSeoSiteDto {
  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  title?: string;
}
