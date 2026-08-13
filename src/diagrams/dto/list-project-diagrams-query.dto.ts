import { IsOptional, IsUUID } from 'class-validator';

export class ListProjectDiagramsQueryDto {
  @IsOptional()
  @IsUUID()
  wireframeId?: string;
}
