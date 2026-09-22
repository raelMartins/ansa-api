import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

const LOCK_KEY = 847_201;

async function listUpFiles(): Promise<string[]> {
  const names = await readdir(migrationsDir);
  return names.filter((name) => name.endsWith(".sql") && !name.endsWith(".down.sql")).sort();
}

function downName(upFile: string): string {
  return upFile.replace(/\.sql$/, ".down.sql");
}

async function ensureTable(client: pg.Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function migrateUp(connectionString = env().DATABASE_URL): Promise<string[]> {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to migrate");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  const applied: string[] = [];

  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await ensureTable(client);

    const { rows } = await client.query<{ id: string }>("SELECT id FROM schema_migrations ORDER BY id");
    const done = new Set(rows.map((r) => r.id));
    const files = await listUpFiles();

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
        logger.info({ file }, "Applied migration");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    } catch {
      /* client may already be broken */
    }
    await client.end();
  }

  return applied;
}

export async function migrateDown(connectionString = env().DATABASE_URL): Promise<string | undefined> {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to migrate");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await ensureTable(client);

    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1",
    );
    const last = rows[0]?.id;
    if (!last) {
      logger.info("No migrations to roll back");
      return undefined;
    }

    const sql = await readFile(path.join(migrationsDir, downName(last)), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("DELETE FROM schema_migrations WHERE id = $1", [last]);
      await client.query("COMMIT");
      logger.info({ file: last }, "Rolled back migration");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
    return last;
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    } catch {
      /* ignore */
    }
    await client.end();
  }
}
