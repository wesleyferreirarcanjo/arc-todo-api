import { IsString, Matches } from 'class-validator';

export class DesktopAuthorizeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,128}$/)
  state: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43,128}$/)
  codeChallenge: string;
}
