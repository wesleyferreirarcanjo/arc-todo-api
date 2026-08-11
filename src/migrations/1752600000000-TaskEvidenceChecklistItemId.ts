import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskEvidenceChecklistItemId1752600000000
  implements MigrationInterface
{
  name = 'TaskEvidenceChecklistItemId1752600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task_evidence"
      ADD COLUMN IF NOT EXISTS "checklist_item_id" character varying(64)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_evidence_checklist_item_id"
      ON "task_evidence" ("task_id", "checklist_item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_task_evidence_checklist_item_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "task_evidence"
      DROP COLUMN IF EXISTS "checklist_item_id"
    `);
  }
}
