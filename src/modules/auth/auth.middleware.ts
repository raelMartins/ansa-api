import type { NextFunction, Request, Response } from "express";
import { unauthorized } from "../../shared/errors.js";
import { verifyAccessToken } from "./auth.service.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    next(unauthorized());
    return;
  }
  const token = header.slice("bearer ".length).trim();
  if (!token) {
    next(unauthorized());
    return;
  }
  try {
    req.userId = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
