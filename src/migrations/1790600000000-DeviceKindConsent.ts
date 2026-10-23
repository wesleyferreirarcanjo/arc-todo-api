import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeviceKindConsent1790600000000 implements MigrationInterface {
  name = 'DeviceKindConsent1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "machines"
      ADD COLUMN IF NOT EXISTS "kind" character varying NOT NULL DEFAULT 'windows'
    `);
    await queryRunner.query(`
      ALTER TABLE "machines"
      ADD COLUMN IF NOT EXISTS "consent_mode" character varying NOT NULL DEFAULT 'ask'
    `);
    await queryRunner.query(`
      ALTER TABLE "machines"
      DROP CONSTRAINT IF EXISTS "CHK_machines_kind"
    `);
    await queryRunner.query(`
      ALTER TABLE "machines"
      ADD CONSTRAINT "CHK_machines_kind"
      CHECK ("kind" IN ('browser', 'windows', 'ide'))
    `);
    await queryRunner.query(`
      ALTER TABLE "machines"
      DROP CONSTRAINT IF EXISTS "CHK_machines_consent_mode"
    `);
    await queryRunner.query(`
      ALTER TABLE "machines"
      ADD CONSTRAINT "CHK_machines_consent_mode"
      CHECK ("consent_mode" IN ('always', 'ask', 'off'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_machines_kind"
      ON "machines" ("kind")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_machines_kind"`);
    await queryRunner.query(`
      ALTER TABLE "machines" DROP CONSTRAINT IF EXISTS "CHK_machines_consent_mode"
    `);
    await queryRunner.query(`
      ALTER TABLE "machines" DROP CONSTRAINT IF EXISTS "CHK_machines_kind"
    `);
    await queryRunner.query(`
      ALTER TABLE "machines" DROP COLUMN IF EXISTS "consent_mode"
    `);
    await queryRunner.query(`
      ALTER TABLE "machines" DROP COLUMN IF EXISTS "kind"
    `);
  }
}
