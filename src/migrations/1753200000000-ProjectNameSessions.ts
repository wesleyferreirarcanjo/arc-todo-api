import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectNameSessions1753200000000 implements MigrationInterface {
  name = 'ProjectNameSessions1753200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_name_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "brief" text NOT NULL DEFAULT '',
        "naming_goal" character varying,
        "product_description" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "lanes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "candidates" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "shortlist_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "recommended_candidate_id" uuid,
        "runner_up_candidate_id" uuid,
        "decision_note" text,
        "feedback_rounds" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_name_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_name_sessions_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_name_sessions_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_name_sessions_project_id"
      ON "project_name_sessions" ("project_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "name_candidate_feedback" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "round_id" uuid NOT NULL,
        "candidate_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "first_impression" text NOT NULL DEFAULT '',
        "remembered_spelling" text NOT NULL DEFAULT '',
        "perceived_purpose" text NOT NULL DEFAULT '',
        "ratings" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "concern" text NOT NULL DEFAULT '',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_name_candidate_feedback" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_name_feedback_round_candidate_user" UNIQUE ("round_id", "candidate_id", "user_id"),
        CONSTRAINT "FK_name_feedback_session" FOREIGN KEY ("session_id")
          REFERENCES "project_name_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_name_feedback_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_name_feedback_session_id"
      ON "name_candidate_feedback" ("session_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_name_feedback_session_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "name_candidate_feedback"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_project_name_sessions_project_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "project_name_sessions"
    `);
  }
}
