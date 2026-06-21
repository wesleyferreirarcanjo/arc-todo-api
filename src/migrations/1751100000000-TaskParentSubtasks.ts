import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskParentSubtasks1751100000000 implements MigrationInterface {
  name = 'TaskParentSubtasks1751100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "parent_task_id" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tasks"
        ADD CONSTRAINT "FK_tasks_parent_task"
        FOREIGN KEY ("parent_task_id")
        REFERENCES "tasks"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_parent_task_id"
      ON "tasks" ("parent_task_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tasks"
        ADD CONSTRAINT "CHK_tasks_no_self_parent"
        CHECK ("parent_task_id" IS NULL OR "parent_task_id" <> "id");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "CHK_tasks_no_self_parent"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tasks_parent_task_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "FK_tasks_parent_task"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "parent_task_id"
    `);
  }
}
