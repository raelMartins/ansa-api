import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { closePool } from "./db/pool.js";
import { logger } from "./shared/logger.js";

const config = loadEnv();
const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, "ansa-api listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    void closePool().finally(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
