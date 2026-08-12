import { MigrationInterface, QueryRunner } from 'typeorm';

export class PushSubscriptions1752900000000 implements MigrationInterface {
  name = 'PushSubscriptions1752900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "user_agent" character varying,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_push_subscriptions_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_push_subscriptions_endpoint" UNIQUE ("endpoint")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_push_subscriptions_user_id"
      ON "push_subscriptions" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "push_preferences" (
        "user_id" uuid PRIMARY KEY,
        "notify_comment" boolean NOT NULL DEFAULT true,
        "notify_status_gate" boolean NOT NULL DEFAULT true,
        "notify_due_today" boolean NOT NULL DEFAULT true,
        "opted_in_at" TIMESTAMPTZ,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_push_preferences_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "push_preferences"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_push_subscriptions_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "push_subscriptions"`);
  }
}
