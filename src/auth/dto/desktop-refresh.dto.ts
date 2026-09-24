import { IsOptional, IsString, Matches } from 'class-validator';

export class DesktopRefreshDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,256}$/)
  refreshToken?: string;
}
