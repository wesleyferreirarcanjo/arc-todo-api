import { MigrationInterface, QueryRunner } from 'typeorm';

export class PersonsAndKnowledge1750500000000 implements MigrationInterface {
  name = 'PersonsAndKnowledge1750500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "persons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "email" character varying,
        "title" character varying,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_persons" PRIMARY KEY ("id"),
        CONSTRAINT "FK_persons_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_persons_organization_id"
      ON "persons" ("organization_id")
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
      CREATE TABLE IF NOT EXISTS "knowledge_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scope" "knowledge_scope_enum" NOT NULL,
        "title" character varying NOT NULL,
        "content" text NOT NULL,
        "created_by_id" uuid NOT NULL,
        "organization_id" uuid,
        "project_id" uuid,
        "person_id" uuid,
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
          REFERENCES "persons"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_entries_scope"
      ON "knowledge_entries" ("scope")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_entries_created_by_id"
      ON "knowledge_entries" ("created_by_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_entries_organization_id"
      ON "knowledge_entries" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_entries_project_id"
      ON "knowledge_entries" ("project_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_entries_person_id"
      ON "knowledge_entries" ("person_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_entries"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "knowledge_scope_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "persons"`);
  }
}
