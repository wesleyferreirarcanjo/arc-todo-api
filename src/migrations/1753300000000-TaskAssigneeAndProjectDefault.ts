import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskAssigneeAndProjectDefault1753300000000
  implements MigrationInterface
{
  name = 'TaskAssigneeAndProjectDefault1753300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "assignee_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tasks"
        ADD CONSTRAINT "FK_tasks_assignee"
        FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_assignee_id"
      ON "tasks" ("assignee_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "default_assignee_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "projects"
        ADD CONSTRAINT "FK_projects_default_assignee"
        FOREIGN KEY ("default_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "FK_projects_default_assignee"
    `);
    await queryRunner.query(`
      ALTER TABLE "projects" DROP COLUMN IF EXISTS "default_assignee_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tasks_assignee_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "FK_tasks_assignee"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "assignee_id"
    `);
  }
}
