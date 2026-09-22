import { Router } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { sendData } from "../../shared/http.js";
import { validate } from "../../shared/middleware/validate.js";
import { requireAuth } from "./auth.middleware.js";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schemas.js";
import { getMe, login, logout, refresh, register } from "./auth.service.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await register(req.body);
    sendData(res, result, 201);
  }),
);

authRouter.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    sendData(res, await login(req.body));
  }),
);

authRouter.post(
  "/refresh",
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    sendData(res, { tokens: await refresh(req.body.refreshToken) });
  }),
);

authRouter.post(
  "/logout",
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    await logout(req.body.refreshToken);
    sendData(res, { ok: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    sendData(res, { user: await getMe(req.userId as string) });
  }),
);
