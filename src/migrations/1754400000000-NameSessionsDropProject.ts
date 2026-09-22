import { MigrationInterface, QueryRunner } from 'typeorm';

export class NameSessionsDropProject1754400000000
  implements MigrationInterface
{
  name = 'NameSessionsDropProject1754400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_name_sessions"
      ALTER COLUMN "project_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "project_name_sessions" SET "project_id" = NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_name_sessions"
      ALTER COLUMN "project_id" SET NOT NULL
    `);
  }
}
