import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TaskEvidenceService } from './task-evidence.service';

@Injectable()
export class EvidenceRetentionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(EvidenceRetentionSchedulerService.name);
  private readonly intervalMs = 60 * 60 * 1000;

  constructor(private readonly evidenceService: TaskEvidenceService) {}

  onModuleInit(): void {
    void this.tick();
    setInterval(() => void this.tick(), this.intervalMs);
  }

  private async tick(): Promise<void> {
    try {
      const deleted = await this.evidenceService.cleanupExpiredEvidence();
      if (deleted > 0) {
        this.logger.log(
          `Evidence retention tick removed ${deleted} expired file(s)`,
        );
      }
    } catch (error) {
      this.logger.error('Evidence retention tick failed', error);
    }
  }
}
