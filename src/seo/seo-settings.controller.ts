import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../projects/admin.guard';
import { UpdateSeoSettingsDto } from './dto/update-seo-settings.dto';
import { SeoSettingsService } from './seo-settings.service';

@Controller('seo-settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SeoSettingsController {
  constructor(private readonly seoSettingsService: SeoSettingsService) {}

  @Get()
  getSettings() {
    return this.seoSettingsService.getSettings();
  }

  @Put()
  updateSettings(@Body() dto: UpdateSeoSettingsDto) {
    return this.seoSettingsService.updateSettings(dto);
  }
}
