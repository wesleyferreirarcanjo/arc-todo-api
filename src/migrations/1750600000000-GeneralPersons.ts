import { MigrationInterface, QueryRunner } from 'typeorm';

export class GeneralPersons1750600000000 implements MigrationInterface {
  name = 'GeneralPersons1750600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "persons"
      ADD COLUMN IF NOT EXISTS "created_by_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "persons"
      SET "created_by_id" = (
        SELECT om."user_id"
        FROM "organization_members" om
        WHERE om."organization_id" = "persons"."organization_id"
        ORDER BY om."created_at" ASC
        LIMIT 1
      )
      WHERE "created_by_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "persons"
      ALTER COLUMN "created_by_id" SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "persons"
        ADD CONSTRAINT "FK_persons_created_by"
        FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "persons"
      ALTER COLUMN "organization_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_persons_created_by_id"
      ON "persons" ("created_by_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "persons" WHERE "organization_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "persons"
      ALTER COLUMN "organization_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "persons" DROP CONSTRAINT IF EXISTS "FK_persons_created_by"
    `);

    await queryRunner.query(`
      ALTER TABLE "persons" DROP COLUMN IF EXISTS "created_by_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_persons_created_by_id"
    `);
  }
}
