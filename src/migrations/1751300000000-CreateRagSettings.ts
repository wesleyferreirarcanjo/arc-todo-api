import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRagSettings1751300000000 implements MigrationInterface {
  name = 'CreateRagSettings1751300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rag_settings" (
        "id" character varying NOT NULL DEFAULT 'default',
        "enabled" boolean NOT NULL DEFAULT true,
        "chunk_size_tokens" integer NOT NULL DEFAULT 512,
        "chunk_overlap_tokens" integer NOT NULL DEFAULT 64,
        "top_k_default" integer NOT NULL DEFAULT 5,
        "max_context_tokens" integer NOT NULL DEFAULT 4000,
        "max_file_bytes_for_indexing" bigint NOT NULL DEFAULT 10485760,
        "enabled_mime_types" text[] NOT NULL DEFAULT ARRAY['text/plain','text/markdown','text/csv','application/json'],
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "rag_settings"`);
  }
}
