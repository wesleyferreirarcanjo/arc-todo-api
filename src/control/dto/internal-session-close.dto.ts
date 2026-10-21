import { IsIn, IsUUID } from 'class-validator';
import { CLOSE_REASONS, type CloseReason } from '../machine-token.util';

export class InternalSessionCloseDto {
  @IsUUID()
  sessionId: string;

  @IsIn(CLOSE_REASONS)
  reason: CloseReason;
}
