import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../errors.js";
import { logger } from "../logger.js";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId;
  const isApp = err instanceof AppError;
  const status = isApp ? err.statusCode : 500;
  const code = isApp ? err.code : "INTERNAL_ERROR";
  const production = env().isProduction;
  const showDetails = isApp && err.expose;
  const message =
    isApp && (err.expose || !production)
      ? err.message
      : production
        ? "Internal error"
        : err instanceof Error
          ? err.message
          : "Internal error";

  logger.error({ err, requestId, status, code }, isApp ? err.message : "Unhandled error");

  res.status(status).json({
    error: {
      code,
      message,
      details: showDetails ? err.details : undefined,
      requestId,
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `No route for ${req.method} ${req.path}`,
      requestId: req.requestId,
    },
  });
}
