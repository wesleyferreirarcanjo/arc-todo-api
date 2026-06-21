import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ResolveTaskQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  identifier: string;
}
