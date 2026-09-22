import { Router } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { sendData } from "../../shared/http.js";
import { liveness, readiness } from "./health.service.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  sendData(res, liveness());
});

healthRouter.get("/ready", asyncHandler(async (_req, res) => {
  sendData(res, await readiness());
}));
