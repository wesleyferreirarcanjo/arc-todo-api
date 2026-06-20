import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConversations1750900000000 implements MigrationInterface {
  name = 'CreateConversations1750900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "conversation_message_role_enum" AS ENUM ('user', 'assistant', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "organization_id" uuid,
        "project_id" uuid,
        "title" character varying NOT NULL DEFAULT 'New conversation',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_conversations_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_conversations_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_conversations_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversations_user_id"
      ON "conversations" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversations_updated_at"
      ON "conversations" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversation_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "role" "conversation_message_role_enum" NOT NULL,
        "content" text NOT NULL,
        "used_tools" text[] NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_conversation_messages_conversation" FOREIGN KEY ("conversation_id")
          REFERENCES "conversations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversation_messages_conversation_id"
      ON "conversation_messages" ("conversation_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversation_task_contexts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "task_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_task_contexts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_conversation_task_contexts_conversation" FOREIGN KEY ("conversation_id")
          REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_conversation_task_contexts_conversation_task"
          UNIQUE ("conversation_id", "task_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversation_task_contexts_conversation_id"
      ON "conversation_task_contexts" ("conversation_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "conversation_task_contexts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversation_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "conversation_message_role_enum"`);
  }
}
