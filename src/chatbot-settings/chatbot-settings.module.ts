import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatbotSetting } from './chatbot-setting.entity';
import { ChatbotSettingsController } from './chatbot-settings.controller';
import { ChatbotSettingsService } from './chatbot-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChatbotSetting])],
  controllers: [ChatbotSettingsController],
  providers: [ChatbotSettingsService],
  exports: [ChatbotSettingsService],
})
export class ChatbotSettingsModule {}
