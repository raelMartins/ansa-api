import "dotenv/config";
import { loadEnv } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { migrateDown, migrateUp } from "./migrate.js";

async function main(): Promise<void> {
  loadEnv();
  const direction = process.argv[2] === "down" ? "down" : "up";
  if (direction === "down") {
    const rolled = await migrateDown();
    logger.info({ rolled }, "Migrate down complete");
  } else {
    const applied = await migrateUp();
    logger.info({ applied }, "Migrate up complete");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
