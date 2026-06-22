import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BoardCyclesService } from './board-cycles.service';

@Injectable()
export class BoardCycleSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BoardCycleSchedulerService.name);
  private readonly intervalMs = 60 * 60 * 1000;

  constructor(private readonly boardCyclesService: BoardCyclesService) {}

  onModuleInit(): void {
    void this.tick();
    setInterval(() => void this.tick(), this.intervalMs);
  }

  private async tick(): Promise<void> {
    try {
      const advanced = await this.boardCyclesService.syncAllOverdueProjects();
      if (advanced > 0) {
        this.logger.log(`Auto-advanced board cycles for ${advanced} project(s)`);
      }
    } catch (error) {
      this.logger.error('Board cycle auto-advance tick failed', error);
    }
  }
}
