# Coolify — arc-todo API

NestJS API deployed in Coolify project **`arc-todo`** on server **`main`** (`72.60.59.203`).

## Project

| Field | Value |
| --- | --- |
| Coolify project name | `arc-todo` |
| Coolify project UUID | `qzmm8hhki6jz02yrrc21zung` |
| Environment | `production` (`oqofaco0eved39jqee22w7jo`) |
| Server UUID | `r9rokxstz1zlccajjxyenk93` |
| Destination UUID | `wchjqtdyj949s0ale2zofwgd` |

## This application

| Field | Value |
| --- | --- |
| Coolify resource name | `arc-todo-api` |
| Application UUID | `lmsx2avrg1k29ex12w6e3gce` |
| Repository | [wesleyferreirarcanjo/arc-todo-api](https://github.com/wesleyferreirarcanjo/arc-todo-api) |
| Branch | `main` |
| Build pack | Dockerfile |
| Dockerfile | `/Dockerfile` |
| Public URL | `http://lmsx2avrg1k29ex12w6e3gce.72.60.59.203.sslip.io` |
| Health check | `GET /health` → `{ "status": "ok" }` |

### Build / run

| Step | Command |
| --- | --- |
| Build | `docker build -f Dockerfile .` |
| Start | `node dist/main.js` |
| Port | `3000` |

## Related resources

| Resource | UUID | Notes |
| --- | --- | --- |
| PostgreSQL `arc-todo-postgres` | `bibl6ncxa3xkph2r8ubmbl4t` | Private; internal host `bibl6ncxa3xkph2r8ubmbl4t:5432` |
| MinIO `arc-todo-minio` | `jsx5tkzb1b8hj5oz0ydt491u` | Private; internal host `minio-jsx5tkzb1b8hj5oz0ydt491u:9000` |
| Frontend `arc-todo-web` | `ifo33mi1s8efs8myb5g441vh` | `http://ifo33mi1s8efs8myb5g441vh.72.60.59.203.sslip.io` |
| MCP `arc-todo-mcp` | `qv9bek5he3ns8upu71rphbrc` | `http://qv9bek5he3ns8upu71rphbrc.72.60.59.203.sslip.io/mcp` |
| Chatbot `arc-todo-chatbot` | *(provision in Coolify)* | Loads runtime AI settings from `GET /chatbot-settings/runtime` |

## Environment variables (production)

Secrets are stored in Coolify only. Do not commit real values.

| Variable | Purpose |
| --- | --- |
| `PORT` | `3000` |
| `DB_HOST` | Postgres internal hostname (`bibl6ncxa3xkph2r8ubmbl4t`) |
| `DB_PORT` | `5432` |
| `DB_USERNAME` | `arc_todo` |
| `DB_PASSWORD` | *(redacted — Coolify secret)* |
| `DB_DATABASE` | `arc_todo` |
| `JWT_SECRET` | *(redacted — Coolify secret)* |
| `JWT_EXPIRES_IN` | `7d` |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | *(redacted — Coolify secret)* |
| `CORS_ORIGIN` | Frontend URL (`http://ifo33mi1s8efs8myb5g441vh.72.60.59.203.sslip.io`) |
| `NODE_ENV` | `production` |
| `DB_MIGRATE_ON_START` | `true` (runs pending TypeORM migrations before the app starts) |
| `DB_SYNCHRONIZE` | `false` (do not enable in production) |
| `MINIO_ENDPOINT` | Internal MinIO hostname (`minio-jsx5tkzb1b8hj5oz0ydt491u`) |
| `MINIO_PORT` | `9000` |
| `MINIO_USE_SSL` | `false` |
| `MINIO_ACCESS_KEY` | `arc_todo_minio` |
| `MINIO_SECRET_KEY` | *(redacted — Coolify secret)* |
| `MINIO_BUCKET` | `arc-todo` |
| `MINIO_MAX_UPLOAD_BYTES` | `104857600` (100 MB) |

## Deploy order

1. Ensure `arc-todo-postgres` is `running:healthy`.
2. Ensure `arc-todo-minio` is `running:healthy`.
3. Deploy / restart `arc-todo-api` (runs migrations and connects to MinIO on startup).
4. Deploy / restart `arc-todo-chatbot` so it can load chatbot settings from this API.
5. Deploy `arc-todo-web` after the API and chatbot URLs are known (frontend bakes `VITE_API_BASE_URL` and `VITE_CHAT_API_BASE_URL` at build time).
6. Configure chatbot settings at `/settings/chatbot` and MCP tools in the web app.
7. Deploy / restart `arc-todo-mcp` after MCP tools are configured.

## Notes

- TypeORM migrations run automatically on startup when `DB_MIGRATE_ON_START=true`. Keep `DB_SYNCHRONIZE=false` in production.
- MinIO is internal-only; knowledge attachment downloads are streamed through the authenticated API, not via public MinIO URLs.
- The API auto-creates the `arc-todo` bucket on startup if it does not exist.
- Git source uses the Coolify deploy key (`private_key_uuid`: `lms2y9fjpybdznft4t7uf3td`). Repositories are public for clone access during setup.
- Chatbot provider settings are stored in PostgreSQL and exposed via `/chatbot-settings`; the chatbot service reads them at runtime.
- See [../arc-todo-web/coolify.md](../arc-todo-web/coolify.md) for the frontend Coolify reference.
- See [../arc-todo-chatbot/coolify.md](../arc-todo-chatbot/coolify.md) for the chatbot service Coolify reference.
- See [../arc-todo-mcp/coolify.md](../arc-todo-mcp/coolify.md) for the MCP server Coolify reference.
