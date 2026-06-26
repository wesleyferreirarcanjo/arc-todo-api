import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserActivity1752100000000 implements MigrationInterface {
  name = 'UserActivity1752100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_activity" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "actor_user_id" uuid NOT NULL,
        "action" character varying(64) NOT NULL,
        "entity_type" character varying(32) NOT NULL,
        "entity_id" uuid,
        "summary" text NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_activity" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_activity_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_activity_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_activity_org_created"
      ON "user_activity" ("organization_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_activity"`);
  }
}
