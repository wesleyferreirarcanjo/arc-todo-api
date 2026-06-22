import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizationColor1751700000000 implements MigrationInterface {
  name = 'OrganizationColor1751700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "color" character varying(7) NOT NULL DEFAULT '#737373'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations" DROP COLUMN IF EXISTS "color"
    `);
  }
}
