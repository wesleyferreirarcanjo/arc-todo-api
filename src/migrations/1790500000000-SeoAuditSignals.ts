import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeoAuditSignals1790500000000 implements MigrationInterface {
  name = 'SeoAuditSignals1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_seo_audit_pages"
      ADD COLUMN "h1_count" integer,
      ADD COLUMN "canonical" text,
      ADD COLUMN "word_count" integer,
      ADD COLUMN "noindex" boolean
    `);
    await queryRunner.query(`
      ALTER TABLE "project_seo_audit_runs"
      ADD COLUMN "site_probe" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_seo_audit_pages"
      DROP COLUMN "h1_count",
      DROP COLUMN "canonical",
      DROP COLUMN "word_count",
      DROP COLUMN "noindex"
    `);
    await queryRunner.query(`
      ALTER TABLE "project_seo_audit_runs"
      DROP COLUMN "site_probe"
    `);
  }
}
