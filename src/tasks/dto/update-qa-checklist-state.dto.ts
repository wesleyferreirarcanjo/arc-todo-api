import { IsOptional, IsString } from 'class-validator';

export class UpdateQaChecklistStateDto {
  @IsOptional()
  @IsString({ each: true })
  checkedItemIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  buggedItemIds?: string[];
}
