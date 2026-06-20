import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ConversationMessageRole } from '../conversation-message-role.enum';

export class AddMessageDto {
  @IsEnum(ConversationMessageRole)
  role: ConversationMessageRole;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  usedTools?: string[];
}
