import { IsString } from 'class-validator';

export class InternalMachineAuthenticateDto {
  @IsString()
  machineToken: string;
}
