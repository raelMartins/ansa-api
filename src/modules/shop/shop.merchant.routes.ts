import { Router } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { sendData } from "../../shared/http.js";
import { validate } from "../../shared/middleware/validate.js";
import { requireAuth } from "../auth/index.js";
import {
  createProductSchema,
  createShopSchema,
  productIdParamSchema,
  updateProductSchema,
  updateShopSchema,
} from "./shop.schemas.js";
import {
  archiveMyProduct,
  createProduct,
  createShop,
  getMyProduct,
  getMyShop,
  listMyProducts,
  updateMyProduct,
  updateMyShop,
} from "./shop.service.js";

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
