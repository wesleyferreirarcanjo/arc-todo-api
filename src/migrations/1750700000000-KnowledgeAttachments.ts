import { MigrationInterface, QueryRunner } from 'typeorm';

export class KnowledgeAttachments1750700000000 implements MigrationInterface {
  name = 'KnowledgeAttachments1750700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_attachments" (
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
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_attachments_entry_id"
      ON "knowledge_attachments" ("knowledge_entry_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_attachments_original_filename"
      ON "knowledge_attachments" ("original_filename")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_attachments_mime_type"
      ON "knowledge_attachments" ("mime_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_attachments"`);
  }
}
