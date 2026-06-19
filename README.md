# arc-todo-api

NestJS API for Arc Todo — personal task management with JWT bearer authentication.

## Stack

- NestJS
- TypeORM
- PostgreSQL
- JWT bearer auth

## Prerequisites

- Node.js 20+
- PostgreSQL running locally (or via Docker)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Create the database:

```sql
CREATE DATABASE arc_todo;
```

4. Start the API:

```bash
npm run start:dev
```

The API runs at `http://localhost:3000`.

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API port | `3000` |
| `DB_HOST` | Postgres host | `localhost` |
| `DB_PORT` | Postgres port | `5432` |
| `DB_USERNAME` | Postgres user | `postgres` |
| `DB_PASSWORD` | Postgres password | `postgres` |
| `DB_DATABASE` | Database name | `arc_todo` |
| `JWT_SECRET` | JWT signing secret | `change-me-in-production` |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `ADMIN_USERNAME` | Seeded admin username | `admin` |
| `ADMIN_PASSWORD` | Seeded admin password | `admin123` |
| `CORS_ORIGIN` | Allowed web origin | `http://localhost:5173` |

On first startup, the API seeds the admin user if it does not exist.

## Endpoints

### Public

- `GET /health` — health check
- `POST /auth/login` — login with `{ username, password }`, returns bearer token

### Protected (Bearer token required)

- `GET /todos`
- `POST /todos`
- `GET /todos/:id`
- `PATCH /todos/:id`
- `DELETE /todos/:id`

Send the token as:

```
Authorization: Bearer <access_token>
```

## Scripts

- `npm run start:dev` — development with hot reload
- `npm run build` — compile TypeScript
- `npm run start:prod` — run compiled app
