import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskBugFlagDossiers1753500000000 implements MigrationInterface {
  name = 'TaskBugFlagDossiers1753500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_bug_flag_dossiers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "primary_class" varchar(32) NOT NULL,
        "secondary" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "motivo" text NOT NULL,
        "evidence" text,
        "created_by_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_bug_flag_dossiers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_bug_flag_dossiers_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_task_bug_flag_dossiers_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_bug_flag_dossiers_task_created"
        ON "task_bug_flag_dossiers" ("task_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "task_bug_flag_dossiers"
    `);
  }
}
