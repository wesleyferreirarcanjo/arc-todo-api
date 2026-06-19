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
| Build pack | Nixpacks |
| Public URL | `http://lmsx2avrg1k29ex12w6e3gce.72.60.59.203.sslip.io` |
| Health check | `GET /health` → `{ "status": "ok" }` |

### Build / run

| Step | Command |
| --- | --- |
| Install | `npm ci` |
| Build | `npm run build` |
| Start | `npm run start:prod` |
| Port | `3000` |

## Related resources

| Resource | UUID | Notes |
| --- | --- | --- |
| PostgreSQL `arc-todo-postgres` | `bibl6ncxa3xkph2r8ubmbl4t` | Private; internal host `bibl6ncxa3xkph2r8ubmbl4t:5432` |
| Frontend `arc-todo-web` | `ifo33mi1s8efs8myb5g441vh` | `http://ifo33mi1s8efs8myb5g441vh.72.60.59.203.sslip.io` |

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

## Deploy order

1. Ensure `arc-todo-postgres` is `running:healthy`.
2. Deploy / restart `arc-todo-api`.
3. Deploy `arc-todo-web` after the API URL is known (frontend bakes `VITE_API_BASE_URL` at build time).

## Notes

- TypeORM migrations run automatically on startup when `DB_MIGRATE_ON_START=true`. Keep `DB_SYNCHRONIZE=false` in production.
- Git source uses the Coolify deploy key (`private_key_uuid`: `lms2y9fjpybdznft4t7uf3td`). Repositories are public for clone access during setup.
- See [../arc-todo-web/coolify.md](../arc-todo-web/coolify.md) for the frontend Coolify reference.
