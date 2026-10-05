import { IsString, Length, Matches } from 'class-validator';

export class CreateAgentTokenDto {
  @IsString()
  @Length(1, 64)
  @Matches(/^[a-z0-9][a-z0-9-]*$/)
  serverName!: string;
}
