import { mkdirSync } from "node:fs";
import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { mountHttp } from "./modules/http.js";
import { getUploadsDir } from "./modules/shop/shop.service.js";
import { logger } from "./shared/logger.js";
import { errorHandler, notFoundHandler } from "./shared/middleware/error-handler.js";
import { requestId } from "./shared/middleware/request-id.js";

export function createApp(): Express {
  const app = express();
  const config = env();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.url === "/v1/health",
      },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "8mb" }));
  mkdirSync(getUploadsDir(), { recursive: true });
  app.use("/uploads", express.static(getUploadsDir()));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.NODE_ENV === "test" ? 1000 : 50,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests",
          requestId: req.requestId,
        },
      });
    },
  });

  mountHttp(app, { authLimiter });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
