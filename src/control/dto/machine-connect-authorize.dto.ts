import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class MachineConnectAuthorizeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,128}$/)
  state: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43,128}$/)
  codeChallenge: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
