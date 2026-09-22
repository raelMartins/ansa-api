import pg from "pg";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const url = env().DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
    pool.on("error", (err) => {
      logger.error({ err }, "Idle PostgreSQL client error");
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export type Queryable = Pick<pg.Pool | pg.PoolClient, "query">;
