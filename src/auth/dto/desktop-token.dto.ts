import { IsString, Matches } from 'class-validator';

export class DesktopTokenDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,256}$/)
  code: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43,128}$/)
  codeVerifier: string;
}
