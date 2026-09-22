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
docker compose up -d
pnpm install
pnpm migrate
pnpm dev
```

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

## Module boundaries

Cross-module work goes through each module’s public `index.ts` / service. Do not query another module’s tables from a repository.

`users.id` is the v1 ansa ID. Payments are orchestration only; no provider is wired yet.
