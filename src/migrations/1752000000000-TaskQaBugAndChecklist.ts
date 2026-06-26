import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskQaBugAndChecklist1752000000000 implements MigrationInterface {
  name = 'TaskQaBugAndChecklist1752000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "is_bug" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "bug_reason" text
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "bugged_at" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "bugged_by_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "qa_checklist_state" jsonb NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_evidence" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "bucket" character varying NOT NULL,
        "object_key" character varying NOT NULL,
        "original_filename" character varying NOT NULL,
        "mime_type" character varying NOT NULL,
        "size_bytes" bigint NOT NULL,
        "uploaded_by_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_evidence" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_evidence_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_task_evidence_uploaded_by" FOREIGN KEY ("uploaded_by_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_evidence_task_id"
      ON "task_evidence" ("task_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "task_evidence"`);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "qa_checklist_state"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "bugged_by_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "bugged_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "bug_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "is_bug"
    `);
  }
}
