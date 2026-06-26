import { IsOptional, IsString } from 'class-validator';

export class UpdateQaChecklistStateDto {
  @IsOptional()
  @IsString({ each: true })
  checkedItemIds?: string[];
}
