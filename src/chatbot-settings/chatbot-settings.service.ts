import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateChatbotSettingsDto } from './dto/update-chatbot-settings.dto';
import { ChatbotSetting } from './chatbot-setting.entity';

export interface ChatbotSettingsResponse {
  provider: string;
  baseUrl: string;
  model: string;
  temperature: number;
  enabled: boolean;
  hasApiKey: boolean;
  maxHistoryMessages: number;
  maxHistoryTokens: number;
}

export interface ChatbotRuntimeSettingsResponse extends ChatbotSettingsResponse {
  apiKey: string;
}

const DEFAULT_SETTINGS: Omit<
  ChatbotSetting,
  'createdAt' | 'updatedAt'
> = {
  id: 'default',
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  apiKey: null,
  temperature: 0.2,
  enabled: false,
  maxHistoryMessages: 50,
  maxHistoryTokens: 100_000,
};

@Injectable()
export class ChatbotSettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(ChatbotSetting)
    private readonly settingsRepository: Repository<ChatbotSetting>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  private toPublicResponse(setting: ChatbotSetting): ChatbotSettingsResponse {
    return {
      provider: setting.provider,
      baseUrl: setting.baseUrl,
      model: setting.model,
      temperature: setting.temperature,
      enabled: setting.enabled,
      hasApiKey: Boolean(setting.apiKey),
      maxHistoryMessages: setting.maxHistoryMessages,
      maxHistoryTokens: setting.maxHistoryTokens,
    };
  }

  private toRuntimeResponse(setting: ChatbotSetting): ChatbotRuntimeSettingsResponse {
    if (!setting.apiKey) {
      throw new NotFoundException('Chatbot API key is not configured');
    }

    return {
      ...this.toPublicResponse(setting),
      apiKey: setting.apiKey,
    };
  }

  private async ensureDefaults() {
    const existing = await this.settingsRepository.findOne({
      where: { id: 'default' },
    });
    if (existing) {
      return;
    }

    const setting = this.settingsRepository.create(DEFAULT_SETTINGS);
    await this.settingsRepository.save(setting);
  }

  async getSettings(): Promise<ChatbotSettingsResponse> {
    const setting = await this.settingsRepository.findOne({
      where: { id: 'default' },
    });
    if (!setting) {
      throw new NotFoundException('Chatbot settings not found');
    }
    return this.toPublicResponse(setting);
  }

  async getRuntimeSettings(): Promise<ChatbotRuntimeSettingsResponse> {
    const setting = await this.settingsRepository.findOne({
      where: { id: 'default' },
    });
    if (!setting) {
      throw new NotFoundException('Chatbot settings not found');
    }
    return this.toRuntimeResponse(setting);
  }

  async updateSettings(
    dto: UpdateChatbotSettingsDto,
  ): Promise<ChatbotSettingsResponse> {
    const setting = await this.settingsRepository.findOne({
      where: { id: 'default' },
    });
    if (!setting) {
      throw new NotFoundException('Chatbot settings not found');
    }

    if (dto.provider !== undefined) {
      setting.provider = dto.provider;
    }
    if (dto.baseUrl !== undefined) {
      setting.baseUrl = dto.baseUrl;
    }
    if (dto.model !== undefined) {
      setting.model = dto.model;
    }
    if (dto.temperature !== undefined) {
      setting.temperature = dto.temperature;
    }
    if (dto.enabled !== undefined) {
      setting.enabled = dto.enabled;
    }
    if (dto.maxHistoryMessages !== undefined) {
      setting.maxHistoryMessages = dto.maxHistoryMessages;
    }
    if (dto.maxHistoryTokens !== undefined) {
      setting.maxHistoryTokens = dto.maxHistoryTokens;
    }
    if (dto.apiKey !== undefined && dto.apiKey.trim().length > 0) {
      setting.apiKey = dto.apiKey.trim();
    }

    const saved = await this.settingsRepository.save(setting);
    return this.toPublicResponse(saved);
  }
}
