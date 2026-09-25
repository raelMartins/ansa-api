import type { Express, RequestHandler } from "express";
import { sendData } from "../shared/http.js";
import { authRouter } from "./auth/index.js";
import { healthRouter } from "./health/health.routes.js";
import { liveness } from "./health/health.service.js";

/**
 * Single HTTP mount point for the modular monolith.
 *
 * When a product is ready, import its router and mount it here, e.g.:
 *   app.use("/v1/shop", shopRouter)
 *
 * Do not mount empty product shells. Do not let one module register another
 * module's routes.
 */
export function mountHttp(app: Express, deps: { authLimiter: RequestHandler }): void {
  app.get("/health", (_req, res) => {
    sendData(res, liveness());
  });

  app.use("/v1", healthRouter);
  app.use("/v1/auth", deps.authLimiter, authRouter);
}
