import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskStatusesAndDescriptions1751900000000
  implements MigrationInterface
{
  name = 'TaskStatusesAndDescriptions1751900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "task_status_enum" ADD VALUE IF NOT EXISTS 'dev_test'
    `);
    await queryRunner.query(`
      ALTER TYPE "task_status_enum" ADD VALUE IF NOT EXISTS 'qa_test'
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "business_description" text
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "plan_code_description" text
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "test_description" text
    `);

    await queryRunner.query(`
      UPDATE "tasks"
      SET "business_description" = "description"
      WHERE "business_description" IS NULL
        AND "description" IS NOT NULL
        AND TRIM("description") <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "test_description"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "plan_code_description"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "business_description"
    `);
    // ponytail: PostgreSQL enum values cannot be removed safely without rebuild
  }
}
