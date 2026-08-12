import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserSsoAssign1752800000000 implements MigrationInterface {
  name = 'UserSsoAssign1752800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "sso_assign" character varying
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_sso_assign"
      ON "users" ("sso_assign")
      WHERE "sso_assign" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_sso_assign"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "sso_assign"`,
    );
  }
}
