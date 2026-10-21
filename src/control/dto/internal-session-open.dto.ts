import { IsUUID } from 'class-validator';

export class InternalSessionOpenDto {
  @IsUUID()
  machineId: string;

  @IsUUID()
  callerUserId: string;
}
