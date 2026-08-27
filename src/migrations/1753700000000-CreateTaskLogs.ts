import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskLogs1753700000000 implements MigrationInterface {
  name = 'CreateTaskLogs1753700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "bucket" character varying NOT NULL,
        "object_key" character varying NOT NULL,
        "original_filename" character varying NOT NULL,
        "mime_type" character varying NOT NULL,
        "size_bytes" bigint NOT NULL,
        "uploaded_by_id" uuid NOT NULL,
        "checklist_item_id" character varying(64),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_logs_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_task_logs_uploaded_by" FOREIGN KEY ("uploaded_by_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_logs_task_id"
      ON "task_logs" ("task_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_logs_checklist_item_id"
      ON "task_logs" ("task_id", "checklist_item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "task_logs"`);
  }
}
