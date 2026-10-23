import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeviceIdeSource1790700000000 implements MigrationInterface {
  name = 'DeviceIdeSource1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "machines"
      ADD COLUMN IF NOT EXISTS "source_id" character varying
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_machines_source_id"
      ON "machines" ("source_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_machines_kind_source_id"
      ON "machines" ("kind", "source_id")
      WHERE "source_id" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "control_tool_calls"
      ALTER COLUMN "session_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "control_tool_calls"
      ALTER COLUMN "session_id" SET NOT NULL
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_machines_kind_source_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_machines_source_id"`);
    await queryRunner.query(`
      ALTER TABLE "machines" DROP COLUMN IF EXISTS "source_id"
    `);
  }
}
