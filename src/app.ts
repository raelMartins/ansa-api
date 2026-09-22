import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/index.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { liveness } from "./modules/health/health.service.js";
import { sendData } from "./shared/http.js";
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
    }),
  );
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

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

  app.get("/health", (_req, res) => {
    sendData(res, liveness());
  });

  app.use("/v1", healthRouter);
  app.use("/v1/auth", authLimiter, authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
