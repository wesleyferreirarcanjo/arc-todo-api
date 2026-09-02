import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeoSiteOfferings1754000000000 implements MigrationInterface {
  name = 'SeoSiteOfferings1754000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_seo_sites"
      ADD COLUMN "offerings" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_seo_sites"
      DROP COLUMN "offerings"
    `);
  }
}
