import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQaQueueItems1753800000000 implements MigrationInterface {
  name = 'CreateQaQueueItems1753800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "qa_queue_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "task_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "position" integer NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_qa_queue_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_qa_queue_items_user_task" UNIQUE ("user_id", "task_id"),
        CONSTRAINT "UQ_qa_queue_items_user_project_position"
          UNIQUE ("user_id", "project_id", "position"),
        CONSTRAINT "FK_qa_queue_items_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_qa_queue_items_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_qa_queue_items_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_qa_queue_items_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qa_queue_items_user_id"
      ON "qa_queue_items" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "qa_queue_items"`);
  }
}
