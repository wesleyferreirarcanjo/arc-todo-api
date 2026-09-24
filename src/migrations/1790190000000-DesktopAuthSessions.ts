import { MigrationInterface, QueryRunner } from 'typeorm';

export class DesktopAuthSessions1790190000000 implements MigrationInterface {
  name = 'DesktopAuthSessions1790190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "desktop_auth_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "state_hash" character varying NOT NULL,
        "code_challenge" character varying NOT NULL,
        "code_hash" character varying,
        "code_expires_at" TIMESTAMP WITH TIME ZONE,
        "code_used_at" TIMESTAMP WITH TIME ZONE,
        "refresh_hash" character varying,
        "previous_refresh_hash" character varying,
        "refresh_expires_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_desktop_auth_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_desktop_auth_code_hash"
      ON "desktop_auth_sessions" ("code_hash")
      WHERE "code_hash" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_desktop_auth_refresh_hash"
      ON "desktop_auth_sessions" ("refresh_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_desktop_auth_previous_refresh"
      ON "desktop_auth_sessions" ("previous_refresh_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_desktop_auth_user"
      ON "desktop_auth_sessions" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "desktop_auth_sessions"`);
  }
}
