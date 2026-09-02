import { IsDateString, IsOptional } from 'class-validator';

export class SeoKeywordsDto {
  @IsOptional()
  @IsDateString()
  rangeStart?: string;

  @IsOptional()
  @IsDateString()
  rangeEnd?: string;
}
