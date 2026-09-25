import { config } from "dotenv";
import pg from "pg";
import { loadEnv, resetEnvForTests } from "../config/env.js";
import { migrateUp } from "../db/migrate.js";

export function withDatabaseName(connectionString: string, database: string): string {
  const parsed = new URL(connectionString);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export async function prepareIntegrationDatabase(): Promise<void> {
  config();

  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "test-access-secret-min-32-characters";
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret-min-32-characters";
  process.env.CORS_ORIGINS = "http://localhost:5173";
  process.env.LOG_LEVEL = "silent";

  const adminUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!adminUrl) {
    throw new Error(
      "Shop integration tests need DATABASE_URL or TEST_DATABASE_URL (start Postgres with docker compose).",
    );
  }

  const testUrl = withDatabaseName(adminUrl, "ansa_test");
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const found = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", ["ansa_test"]);
    if ((found.rowCount ?? 0) === 0) {
      await admin.query("CREATE DATABASE ansa_test");
    }
  } finally {
    await admin.end();
  }

  process.env.DATABASE_URL = testUrl;
  resetEnvForTests();
  loadEnv();
  await migrateUp(testUrl);
}
