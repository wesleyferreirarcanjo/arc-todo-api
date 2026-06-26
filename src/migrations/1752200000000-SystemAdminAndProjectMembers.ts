import { MigrationInterface, QueryRunner } from 'typeorm';

export class SystemAdminAndProjectMembers1752200000000
  implements MigrationInterface
{
  name = 'SystemAdminAndProjectMembers1752200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "is_admin" = true
      WHERE "username" = 'admin'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_project_members_project_user" UNIQUE ("project_id", "user_id"),
        CONSTRAINT "PK_project_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_members_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "project_members" ("project_id", "user_id")
      SELECT p.id, om.user_id
      FROM "organization_members" om
      INNER JOIN "projects" p ON p.organization_id = om.organization_id
      ON CONFLICT ("project_id", "user_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "project_members"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_admin"`);
  }
}
