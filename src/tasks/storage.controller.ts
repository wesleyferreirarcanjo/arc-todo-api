import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../projects/admin.guard';
import { TaskEvidenceService } from './task-evidence.service';

@Controller('storage')
@UseGuards(JwtAuthGuard, AdminGuard)
export class StorageController {
  constructor(private readonly evidenceService: TaskEvidenceService) {}

  @Get('evidence-usage')
  getEvidenceUsage() {
    return this.evidenceService.getEvidenceUsage();
  }
}
