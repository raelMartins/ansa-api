import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { badRequest } from "../errors.js";

type Part = "body" | "query" | "params";

export function validate<T>(schema: ZodType<T>, part: Part = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(fromZod(result.error));
      return;
    }
    req[part] = result.data as typeof req.body;
    next();
  };
}

export function fromZod(error: ZodError): ReturnType<typeof badRequest> {
  const details = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return badRequest("Request validation failed", details);
}
