import { Router } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { sendData } from "../../shared/http.js";
import { validate } from "../../shared/middleware/validate.js";
import { requireAuth } from "../auth/index.js";
import { merchantCustomers, merchantOverview } from "../orders/orders.service.js";
import {
  archiveMyProduct,
  createProduct,
  createShop,
  disconnectChannel,
  getItemShare,
  getMyProduct,
  getMyShop,
  getMyWhatsApp,
  listMyActivity,
  listMyIntegrations,
  listMyProducts,
  saveMerchantMedia,
  shareItem,
  simulateConnect,
  updateMyProduct,
  updateMyShop,
  updateMyWhatsApp,
} from "./shop.service.js";
import {
  channelParamSchema,
  connectSchema,
  createProductSchema,
  createShopSchema,
  mediaSchema,
  productIdParamSchema,
  shareSchema,
  updateProductSchema,
  updateShopSchema,
  whatsappSettingsSchema,
} from "./shop.schemas.js";

export const merchantShopRouter = Router();

merchantShopRouter.use(requireAuth);

merchantShopRouter.post(
  "/",
  validate(createShopSchema),
  asyncHandler(async (req, res) => {
    sendData(res, { shop: await createShop(req.userId as string, req.body) }, 201);
  }),
);

merchantShopRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    sendData(res, { shop: await getMyShop(req.userId as string) });
  }),
);

merchantShopRouter.patch(
  "/",
  validate(updateShopSchema),
  asyncHandler(async (req, res) => {
    sendData(res, { shop: await updateMyShop(req.userId as string, req.body) });
  }),
);

merchantShopRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    sendData(res, await merchantOverview(req.userId as string));
  }),
);

merchantShopRouter.get(
  "/customers",
  asyncHandler(async (req, res) => {
    sendData(res, { customers: await merchantCustomers(req.userId as string) });
  }),
);

merchantShopRouter.get(
  "/activity",
  asyncHandler(async (req, res) => {
    sendData(res, { events: await listMyActivity(req.userId as string) });
  }),
);

merchantShopRouter.post(
  "/media",
  validate(mediaSchema),
  asyncHandler(async (req, res) => {
    sendData(res, await saveMerchantMedia(req.body.dataUrl), 201);
  }),
);

merchantShopRouter.get(
  "/integrations",
  asyncHandler(async (req, res) => {
    sendData(res, { integrations: await listMyIntegrations(req.userId as string) });
  }),
);

merchantShopRouter.post(
  "/integrations/:channel/simulate",
  validate(channelParamSchema, "params"),
  validate(connectSchema),
  asyncHandler(async (req, res) => {
    sendData(res, {
      integration: await simulateConnect(
        req.userId as string,
        req.params.channel as "whatsapp" | "instagram" | "tiktok" | "x",
        req.body.account,
      ),
    });
  }),
);

merchantShopRouter.post(
  "/integrations/:channel/disconnect",
  validate(channelParamSchema, "params"),
  asyncHandler(async (req, res) => {
    sendData(res, {
      integration: await disconnectChannel(
        req.userId as string,
        req.params.channel as "whatsapp" | "instagram" | "tiktok" | "x",
      ),
    });
  }),
);

merchantShopRouter.get(
  "/whatsapp",
  asyncHandler(async (req, res) => {
    sendData(res, await getMyWhatsApp(req.userId as string));
  }),
);

merchantShopRouter.patch(
  "/whatsapp",
  validate(whatsappSettingsSchema),
  asyncHandler(async (req, res) => {
    sendData(res, await updateMyWhatsApp(req.userId as string, req.body));
  }),
);

merchantShopRouter.post(
  "/products",
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    sendData(res, { product: await createProduct(req.userId as string, req.body) }, 201);
  }),
);

merchantShopRouter.get(
  "/products",
  asyncHandler(async (req, res) => {
    sendData(res, { products: await listMyProducts(req.userId as string) });
  }),
);

merchantShopRouter.get(
  "/products/:productId",
  validate(productIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    sendData(res, { product: await getMyProduct(req.userId as string, req.params.productId as string) });
  }),
);

merchantShopRouter.get(
  "/products/:productId/share",
  validate(productIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    sendData(res, await getItemShare(req.userId as string, req.params.productId as string));
  }),
);

merchantShopRouter.post(
  "/products/:productId/share",
  validate(productIdParamSchema, "params"),
  validate(shareSchema),
  asyncHandler(async (req, res) => {
    sendData(res, await shareItem(req.userId as string, req.params.productId as string, req.body));
  }),
);

merchantShopRouter.patch(
  "/products/:productId",
  validate(productIdParamSchema, "params"),
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    sendData(res, {
      product: await updateMyProduct(req.userId as string, req.params.productId as string, req.body),
    });
  }),
);

merchantShopRouter.delete(
  "/products/:productId",
  validate(productIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    sendData(res, { product: await archiveMyProduct(req.userId as string, req.params.productId as string) });
  }),
);
