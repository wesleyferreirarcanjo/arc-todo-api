import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrgProjectTaskSystem1750300000000 implements MigrationInterface {
  name = 'OrgProjectTaskSystem1750300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "organization_role_enum" AS ENUM ('owner', 'admin', 'member');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "task_status_enum" AS ENUM ('todo', 'in_progress', 'done');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "task_priority_enum" AS ENUM ('low', 'medium', 'high');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" "organization_role_enum" NOT NULL DEFAULT 'member',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_organization_members_org_user" UNIQUE ("organization_id", "user_id"),
        CONSTRAINT "PK_organization_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_organization_members_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organization_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "projects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id"),
        CONSTRAINT "FK_projects_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "description" text,
        "status" "task_status_enum" NOT NULL DEFAULT 'todo',
        "priority" "task_priority_enum" NOT NULL DEFAULT 'medium',
        "due_date" TIMESTAMPTZ,
        "project_id" uuid NOT NULL,
        "created_by_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tasks_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tasks_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    const todosTable = await queryRunner.query(`
      SELECT to_regclass('public.todos') AS table_name
    `);

    if (todosTable[0]?.table_name) {
      const usersWithTodos = await queryRunner.query(`
        SELECT DISTINCT u.id AS user_id
        FROM users u
        INNER JOIN todos t ON t.user_id = u.id
      `);

      for (const row of usersWithTodos) {
        const userId: string = row.user_id;
        const userIdPrefix = userId.replace(/-/g, '').slice(0, 8);
        const slug = `personal-${userIdPrefix}`;

        const orgResult = await queryRunner.query(
          `
          INSERT INTO organizations (name, slug)
          VALUES ($1, $2)
          RETURNING id
        `,
          ['Personal', slug],
        );
        const organizationId = orgResult[0].id;

        await queryRunner.query(
          `
          INSERT INTO organization_members (organization_id, user_id, role)
          VALUES ($1, $2, 'owner')
        `,
          [organizationId, userId],
        );

        const projectResult = await queryRunner.query(
          `
          INSERT INTO projects (organization_id, name)
          VALUES ($1, 'Inbox')
          RETURNING id
        `,
          [organizationId],
        );
        const projectId = projectResult[0].id;

        await queryRunner.query(
          `
          INSERT INTO tasks (
            id,
            title,
            description,
            status,
            priority,
            due_date,
            project_id,
            created_by_id,
            created_at,
            updated_at
          )
          SELECT
            t.id,
            t.title,
            t.description,
            t.status::text::task_status_enum,
            t.priority::text::task_priority_enum,
            t.due_date,
            $1,
            t.user_id,
            t.created_at,
            t.updated_at
          FROM todos t
          WHERE t.user_id = $2
        `,
          [projectId, userId],
        );
      }

      await queryRunner.query(`DROP TABLE IF EXISTS "todos"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "todos_status_enum" AS ENUM ('todo', 'in_progress', 'done');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "todos_priority_enum" AS ENUM ('low', 'medium', 'high');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "todos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "description" text,
        "status" "todos_status_enum" NOT NULL DEFAULT 'todo',
        "priority" "todos_priority_enum" NOT NULL DEFAULT 'medium',
        "due_date" TIMESTAMPTZ,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_todos" PRIMARY KEY ("id"),
        CONSTRAINT "FK_todos_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO todos (
        id,
        title,
        description,
        status,
        priority,
        due_date,
        user_id,
        created_at,
        updated_at
      )
      SELECT
        t.id,
        t.title,
        t.description,
        t.status::text::todos_status_enum,
        t.priority::text::todos_priority_enum,
        t.due_date,
        t.created_by_id,
        t.created_at,
        t.updated_at
      FROM tasks t
      WHERE t.created_by_id IS NOT NULL
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "task_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "task_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organization_role_enum"`);
  }
}
