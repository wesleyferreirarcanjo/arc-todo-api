import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReorderQaQueueDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  itemIds: string[];
}
