import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class QaImprovementTaskRefDto {
  @IsString()
  id!: string;

  @IsString()
  displayId!: string;
}

export class UpdateQaChecklistStateDto {
  @IsOptional()
  @IsString({ each: true })
  checkedItemIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  buggedItemIds?: string[];

  /** Per-item bug notes keyed by checklist item id — string or string[] (legacy string accepted). */
  @IsOptional()
  @IsObject()
  buggedItemNotes?: Record<string, string | string[]>;

  /** Task-level Melhoria generations (standalone sibling tasks). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QaImprovementTaskRefDto)
  improvementTasks?: QaImprovementTaskRefDto[];

  /** Per-checklist-item Melhoria generations keyed by item id. */
  @IsOptional()
  @IsObject()
  improvementItemTasks?: Record<string, QaImprovementTaskRefDto[]>;
}
