import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriticityAndProjectColor1750400000000 implements MigrationInterface {
  name = 'CriticityAndProjectColor1750400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "color" character varying(7) NOT NULL DEFAULT '#737373'
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "task_criticity_enum" AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    const hasPriority = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tasks' AND column_name = 'priority'
    `);

    const hasCriticity = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tasks' AND column_name = 'criticity'
    `);

    if (hasPriority.length > 0 && hasCriticity.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "tasks"
        ADD COLUMN "criticity" "task_criticity_enum" NOT NULL DEFAULT 'medium'
      `);

      await queryRunner.query(`
        UPDATE "tasks"
        SET "criticity" = "priority"::text::"task_criticity_enum"
      `);

      await queryRunner.query(`
        ALTER TABLE "tasks" DROP COLUMN "priority"
      `);

      await queryRunner.query(`
        DROP TYPE IF EXISTS "task_priority_enum"
      `);
    } else if (hasCriticity.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "tasks"
        ADD COLUMN "criticity" "task_criticity_enum" NOT NULL DEFAULT 'medium'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "task_priority_enum" AS ENUM ('low', 'medium', 'high');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    const hasCriticity = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tasks' AND column_name = 'criticity'
    `);

    if (hasCriticity.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "tasks"
        ADD COLUMN "priority" "task_priority_enum" NOT NULL DEFAULT 'medium'
      `);

      await queryRunner.query(`
        UPDATE "tasks"
        SET "priority" = CASE
          WHEN "criticity"::text = 'critical' THEN 'high'::"task_priority_enum"
          ELSE "criticity"::text::"task_priority_enum"
        END
      `);

      await queryRunner.query(`
        ALTER TABLE "tasks" DROP COLUMN "criticity"
      `);
    }

    await queryRunner.query(`
      DROP TYPE IF EXISTS "task_criticity_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "projects" DROP COLUMN IF EXISTS "color"
    `);
  }
}
