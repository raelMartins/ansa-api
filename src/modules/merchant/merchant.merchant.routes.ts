import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { sendData } from "../../shared/http.js";
import { validate } from "../../shared/middleware/validate.js";
import { requireAuth } from "../auth/index.js";
import { merchantCustomers, merchantOverview } from "../orders/orders.service.js";
import {
  archiveMyProduct,
  createProduct,
  disconnectChannel,
  getItemShare,
  getMyProduct,
  getMerchant,
  getMyWhatsApp,
  listMyActivity,
  listMyIntegrations,
  listMyProducts,
  saveMerchantMedia,
  shareItem,
  simulateConnect,
  updateMyProduct,
  updateMerchant,
  updateMyWhatsApp,
} from "./merchant.service.js";
import {
  channelParamSchema,
  connectSchema,
  createProductSchema,
  mediaSchema,
  productIdParamSchema,
  shareSchema,
  updateProductSchema,
  updateMerchantSchema,
  whatsappSettingsSchema,
} from "./merchant.schemas.js";

const merchantIdParam = z.object({ merchantId: z.string().uuid() });

export const merchantScopedRouter = Router({ mergeParams: true });

merchantScopedRouter.use(requireAuth);
merchantScopedRouter.use(validate(merchantIdParam, "params"));

merchantScopedRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, { merchant: await getMerchant(req.userId as string, merchantId) });
  }),
);

merchantScopedRouter.patch(
  "/",
  validate(updateMerchantSchema),
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, { merchant: await updateMerchant(req.userId as string, merchantId, req.body) });
  }),
);

merchantScopedRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, await merchantOverview(req.userId as string, merchantId));
  }),
);

merchantScopedRouter.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, { customers: await merchantCustomers(req.userId as string, merchantId) });
  }),
);

merchantScopedRouter.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, { events: await listMyActivity(req.userId as string, merchantId) });
  }),
);

merchantScopedRouter.post(
  "/media",
  validate(mediaSchema),
  asyncHandler(async (req, res) => {
    sendData(res, await saveMerchantMedia(req.body.dataUrl), 201);
  }),
);

merchantScopedRouter.get(
  "/integrations",
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, { integrations: await listMyIntegrations(req.userId as string, merchantId) });
  }),
);

merchantScopedRouter.post(
  "/integrations/:channel/simulate",
  validate(channelParamSchema, "params"),
  validate(connectSchema),
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, {
      integration: await simulateConnect(
        req.userId as string,
        merchantId,
        req.params.channel as "whatsapp" | "instagram" | "tiktok" | "x",
        req.body.account,
      ),
    });
  }),
);

merchantScopedRouter.post(
  "/integrations/:channel/disconnect",
  validate(channelParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, {
      integration: await disconnectChannel(
        req.userId as string,
        merchantId,
        req.params.channel as "whatsapp" | "instagram" | "tiktok" | "x",
      ),
    });
  }),
);

merchantScopedRouter.get(
  "/whatsapp",
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, await getMyWhatsApp(req.userId as string, merchantId));
  }),
);

merchantScopedRouter.patch(
  "/whatsapp",
  validate(whatsappSettingsSchema),
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, await updateMyWhatsApp(req.userId as string, merchantId, req.body));
  }),
);

merchantScopedRouter.post(
  "/products",
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, { product: await createProduct(req.userId as string, merchantId, req.body) }, 201);
  }),
);

merchantScopedRouter.get(
  "/products",
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, { products: await listMyProducts(req.userId as string, merchantId) });
  }),
);

merchantScopedRouter.get(
  "/products/:productId",
  validate(productIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, { product: await getMyProduct(req.userId as string, merchantId, req.params.productId as string) });
  }),
);

merchantScopedRouter.get(
  "/products/:productId/share",
  validate(productIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, await getItemShare(req.userId as string, merchantId, req.params.productId as string));
  }),
);

merchantScopedRouter.post(
  "/products/:productId/share",
  validate(productIdParamSchema, "params"),
  validate(shareSchema),
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, await shareItem(req.userId as string, merchantId, req.params.productId as string, req.body));
  }),
);

merchantScopedRouter.patch(
  "/products/:productId",
  validate(productIdParamSchema, "params"),
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, {
      product: await updateMyProduct(req.userId as string, merchantId, req.params.productId as string, req.body),
    });
  }),
);

merchantScopedRouter.delete(
  "/products/:productId",
  validate(productIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const merchantId = req.params.merchantId as string;
    sendData(res, { product: await archiveMyProduct(req.userId as string, merchantId, req.params.productId as string) });
  }),
);
