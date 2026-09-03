import { MigrationInterface, QueryRunner } from 'typeorm';

export class NameCandidateFeedbackReaction1754200000000
  implements MigrationInterface
{
  name = 'NameCandidateFeedbackReaction1754200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "name_candidate_feedback"
      ADD COLUMN "reaction" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "name_candidate_feedback"
      DROP COLUMN "reaction"
    `);
  }
}
