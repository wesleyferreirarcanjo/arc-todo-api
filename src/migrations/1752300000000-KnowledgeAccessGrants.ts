import { MigrationInterface, QueryRunner } from 'typeorm';

export class KnowledgeAccessGrants1752300000000 implements MigrationInterface {
  name = 'KnowledgeAccessGrants1752300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_access_grants" (
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
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_knowledge_access_grants_user_org"
      ON "knowledge_access_grants" ("user_id", "organization_id")
      WHERE "organization_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_knowledge_access_grants_user_project"
      ON "knowledge_access_grants" ("user_id", "project_id")
      WHERE "project_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_knowledge_access_grants_user_project"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_knowledge_access_grants_user_org"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_access_grants"`);
  }
}
