# Board Sprint Cycles

Weekly board cycles are project-scoped. Each project has one implicit board; there is no separate `boards` table in this pass.

## Current model

- `board_cycles`: active or closed weekly windows with `startDate`, `endDate`, and optional `closedAt`.
- Cycle periods are **seven-day windows anchored to the project `createdAt` date** (UTC), not calendar ISO weeks.
- `board_cycle_history_entries`: immutable snapshots of completed work when a cycle closes.
- `tasks.archivedInCycleId`: marks done tasks hidden from the active board after archival.

Closing a cycle (manual or automatic):

1. Snapshot all done, unarchived tasks (including subtasks) into cycle history.
2. Set `archivedInCycleId` on those tasks so they disappear from active board lists.
3. Close the cycle and create the next weekly active cycle.
4. Open `todo` / `in_progress` work stays on the board with parent/subtask links unchanged.

**Automatic rollover:** when UTC today is past the active cycle `endDate`, the API closes the cycle on the next read or on an hourly background tick. Empty projects still get cycles; missed periods backfill as closed empty cycles on first sync.

**Manual rollover:** `POST .../board/cycle/advance` closes early, even before `endDate`.

Per-task edit history (`task_history_entries`) remains separate from board sprint history.

## Recurrence extension points (not implemented)

| Layer | Purpose | Stable IDs today |
| --- | --- | --- |
| Project board | Default cadence owner (weekly cycle per project) | `organizationId`, `projectId` |
| Cycle template (future) | Reusable cadence/recurrence rules for a board | Will reference `projectId` |
| Task template (future) | Recurring work definition (title, default estimate, cadence) | Will reference project and optional template IDs |
| Task instance (future) | Concrete work item on a board/cycle | `tasks.id`, `board_cycles.id` |

`dueDate` schedules a single date only. It does **not** express recurrence, cadence, or cycle membership.

Future recurrence rules should attach at **cycle template** or **task template**, with generated **task instances** linked to an active `board_cycles` row. Do not overload `dueDate`.

## Time-management extension points (not implemented)

| Data | Future home | Relation to cycles |
| --- | --- | --- |
| Estimates | Task template or task instance columns | Compared against cycle capacity |
| Capacity | Cycle or cycle-template row | Planned hours/points per weekly window |
| Logged time | Task instance time-log rows | Rolled up per active/closed cycle |
| Completed metrics | Derived from `board_cycle_history_entries` | Count/duration of archived done work per closed cycle |

This pass stores `completedAt` using `task.updatedAt` as a best-effort completion timestamp (`completionTimestampSource = task.updatedAt`). A future `completedAt` column on tasks can replace that source without changing history row shape.

## Behavior intentionally omitted

- Recurrence generation or cadence editors
- Time logging, estimates, or capacity planning
- Automatic scheduled rollover (manual advance only in UI/API)

See `board-cycle.util.ts` for rollover selection helpers and the `npm run test:board-cycle` self-check.
