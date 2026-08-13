import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectDiagramWireframeId1753100000000
  implements MigrationInterface
{
  name = 'ProjectDiagramWireframeId1753100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_diagrams"
      ADD COLUMN IF NOT EXISTS "wireframe_id" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_project_diagrams_wireframe'
        ) THEN
          ALTER TABLE "project_diagrams"
          ADD CONSTRAINT "FK_project_diagrams_wireframe"
          FOREIGN KEY ("wireframe_id")
          REFERENCES "project_wireframes"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_diagrams_wireframe_id"
      ON "project_diagrams" ("wireframe_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_project_diagrams_wireframe_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "project_diagrams"
      DROP CONSTRAINT IF EXISTS "FK_project_diagrams_wireframe"
    `);
    await queryRunner.query(`
      ALTER TABLE "project_diagrams"
      DROP COLUMN IF EXISTS "wireframe_id"
    `);
  }
}
