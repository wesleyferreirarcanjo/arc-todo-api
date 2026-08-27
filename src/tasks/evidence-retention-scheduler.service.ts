import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TaskEvidenceService } from './task-evidence.service';
import { TaskLogService } from './task-log.service';

@Injectable()
export class EvidenceRetentionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(EvidenceRetentionSchedulerService.name);
  private readonly intervalMs = 60 * 60 * 1000;

  constructor(
    private readonly evidenceService: TaskEvidenceService,
    private readonly logService: TaskLogService,
  ) {}

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

    try {
      const deleted = await this.logService.cleanupExpiredLogs();
      if (deleted > 0) {
        this.logger.log(
          `Session-log retention tick removed ${deleted} expired file(s)`,
        );
      }
    } catch (error) {
      this.logger.error('Session-log retention tick failed', error);
    }
  }
}
