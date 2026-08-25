import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectQaProfiles1753400000000 implements MigrationInterface {
  name = 'ProjectQaProfiles1753400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_qa_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "environments" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "users" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "notes" text,
        "updated_by_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_qa_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_qa_profiles_project_id" UNIQUE ("project_id"),
        CONSTRAINT "FK_project_qa_profiles_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_qa_profiles_updated_by" FOREIGN KEY ("updated_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "project_qa_profiles"
    `);
  }
}
