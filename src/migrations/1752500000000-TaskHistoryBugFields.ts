import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskHistoryBugFields1752500000000 implements MigrationInterface {
  name = 'TaskHistoryBugFields1752500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "task_history_field_enum" ADD VALUE IF NOT EXISTS 'isBug'
    `);
    await queryRunner.query(`
      ALTER TYPE "task_history_field_enum" ADD VALUE IF NOT EXISTS 'bugReason'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // ponytail: PostgreSQL enum values cannot be removed safely without rebuild
  }
}
