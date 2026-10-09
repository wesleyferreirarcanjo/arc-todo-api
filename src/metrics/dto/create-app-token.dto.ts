import { IsString, Length } from 'class-validator';

export class CreateAppTokenDto {
  @IsString()
  @Length(1, 200)
  app!: string;
}
