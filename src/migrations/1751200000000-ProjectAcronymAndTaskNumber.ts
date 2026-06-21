import { MigrationInterface, QueryRunner } from 'typeorm';
import { pickUniqueProjectAcronym } from '../common/utils/acronym.util';

export class ProjectAcronymAndTaskNumber1751200000000 implements MigrationInterface {
  name = 'ProjectAcronymAndTaskNumber1751200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "acronym" character varying(3)
    `);
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "next_task_number" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "task_number" integer
    `);

    const projects: Array<{ id: string; name: string }> = await queryRunner.query(`
      SELECT "id", "name"
      FROM "projects"
      ORDER BY "created_at" ASC, "id" ASC
    `);

    const usedAcronyms = new Set<string>();
    for (const project of projects) {
      const acronym = pickUniqueProjectAcronym(project.name, usedAcronyms);
      usedAcronyms.add(acronym);
      await queryRunner.query(
        `UPDATE "projects" SET "acronym" = $1 WHERE "id" = $2`,
        [acronym, project.id],
      );
    }

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "project_id"
            ORDER BY "created_at" ASC, "id" ASC
          ) AS "task_number"
        FROM "tasks"
      )
      UPDATE "tasks" AS t
      SET "task_number" = ranked."task_number"
      FROM ranked
      WHERE t."id" = ranked."id"
    `);

    await queryRunner.query(`
      UPDATE "projects" AS p
      SET "next_task_number" = COALESCE(
        (
          SELECT MAX(t."task_number") + 1
          FROM "tasks" AS t
          WHERE t."project_id" = p."id"
        ),
        1
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "projects"
      ALTER COLUMN "acronym" SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "projects"
        ADD CONSTRAINT "UQ_projects_acronym" UNIQUE ("acronym");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ALTER COLUMN "task_number" SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tasks"
        ADD CONSTRAINT "UQ_tasks_project_task_number" UNIQUE ("project_id", "task_number");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "UQ_tasks_project_task_number"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks" DROP COLUMN IF EXISTS "task_number"
    `);
    await queryRunner.query(`
      ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "UQ_projects_acronym"
    `);
    await queryRunner.query(`
      ALTER TABLE "projects" DROP COLUMN IF EXISTS "next_task_number"
    `);
    await queryRunner.query(`
      ALTER TABLE "projects" DROP COLUMN IF EXISTS "acronym"
    `);
  }
}
