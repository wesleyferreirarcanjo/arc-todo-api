import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMcpToolSettings1740000000000 implements MigrationInterface {
  name = 'CreateMcpToolSettings1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "mcp_tool_settings" (
        "key" character varying NOT NULL,
        "group" character varying NOT NULL,
        "display_name" character varying NOT NULL,
        "description" text NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "default_enabled" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mcp_tool_settings_key" PRIMARY KEY ("key")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "mcp_tool_settings"`);
  }
}
