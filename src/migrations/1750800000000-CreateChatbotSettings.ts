import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatbotSettings1750800000000 implements MigrationInterface {
  name = 'CreateChatbotSettings1750800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chatbot_settings" (
        "id" character varying NOT NULL DEFAULT 'default',
        "provider" character varying NOT NULL DEFAULT 'deepseek',
        "base_url" character varying NOT NULL DEFAULT 'https://api.deepseek.com',
        "model" character varying NOT NULL DEFAULT 'deepseek-chat',
        "api_key" text,
        "temperature" double precision NOT NULL DEFAULT 0.2,
        "enabled" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chatbot_settings_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "chatbot_settings"`);
  }
}
