import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../projects/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateChatbotSettingsDto } from './dto/update-chatbot-settings.dto';
import { ChatbotSettingsService } from './chatbot-settings.service';

@Controller('chatbot-settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ChatbotSettingsController {
  constructor(private readonly chatbotSettingsService: ChatbotSettingsService) {}

  @Get()
  getSettings() {
    return this.chatbotSettingsService.getSettings();
  }

  @Put()
  updateSettings(@Body() dto: UpdateChatbotSettingsDto) {
    return this.chatbotSettingsService.updateSettings(dto);
  }

  @Get('runtime')
  getRuntimeSettings() {
    return this.chatbotSettingsService.getRuntimeSettings();
  }
}
