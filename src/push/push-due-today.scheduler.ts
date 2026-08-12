import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/task.entity';
import { TaskStatus } from '../tasks/task.enums';
import { PushService } from './push.service';

/**
 * Due-today push reminders.
 * Ceiling: single Node process, setInterval (hourly). Restarts reset the timer;
 * "once per calendar day" is tracked in-memory only (may re-send after restart
 * on the same day). Upgrade path: persist last_sent_date or use a real cron.
 */
@Injectable()
export class PushDueTodaySchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PushDueTodaySchedulerService.name);
  private readonly intervalMs = 60 * 60 * 1000;
  private readonly sentToday = new Set<string>();
  private lastDayKey = '';

  constructor(
    private readonly pushService: PushService,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
  ) {}

  onModuleInit(): void {
    void this.tick();
    setInterval(() => void this.tick(), this.intervalMs);
  }

  private async tick(): Promise<void> {
    try {
      const dayKey = new Date().toISOString().slice(0, 10);
      if (dayKey !== this.lastDayKey) {
        this.sentToday.clear();
        this.lastDayKey = dayKey;
      }

      const userIds = await this.pushService.listOptedInUserIdsForDueToday();
      if (userIds.length === 0) return;

      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      for (const userId of userIds) {
        if (this.sentToday.has(userId)) continue;

        const dueCount = await this.tasksRepository
          .createQueryBuilder('task')
          .where('task.created_by_id = :userId', { userId })
          .andWhere('task.status != :done', { done: TaskStatus.DONE })
          .andWhere('task.due_date >= :start', { start })
          .andWhere('task.due_date < :end', { end })
          .getCount();

        if (dueCount === 0) continue;

        const sample = await this.tasksRepository
          .createQueryBuilder('task')
          .where('task.created_by_id = :userId', { userId })
          .andWhere('task.status != :done', { done: TaskStatus.DONE })
          .andWhere('task.due_date >= :start', { start })
          .andWhere('task.due_date < :end', { end })
          .orderBy('task.due_date', 'ASC')
          .getOne();

        await this.pushService.notifyUser(userId, null, 'due_today', {
          title: 'Tasks due today',
          body:
            dueCount === 1 && sample
              ? `"${sample.title}" is due today`
              : `You have ${dueCount} tasks due today`,
          url: sample ? `/board?task=${sample.id}` : '/board',
          kind: 'due_today',
          taskId: sample?.id,
        });

        this.sentToday.add(userId);
      }
    } catch (error) {
      this.logger.error('Due-today push tick failed', error);
    }
  }
}
