import { MigrationInterface, QueryRunner } from 'typeorm';

export class ControlMachines1790300000000 implements MigrationInterface {
  name = 'ControlMachines1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "machines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "owner_user_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "token_hash" character varying NOT NULL,
        "remote_enabled" boolean NOT NULL DEFAULT false,
        "paused" boolean NOT NULL DEFAULT false,
        "last_seen_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_machines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_machines_owner" FOREIGN KEY ("owner_user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_machines_token_hash"
      ON "machines" ("token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_machines_owner"
      ON "machines" ("owner_user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "machine_connect_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "state_hash" character varying NOT NULL,
        "code_challenge" character varying NOT NULL,
        "code_hash" character varying,
        "code_expires_at" TIMESTAMP WITH TIME ZONE,
        "code_used_at" TIMESTAMP WITH TIME ZONE,
        "machine_name" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_machine_connect_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_machine_connect_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_machine_connect_code_hash"
      ON "machine_connect_sessions" ("code_hash")
      WHERE "code_hash" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_machine_connect_user"
      ON "machine_connect_sessions" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "control_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "machine_id" uuid NOT NULL,
        "caller_user_id" uuid NOT NULL,
        "last_activity_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "closed_at" TIMESTAMP WITH TIME ZONE,
        "close_reason" character varying,
        "opened_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_control_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_control_sessions_machine" FOREIGN KEY ("machine_id")
          REFERENCES "machines" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_control_sessions_caller" FOREIGN KEY ("caller_user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_control_sessions_active_machine"
      ON "control_sessions" ("machine_id")
      WHERE "closed_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_control_sessions_caller"
      ON "control_sessions" ("caller_user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "control_tool_calls" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "session_id" uuid NOT NULL,
        "machine_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "tool" character varying NOT NULL,
        "duration_ms" integer,
        "success" boolean NOT NULL,
        "error" character varying,
        "inputs_redacted" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_control_tool_calls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_control_tool_calls_session" FOREIGN KEY ("session_id")
          REFERENCES "control_sessions" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_control_tool_calls_machine" FOREIGN KEY ("machine_id")
          REFERENCES "machines" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_control_tool_calls_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_control_tool_calls_machine"
      ON "control_tool_calls" ("machine_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "token_usage" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "turn_id" character varying NOT NULL,
        "arc_todo_user_id" uuid NOT NULL,
        "control_session_id" uuid,
        "machine_id" uuid,
        "estimated_input_tokens" integer,
        "estimated_output_tokens" integer,
        "reported_input_tokens" integer,
        "reported_output_tokens" integer,
        "cost_delta" numeric,
        "cost_currency" character varying,
        "source" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_token_usage" PRIMARY KEY ("id"),
        CONSTRAINT "FK_token_usage_user" FOREIGN KEY ("arc_todo_user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_token_usage_session" FOREIGN KEY ("control_session_id")
          REFERENCES "control_sessions" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_token_usage_machine" FOREIGN KEY ("machine_id")
          REFERENCES "machines" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_token_usage_turn_id"
      ON "token_usage" ("turn_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_token_usage_user"
      ON "token_usage" ("arc_todo_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_token_usage_machine"
      ON "token_usage" ("machine_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "token_usage"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "control_tool_calls"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "control_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "machine_connect_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "machines"`);
  }
}
