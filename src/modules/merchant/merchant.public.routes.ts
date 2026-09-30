import { Router } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { sendData } from "../../shared/http.js";
import { validate } from "../../shared/middleware/validate.js";
import { publicProductParamsSchema, publicShopParamsSchema } from "./merchant.schemas.js";
import { getPublicProduct, getPublicMerchant, listPublicProducts } from "./merchant.service.js";

export const publicMerchantRouter = Router();

publicMerchantRouter.get(
  "/:merchantSlug",
  validate(publicShopParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    sendData(res, { merchant: await getPublicMerchant(req.params.merchantSlug as string) });
  }),
);

publicMerchantRouter.get(
  "/:merchantSlug/products",
  validate(publicShopParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    sendData(res, { products: await listPublicProducts(req.params.merchantSlug as string) });
  }),
);

publicMerchantRouter.get(
  "/:merchantSlug/products/:productSlug",
  validate(publicProductParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    sendData(res, {
      product: await getPublicProduct(req.params.merchantSlug as string, req.params.productSlug as string),
    });
  }),
);
