import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBoardCycles1751600000000 implements MigrationInterface {
  name = 'CreateBoardCycles1751600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "board_cycle_status_enum" AS ENUM ('active', 'closed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "board_cycles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "status" "board_cycle_status_enum" NOT NULL DEFAULT 'active',
        "closed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_board_cycles" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "board_cycles"
        ADD CONSTRAINT "FK_board_cycles_organization"
        FOREIGN KEY ("organization_id")
        REFERENCES "organizations"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "board_cycles"
        ADD CONSTRAINT "FK_board_cycles_project"
        FOREIGN KEY ("project_id")
        REFERENCES "projects"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_board_cycles_active_project"
      ON "board_cycles" ("project_id")
      WHERE "status" = 'active'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_board_cycles_project_status"
      ON "board_cycles" ("project_id", "status", "start_date" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "board_cycle_history_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "cycle_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "task_id" uuid NOT NULL,
        "parent_task_id" uuid,
        "display_id" varchar NOT NULL,
        "task_number" integer NOT NULL,
        "title" varchar NOT NULL,
        "status" "task_status_enum" NOT NULL,
        "completed_at" TIMESTAMPTZ NOT NULL,
        "completion_timestamp_source" varchar NOT NULL DEFAULT 'task.updatedAt',
        "archived_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_board_cycle_history_entries" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "board_cycle_history_entries"
        ADD CONSTRAINT "FK_board_cycle_history_cycle"
        FOREIGN KEY ("cycle_id")
        REFERENCES "board_cycles"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_board_cycle_history_cycle_task"
      ON "board_cycle_history_entries" ("cycle_id", "task_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_board_cycle_history_cycle_created"
      ON "board_cycle_history_entries" ("cycle_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "archived_in_cycle_id" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tasks"
        ADD CONSTRAINT "FK_tasks_archived_in_cycle"
        FOREIGN KEY ("archived_in_cycle_id")
        REFERENCES "board_cycles"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_archived_in_cycle_id"
      ON "tasks" ("archived_in_cycle_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tasks_archived_in_cycle_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "FK_tasks_archived_in_cycle"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "archived_in_cycle_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_board_cycle_history_cycle_created"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_board_cycle_history_cycle_task"
    `);
    await queryRunner.query(`
      ALTER TABLE "board_cycle_history_entries"
      DROP CONSTRAINT IF EXISTS "FK_board_cycle_history_cycle"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "board_cycle_history_entries"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_board_cycles_project_status"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_board_cycles_active_project"
    `);
    await queryRunner.query(`
      ALTER TABLE "board_cycles" DROP CONSTRAINT IF EXISTS "FK_board_cycles_project"
    `);
    await queryRunner.query(`
      ALTER TABLE "board_cycles" DROP CONSTRAINT IF EXISTS "FK_board_cycles_organization"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "board_cycles"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "board_cycle_status_enum"
    `);
  }
}
