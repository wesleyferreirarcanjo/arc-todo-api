import { IsUUID } from 'class-validator';

export class InternalSessionTouchDto {
  @IsUUID()
  sessionId: string;
}
