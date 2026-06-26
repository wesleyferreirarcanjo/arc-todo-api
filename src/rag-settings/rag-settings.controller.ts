import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../projects/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateRagSettingsDto } from './dto/update-rag-settings.dto';
import { RagSettingsService } from './rag-settings.service';

@Controller('rag-settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RagSettingsController {
  constructor(private readonly ragSettingsService: RagSettingsService) {}

  @Get()
  getSettings() {
    return this.ragSettingsService.getSettings();
  }

  @Put()
  updateSettings(@Body() dto: UpdateRagSettingsDto) {
    return this.ragSettingsService.updateSettings(dto);
  }

  @Get('runtime')
  getRuntimeSettings() {
    return this.ragSettingsService.getRuntimeSettings();
  }
}
