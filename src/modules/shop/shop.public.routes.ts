import { Router } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { sendData } from "../../shared/http.js";
import { validate } from "../../shared/middleware/validate.js";
import { publicProductParamsSchema, publicShopParamsSchema } from "./shop.schemas.js";
import { getPublicProduct, getPublicShop, listPublicProducts } from "./shop.service.js";

export const publicShopRouter = Router();

publicShopRouter.get(
  "/:shopSlug",
  validate(publicShopParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    sendData(res, { shop: await getPublicShop(req.params.shopSlug as string) });
  }),
);

publicShopRouter.get(
  "/:shopSlug/products",
  validate(publicShopParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    sendData(res, { products: await listPublicProducts(req.params.shopSlug as string) });
  }),
);

publicShopRouter.get(
  "/:shopSlug/products/:productSlug",
  validate(publicProductParamsSchema, "params"),
  asyncHandler(async (req, res) => {
    sendData(res, {
      product: await getPublicProduct(req.params.shopSlug as string, req.params.productSlug as string),
    });
  }),
);
