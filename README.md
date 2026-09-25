# ansa-api

Modular-monolith HTTP API for the **ansa** ecosystem (B-Koda Limited).

This repository is the platform foundation. Product domains (shop, delivery, jobs, locate, check, meets) have module folders but no feature APIs yet.

## Stack

- Node.js 22+, TypeScript, Express
- PostgreSQL via `pg`
- Versioned SQL in `migrations/`
- Auth: scrypt password hashes, short-lived JWT access tokens, hashed refresh tokens

## Setup

```bash
cp .env.example .env
pnpm install
```

From the workspace root (`ansa/`): `pnpm docker:up` (Postgres), then `pnpm api:migrate`, `pnpm api:dev`. Shop UI: `pnpm shop:dev` (port 3000). `pnpm docker:down` stops the database container.

Default local URL: `http://localhost:5000` (`PORT` in `.env`). Leave 3000 for web clients.

- Liveness: `GET /health` and `GET /v1/health`
- Readiness: `GET /v1/ready` (needs Postgres)
- OpenAPI: `docs/openapi.yaml`

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Watch mode |
| `pnpm build` | Compile to `dist/` |
| `pnpm start` | Run compiled server |
| `pnpm migrate` | Apply SQL migrations |
| `pnpm migrate:down` | Roll back the last migration |
| `pnpm test` | Vitest |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |

## Adding a product module

1. Keep tables and SQL in `migrations/`, owned by that module (comment the owner).
2. Put queries in `src/modules/<name>/` — never query another module’s tables.
3. Export a router from that module.
4. Mount it in `src/modules/http.ts` (the only HTTP composition point).

Empty shells (`delivery`, `jobs`, …) exist as folders only. Do not mount them until they have real routes.

Shop v1 (mounted): authenticated `/v1/me/shop` and public `/v1/shops/:slug`. Prices are integer **kobo**. `DELETE` archives a product; drafts/archived are hidden from public GETs.

## Module boundaries

Cross-module work goes through each module’s public `index.ts` / service. Do not query another module’s tables from a repository.

`users.id` is the v1 ansa ID. Payments are orchestration only; no provider is wired yet.
