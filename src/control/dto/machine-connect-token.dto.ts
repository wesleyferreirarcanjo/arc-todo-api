import { IsString } from 'class-validator';

export class MachineConnectTokenDto {
  @IsString()
  code: string;

  @IsString()
  codeVerifier: string;
}
