import { MigrationInterface, QueryRunner } from 'typeorm';

export class KnowledgeEntryTaskId1752400000000 implements MigrationInterface {
  name = 'KnowledgeEntryTaskId1752400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries"
      ADD COLUMN IF NOT EXISTS "task_id" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "knowledge_entries"
        ADD CONSTRAINT "FK_knowledge_entries_task"
        FOREIGN KEY ("task_id")
        REFERENCES "tasks"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_entries_task_id"
      ON "knowledge_entries" ("task_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_knowledge_entries_task_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries" DROP CONSTRAINT IF EXISTS "FK_knowledge_entries_task"
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "task_id"
    `);
  }
}
