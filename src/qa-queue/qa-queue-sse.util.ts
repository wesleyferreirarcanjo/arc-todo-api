import { Observable, Subject } from 'rxjs';
import type { QaQueueListResponse } from './qa-queue.util';

export const SSE_HEARTBEAT_MS = 15_000;
export const QA_QUEUE_STREAM_PATH = 'stream';

export type QaQueueTaskPatch = {
  status: string;
  qaChecklistState: unknown;
  assigneeId: string | null;
  isBug: boolean;
};

export type QaQueueSseEvent =
  | { type: 'queue'; queue: QaQueueListResponse }
  | ({ type: 'task'; taskId: string } & QaQueueTaskPatch);

/** Fields that fan out to users who have this task in their QA queue. */
export function queuedTaskFieldsChanged(dto: object): boolean {
  const raw = dto as Record<string, unknown>;
  return (
    raw.status !== undefined ||
    raw.qaChecklistState !== undefined ||
    raw.assigneeId !== undefined ||
    raw.isBug !== undefined
  );
}

export function formatSseHeartbeatComment(): string {
  return ': ping\n\n';
}

export function toSseMessage(event: QaQueueSseEvent): {
  type: string;
  data: QaQueueSseEvent;
} {
  return { type: event.type, data: event };
}

export function heartbeatSseMessage(): { type: 'heartbeat'; data: string } {
  return { type: 'heartbeat', data: '' };
}

export class QaQueueBus {
  private readonly subjects = new Map<string, Subject<QaQueueSseEvent>>();

  listen(userId: string): Observable<QaQueueSseEvent> {
    const subject = this.subjectFor(userId);
    return new Observable((subscriber) => {
      const sub = subject.subscribe(subscriber);
      return () => {
        sub.unsubscribe();
        if (!subject.observed) {
          this.subjects.delete(userId);
          subject.complete();
        }
      };
    });
  }

  emit(userId: string, event: QaQueueSseEvent): void {
    this.subjects.get(userId)?.next(event);
  }

  private subjectFor(userId: string): Subject<QaQueueSseEvent> {
    let subject = this.subjects.get(userId);
    if (!subject) {
      subject = new Subject<QaQueueSseEvent>();
      this.subjects.set(userId, subject);
    }
    return subject;
  }
}

export function emitQueueSnapshot(
  bus: QaQueueBus,
  userId: string,
  queue: QaQueueListResponse,
): void {
  bus.emit(userId, { type: 'queue', queue });
}

export async function emitTaskUpdateIfQueued(
  bus: QaQueueBus,
  findUserIds: (taskId: string) => Promise<string[]>,
  taskId: string,
  patch: QaQueueTaskPatch,
): Promise<string[]> {
  const userIds = await findUserIds(taskId);
  const event: QaQueueSseEvent = { type: 'task', taskId, ...patch };
  for (const id of userIds) {
    bus.emit(id, event);
  }
  return userIds;
}

if (require.main === module) {
  const empty: QaQueueListResponse = {
    projectId: null,
    organizationId: null,
    items: [],
  };
  const queued: QaQueueListResponse = {
    projectId: 'p1',
    organizationId: 'o1',
    items: [
      {
        id: 'q1',
        taskId: 't1',
        position: 0,
        displayId: 'ARC-1',
        title: 'Card',
        status: 'qa_test',
      },
    ],
  };
  const patch: QaQueueTaskPatch = {
    status: 'qa_test',
    qaChecklistState: { checkedItemIds: ['item-0'] },
    assigneeId: 'u1',
    isBug: false,
  };

  const bus = new QaQueueBus();
  const u1: QaQueueSseEvent[] = [];
  const u2: QaQueueSseEvent[] = [];
  const sub1 = bus.listen('u1').subscribe((event) => u1.push(event));
  const sub2 = bus.listen('u2').subscribe((event) => u2.push(event));

  emitQueueSnapshot(bus, 'u1', queued);
  emitQueueSnapshot(bus, 'u2', empty);

  void Promise.all([
    emitTaskUpdateIfQueued(
      bus,
      async (taskId) => (taskId === 't1' ? ['u1'] : []),
      't1',
      patch,
    ),
    emitTaskUpdateIfQueued(
      bus,
      async () => [],
      't-other',
      { ...patch, status: 'done' },
    ),
  ]).then(([queuedUsers, otherUsers]) => {
    const checks: Array<[string, boolean]> = [
      ['heartbeat comment', formatSseHeartbeatComment() === ': ping\n\n'],
      ['heartbeat interval', SSE_HEARTBEAT_MS === 15_000],
      ['stream path', QA_QUEUE_STREAM_PATH === 'stream'],
      [
        'queue POST emits to owner',
        u1[0]?.type === 'queue' && u1[0].queue.items[0]?.taskId === 't1',
      ],
      [
        'queue POST does not spam other user',
        u2[0]?.type === 'queue' && u2[0].queue.items.length === 0,
      ],
      ['queued PATCH emits', queuedUsers.length === 1 && queuedUsers[0] === 'u1'],
      [
        'queued PATCH payload',
        u1.some(
          (event) =>
            event.type === 'task' &&
            event.taskId === 't1' &&
            event.status === 'qa_test' &&
            event.isBug === false,
        ),
      ],
      ['non-queued PATCH no users', otherUsers.length === 0],
      [
        'non-queued PATCH does not spam u2',
        !u2.some((event) => event.type === 'task'),
      ],
      ['title-only dto skipped', queuedTaskFieldsChanged({ title: 'x' }) === false],
      ['status dto emits', queuedTaskFieldsChanged({ status: 'done' })],
      ['checklist dto emits', queuedTaskFieldsChanged({ qaChecklistState: {} })],
      ['assignee dto emits', queuedTaskFieldsChanged({ assigneeId: null })],
      ['isBug dto emits', queuedTaskFieldsChanged({ isBug: true })],
      ['message type queue', toSseMessage(u1[0]!).type === 'queue'],
      ['heartbeat type', heartbeatSseMessage().type === 'heartbeat'],
    ];
    sub1.unsubscribe();
    sub2.unsubscribe();
    const failed = checks.filter(([, ok]) => !ok);
    if (failed.length) {
      console.error(
        'qa-queue-sse.util failed:',
        failed.map(([name]) => name).join(', '),
      );
      process.exit(1);
    }
    console.log(`qa-queue-sse.util ok (${checks.length})`);
  });
}
