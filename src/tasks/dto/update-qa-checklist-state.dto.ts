import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateQaChecklistStateDto {
  @IsOptional()
  @IsString({ each: true })
  checkedItemIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  buggedItemIds?: string[];

  /** Per-item bug notes keyed by checklist item id (e.g. item-0). */
  @IsOptional()
  @IsObject()
  buggedItemNotes?: Record<string, string>;
}
