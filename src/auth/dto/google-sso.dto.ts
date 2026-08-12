import { IsString, MinLength } from 'class-validator';

export class GoogleSsoDto {
  @IsString()
  @MinLength(1)
  id_token: string;
}
