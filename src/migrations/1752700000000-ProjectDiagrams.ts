import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectDiagrams1752700000000 implements MigrationInterface {
  name = 'ProjectDiagrams1752700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_diagrams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "scene_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "thumbnail" text,
        "created_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_diagrams" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_diagrams_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_diagrams_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_diagrams_project_id"
      ON "project_diagrams" ("project_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_project_diagrams_project_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "project_diagrams"
    `);
  }
}
