import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSeoTables1753900000000 implements MigrationInterface {
  name = 'CreateSeoTables1753900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "project_seo_sites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "hostname" character varying NOT NULL,
        "title" character varying NOT NULL DEFAULT '',
        "created_by_id" uuid NOT NULL,
        "gsc_refresh_token" text,
        "gsc_property_uri" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_seo_sites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_seo_sites_project_hostname" UNIQUE ("project_id", "hostname"),
        CONSTRAINT "FK_project_seo_sites_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_seo_sites_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_seo_sites_project_id"
      ON "project_seo_sites" ("project_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "project_seo_audit_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "site_id" uuid NOT NULL,
        "status" character varying NOT NULL,
        "error_code" character varying,
        "error_message" text,
        "started_at" TIMESTAMP,
        "finished_at" TIMESTAMP,
        "robots_txt" text,
        "sitemap_urls" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_seo_audit_runs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_seo_audit_runs_site" FOREIGN KEY ("site_id")
          REFERENCES "project_seo_sites"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_seo_audit_runs_site_id"
      ON "project_seo_audit_runs" ("site_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "project_seo_audit_pages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "run_id" uuid NOT NULL,
        "url" text NOT NULL,
        "status_code" integer,
        "redirect_to" text,
        "title" text NOT NULL DEFAULT '',
        "meta_description" text NOT NULL DEFAULT '',
        "og_ok" boolean NOT NULL DEFAULT false,
        "jsonld_ok" boolean NOT NULL DEFAULT false,
        "robots_allowed" boolean NOT NULL DEFAULT true,
        "in_sitemap" boolean NOT NULL DEFAULT false,
        "broken_link" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_seo_audit_pages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_seo_audit_pages_run" FOREIGN KEY ("run_id")
          REFERENCES "project_seo_audit_runs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_seo_audit_pages_run_id"
      ON "project_seo_audit_pages" ("run_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "project_seo_lighthouse_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "run_id" uuid NOT NULL,
        "url" text NOT NULL,
        "lcp" double precision,
        "cls" double precision,
        "inp" double precision,
        "categories" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "key_audits" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "error_code" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_seo_lighthouse_runs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_seo_lighthouse_runs_run" FOREIGN KEY ("run_id")
          REFERENCES "project_seo_audit_runs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_seo_lighthouse_runs_run_id"
      ON "project_seo_lighthouse_runs" ("run_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "project_seo_gsc_rows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "site_id" uuid NOT NULL,
        "dimension" character varying NOT NULL,
        "value" text NOT NULL,
        "clicks" integer NOT NULL DEFAULT 0,
        "impressions" integer NOT NULL DEFAULT 0,
        "ctr" double precision NOT NULL DEFAULT 0,
        "position" double precision NOT NULL DEFAULT 0,
        "range_start" date NOT NULL,
        "range_end" date NOT NULL,
        "fetched_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_project_seo_gsc_rows" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_seo_gsc_rows_site" FOREIGN KEY ("site_id")
          REFERENCES "project_seo_sites"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_seo_gsc_rows_site_id"
      ON "project_seo_gsc_rows" ("site_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "seo_settings" (
        "id" character varying NOT NULL DEFAULT 'default',
        "max_pages_per_audit" integer NOT NULL DEFAULT 200,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_seo_settings_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "seo_settings" ("id", "max_pages_per_audit")
      VALUES ('default', 200)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "seo_settings"`);
    await queryRunner.query(`DROP TABLE "project_seo_gsc_rows"`);
    await queryRunner.query(`DROP TABLE "project_seo_lighthouse_runs"`);
    await queryRunner.query(`DROP TABLE "project_seo_audit_pages"`);
    await queryRunner.query(`DROP TABLE "project_seo_audit_runs"`);
    await queryRunner.query(`DROP TABLE "project_seo_sites"`);
  }
}
