import { Router } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { sendData } from "../../shared/http.js";
import { validate } from "../../shared/middleware/validate.js";
import { requireAuth } from "../auth/index.js";
import { createMerchant, listMerchantsForOwner } from "./merchant.service.js";
import { createMerchantSchema } from "./merchant.schemas.js";

export const merchantCollectionRouter = Router();

merchantCollectionRouter.use(requireAuth);

merchantCollectionRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    sendData(res, { merchants: await listMerchantsForOwner(req.userId as string) });
  }),
);

merchantCollectionRouter.post(
  "/",
  validate(createMerchantSchema),
  asyncHandler(async (req, res) => {
    sendData(res, { merchant: await createMerchant(req.userId as string, req.body) }, 201);
  }),
);
