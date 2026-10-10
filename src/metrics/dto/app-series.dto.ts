import { IsNotEmpty, IsString } from 'class-validator';
import { MetricsWindowDto } from './metrics-window.dto';

export class AppSeriesQueryDto extends MetricsWindowDto {
  @IsString()
  @IsNotEmpty()
  app!: string;

  @IsString()
  @IsNotEmpty()
  metric!: string;
}
