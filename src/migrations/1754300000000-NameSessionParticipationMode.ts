import { MigrationInterface, QueryRunner } from 'typeorm';

export class NameSessionParticipationMode1754300000000
  implements MigrationInterface
{
  name = 'NameSessionParticipationMode1754300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_name_sessions"
      ADD COLUMN "participation_mode" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_name_sessions"
      DROP COLUMN "participation_mode"
    `);
  }
}
