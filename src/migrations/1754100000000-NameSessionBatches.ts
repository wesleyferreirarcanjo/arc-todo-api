import { MigrationInterface, QueryRunner } from 'typeorm';

export class NameSessionBatches1754100000000 implements MigrationInterface {
  name = 'NameSessionBatches1754100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_name_sessions"
      ADD COLUMN "batches" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_name_sessions"
      DROP COLUMN "batches"
    `);
  }
}
