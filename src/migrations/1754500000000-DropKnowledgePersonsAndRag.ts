import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropKnowledgePersonsAndRag1754500000000
  implements MigrationInterface
{
  name = 'DropKnowledgePersonsAndRag1754500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_access_grants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_entries"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "knowledge_scope_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rag_chunks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rag_index_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rag_index_state"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rag_settings"`);
    await queryRunner.query(`
      DELETE FROM "mcp_tool_settings"
      WHERE "key" IN (
        'list_knowledge',
        'get_knowledge',
        'create_knowledge',
        'update_knowledge',
        'delete_knowledge',
        'list_knowledge_attachments',
        'upload_knowledge_attachment',
        'download_knowledge_attachment',
        'delete_knowledge_attachment',
        'retrieve_knowledge',
        'list_persons',
        'get_person'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rag_settings" (
        "id" character varying NOT NULL DEFAULT 'default',
        "enabled" boolean NOT NULL DEFAULT true,
        "chunk_size_tokens" integer NOT NULL DEFAULT 512,
        "chunk_overlap_tokens" integer NOT NULL DEFAULT 64,
        "top_k_default" integer NOT NULL DEFAULT 5,
        "max_context_tokens" integer NOT NULL DEFAULT 4000,
        "max_file_bytes_for_indexing" bigint NOT NULL DEFAULT 10485760,
        "enabled_mime_types" text[] NOT NULL DEFAULT ARRAY['text/plain','text/markdown','text/csv','application/json','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        "worker_enabled" boolean NOT NULL DEFAULT true,
        "worker_concurrency" integer NOT NULL DEFAULT 1,
        "job_batch_size" integer NOT NULL DEFAULT 1,
        "min_seconds_between_jobs" integer NOT NULL DEFAULT 5,
        "max_chunks_per_job" integer NOT NULL DEFAULT 200,
        "retry_backoff_seconds" integer NOT NULL DEFAULT 30,
        "embedding_provider" character varying NOT NULL DEFAULT 'local',
        "embedding_model" character varying NOT NULL DEFAULT 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
        "embedding_dimensions" integer NOT NULL DEFAULT 384,
        "deepseek_enabled" boolean NOT NULL DEFAULT false,
        "deepseek_base_url" character varying NOT NULL DEFAULT 'https://api.deepseek.com',
        "deepseek_model" character varying NOT NULL DEFAULT 'deepseek-chat',
        "deepseek_api_key" text,
        "deepseek_temperature" double precision NOT NULL DEFAULT 0.1,
        "deepseek_max_helper_tokens" integer NOT NULL DEFAULT 500,
        "deepseek_use_query_rewrite" boolean NOT NULL DEFAULT false,
        "deepseek_use_rerank" boolean NOT NULL DEFAULT false,
        "deepseek_use_compression" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rag_settings_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "knowledge_scope_enum" AS ENUM (
          'general',
          'organization',
          'project',
          'person'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "knowledge_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scope" "knowledge_scope_enum" NOT NULL,
        "title" character varying NOT NULL,
        "content" text NOT NULL,
        "created_by_id" uuid NOT NULL,
        "organization_id" uuid,
        "project_id" uuid,
        "person_id" uuid,
        "task_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_knowledge_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_person" FOREIGN KEY ("person_id")
          REFERENCES "persons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_entries_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_entries_scope"
      ON "knowledge_entries" ("scope")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_entries_created_by_id"
      ON "knowledge_entries" ("created_by_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_entries_organization_id"
      ON "knowledge_entries" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_entries_project_id"
      ON "knowledge_entries" ("project_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_entries_person_id"
      ON "knowledge_entries" ("person_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_entries_task_id"
      ON "knowledge_entries" ("task_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "knowledge_access_grants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "organization_id" uuid,
        "project_id" uuid,
        "created_by_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_access_grants" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_knowledge_access_grants_scope" CHECK (
          ("organization_id" IS NOT NULL AND "project_id" IS NULL)
          OR ("organization_id" IS NULL AND "project_id" IS NOT NULL)
        ),
        CONSTRAINT "FK_knowledge_access_grants_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_access_grants_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_access_grants_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_access_grants_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_knowledge_access_grants_user_org"
      ON "knowledge_access_grants" ("user_id", "organization_id")
      WHERE "organization_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_knowledge_access_grants_user_project"
      ON "knowledge_access_grants" ("user_id", "project_id")
      WHERE "project_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "knowledge_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "knowledge_entry_id" uuid NOT NULL,
        "bucket" character varying NOT NULL,
        "object_key" character varying NOT NULL,
        "original_filename" character varying NOT NULL,
        "mime_type" character varying NOT NULL,
        "size_bytes" bigint NOT NULL,
        "description" text,
        "tags" text[] NOT NULL DEFAULT '{}',
        "uploaded_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_knowledge_attachments_entry" FOREIGN KEY ("knowledge_entry_id")
          REFERENCES "knowledge_entries"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_attachments_uploaded_by" FOREIGN KEY ("uploaded_by_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_attachments_entry_id"
      ON "knowledge_attachments" ("knowledge_entry_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_attachments_original_filename"
      ON "knowledge_attachments" ("original_filename")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_attachments_mime_type"
      ON "knowledge_attachments" ("mime_type")
    `);
  }
}
