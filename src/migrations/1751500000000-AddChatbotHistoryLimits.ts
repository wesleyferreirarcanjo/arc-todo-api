import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatbotHistoryLimits1751500000000
  implements MigrationInterface
{
  name = 'AddChatbotHistoryLimits1751500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chatbot_settings"
      ADD COLUMN IF NOT EXISTS "max_history_messages" integer NOT NULL DEFAULT 50
    `);
    await queryRunner.query(`
      ALTER TABLE "chatbot_settings"
      ADD COLUMN IF NOT EXISTS "max_history_tokens" integer NOT NULL DEFAULT 100000
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chatbot_settings" DROP COLUMN IF EXISTS "max_history_tokens"
    `);
    await queryRunner.query(`
      ALTER TABLE "chatbot_settings" DROP COLUMN IF EXISTS "max_history_messages"
    `);
  }
}
