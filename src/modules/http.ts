import type { Express, RequestHandler } from "express";
import { sendData } from "../shared/http.js";
import { authRouter } from "./auth/index.js";
import { healthRouter } from "./health/health.routes.js";
import { liveness } from "./health/health.service.js";
import { checkoutRouter, merchantOrdersRouter, paymentsRouter, publicOrderRouter } from "./orders/index.js";
import { merchantCollectionRouter, merchantScopedRouter, publicMerchantRouter } from "./merchant/index.js";

export function mountHttp(app: Express, deps: { authLimiter: RequestHandler }): void {
  app.get("/health", (_req, res) => {
    sendData(res, liveness());
  });

  app.use("/v1", healthRouter);
  app.use("/v1/auth", deps.authLimiter, authRouter);
  app.use("/v1/me/merchants", merchantCollectionRouter);
  app.use("/v1/me/merchants/:merchantId/orders", merchantOrdersRouter);
  app.use("/v1/me/merchants/:merchantId", merchantScopedRouter);
  app.use("/v1/merchants", publicMerchantRouter);
  app.use("/v1/checkout", checkoutRouter);
  app.use("/v1/orders", publicOrderRouter);
  app.use("/v1/payments", paymentsRouter);
}
