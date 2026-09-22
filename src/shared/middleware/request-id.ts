import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("x-request-id");
  req.requestId = header && header.trim().length > 0 ? header.trim() : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
