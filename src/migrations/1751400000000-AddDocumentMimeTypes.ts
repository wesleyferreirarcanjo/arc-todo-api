import { MigrationInterface, QueryRunner } from 'typeorm';

const NEW_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export class AddDocumentMimeTypes1751400000000 implements MigrationInterface {
  name = 'AddDocumentMimeTypes1751400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const mimeType of NEW_MIME_TYPES) {
      await queryRunner.query(
        `
          UPDATE "rag_settings"
          SET "enabled_mime_types" = array_append("enabled_mime_types", $1)
          WHERE NOT ($1 = ANY("enabled_mime_types"))
        `,
        [mimeType],
      );
    }

    await queryRunner.query(`
      ALTER TABLE "rag_settings"
      ALTER COLUMN "enabled_mime_types"
      SET DEFAULT ARRAY[
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/json',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const mimeType of NEW_MIME_TYPES) {
      await queryRunner.query(
        `
          UPDATE "rag_settings"
          SET "enabled_mime_types" = array_remove("enabled_mime_types", $1)
        `,
        [mimeType],
      );
    }

    await queryRunner.query(`
      ALTER TABLE "rag_settings"
      ALTER COLUMN "enabled_mime_types"
      SET DEFAULT ARRAY['text/plain','text/markdown','text/csv','application/json']
    `);
  }
}
