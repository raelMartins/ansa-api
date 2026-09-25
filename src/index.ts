import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { closePool } from "./db/pool.js";
import { logger } from "./shared/logger.js";

const SHUTDOWN_MS = 10_000;

const config = loadEnv();
const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, "ansa-api listening");
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    logger.error(
      { port: config.PORT },
      `Port ${config.PORT} is already in use. Stop the other process or set PORT in .env.`,
    );
    process.exit(1);
  }
  throw err;
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");

  const timer = setTimeout(() => {
    logger.error({ ms: SHUTDOWN_MS }, "Graceful shutdown timed out");
    process.exit(1);
  }, SHUTDOWN_MS);
  timer.unref();

  server.close((closeErr) => {
    if (closeErr) {
      logger.error({ err: closeErr }, "Error closing HTTP server");
    }
    void closePool()
      .catch((err) => {
        logger.error({ err }, "Error closing PostgreSQL pool");
      })
      .finally(() => {
        process.exit(closeErr ? 1 : 0);
      });
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandledRejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException");
  shutdown("uncaughtException");
});
