import { ArrayUnique, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AddQaQueueItemsDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  taskIds?: string[];

  @IsOptional()
  @IsBoolean()
  replaceProject?: boolean;
}
