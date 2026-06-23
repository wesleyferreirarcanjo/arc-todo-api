import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskCategoryAndMetadata1751800000000 implements MigrationInterface {
  name = 'TaskCategoryAndMetadata1751800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "category" character varying(32) NOT NULL DEFAULT 'other'
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "metadata"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "category"
    `);
  }
}
