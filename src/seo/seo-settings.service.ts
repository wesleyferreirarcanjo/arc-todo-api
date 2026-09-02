import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../errors/app-errors';
import { UpdateSeoSettingsDto } from './dto/update-seo-settings.dto';
import { SeoSetting } from './seo-setting.entity';

export type SeoSettingsResponse = {
  maxPagesPerAudit: number;
};

@Injectable()
export class SeoSettingsService {
  constructor(
    @InjectRepository(SeoSetting)
    private readonly settingsRepository: Repository<SeoSetting>,
  ) {}

  async getMaxPagesPerAudit(): Promise<number> {
    const settings = await this.getOrCreate();
    return settings.maxPagesPerAudit;
  }

  async getSettings(): Promise<SeoSettingsResponse> {
    const settings = await this.getOrCreate();
    return { maxPagesPerAudit: settings.maxPagesPerAudit };
  }

  async updateSettings(
    dto: UpdateSeoSettingsDto,
  ): Promise<SeoSettingsResponse> {
    const settings = await this.getOrCreate();
    settings.maxPagesPerAudit = dto.maxPagesPerAudit;
    const saved = await this.settingsRepository.save(settings);
    return { maxPagesPerAudit: saved.maxPagesPerAudit };
  }

  private async getOrCreate(): Promise<SeoSetting> {
    const existing = await this.settingsRepository.findOne({
      where: { id: 'default' },
    });
    if (existing) return existing;
    try {
      return await this.settingsRepository.save(
        this.settingsRepository.create({
          id: 'default',
          maxPagesPerAudit: 200,
        }),
      );
    } catch {
      const retry = await this.settingsRepository.findOne({
        where: { id: 'default' },
      });
      if (retry) return retry;
      throw appError('SYS_UNEXPECTED');
    }
  }
}
