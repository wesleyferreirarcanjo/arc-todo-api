import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskBugFlagScores1753600000000 implements MigrationInterface {
  name = 'TaskBugFlagScores1753600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task_bug_flag_dossiers"
        ADD COLUMN IF NOT EXISTS "task_score" smallint,
        ADD COLUMN IF NOT EXISTS "flag_score" smallint
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task_bug_flag_dossiers"
        DROP COLUMN IF EXISTS "flag_score",
        DROP COLUMN IF EXISTS "task_score"
    `);
  }
}
