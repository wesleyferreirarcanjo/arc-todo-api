import { Injectable, MessageEvent } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, merge, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { Repository } from 'typeorm';
import { QaQueueItem } from './qa-queue-item.entity';
import type { QaQueueListResponse } from './qa-queue.util';
import {
  QaQueueBus,
  SSE_HEARTBEAT_MS,
  emitQueueSnapshot,
  emitTaskUpdateIfQueued,
  heartbeatSseMessage,
  toSseMessage,
  type QaQueueTaskPatch,
} from './qa-queue-sse.util';

/**
 * In-process per-user SSE bus.
 * ponytail: multi-replica needs Postgres LISTEN/NOTIFY (no Redis today).
 * Single Coolify instance is fine.
 */
@Injectable()
export class QaQueueEventsService {
  private readonly bus = new QaQueueBus();

  constructor(
    @InjectRepository(QaQueueItem)
    private readonly queueRepository: Repository<QaQueueItem>,
  ) {}

  stream(userId: string): Observable<MessageEvent> {
    const events$ = this.bus.listen(userId).pipe(
      map((event) => toSseMessage(event) as MessageEvent),
    );
    const heartbeat$ = timer(0, SSE_HEARTBEAT_MS).pipe(
      map(() => heartbeatSseMessage() as MessageEvent),
    );
    return merge(heartbeat$, events$);
  }

  emitQueue(userId: string, queue: QaQueueListResponse): void {
    emitQueueSnapshot(this.bus, userId, queue);
  }

  async emitTaskIfQueued(
    taskId: string,
    patch: QaQueueTaskPatch,
  ): Promise<void> {
    await emitTaskUpdateIfQueued(
      this.bus,
      (id) => this.findUserIdsWithTask(id),
      taskId,
      patch,
    );
  }

  private async findUserIdsWithTask(taskId: string): Promise<string[]> {
    const rows = await this.queueRepository.find({
      where: { taskId },
      select: { userId: true },
    });
    return [...new Set(rows.map((row) => row.userId))];
  }
}
