import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { sendData } from "../../shared/http.js";
import { validate } from "../../shared/middleware/validate.js";
import { requireAuth } from "../auth/index.js";
import {
  changeOrderStatus,
  checkout,
  completeMockPayment,
  getMerchantOrder,
  getPublicOrder,
  listMerchantOrders,
} from "./orders.service.js";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const checkoutSchema = z.object({
  shopSlug: slug,
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(40),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(7).max(24),
  customerEmail: z.string().trim().email().optional(),
  fulfilment: z.enum(["pickup", "delivery"]),
  deliveryAddress: z.string().trim().max(400).optional(),
  deliveryInstructions: z.string().trim().max(400).optional(),
});

export const checkoutRouter = Router();

checkoutRouter.post(
  "/",
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    sendData(res, await checkout(req.body), 201);
  }),
);

export const publicOrderRouter = Router();

publicOrderRouter.get(
  "/:reference",
  validate(z.object({ reference: z.string().trim().min(6).max(24) }), "params"),
  asyncHandler(async (req, res) => {
    sendData(res, await getPublicOrder(req.params.reference as string));
  }),
);

export const paymentsRouter = Router();

paymentsRouter.post(
  "/mock/complete",
  validate(z.object({ orderId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    sendData(res, await completeMockPayment(req.body.orderId));
  }),
);

const orderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "processing",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled",
  ]),
});

export const merchantOrdersRouter = Router();
merchantOrdersRouter.use(requireAuth);

merchantOrdersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    sendData(res, { orders: await listMerchantOrders(req.userId as string) });
  }),
);

merchantOrdersRouter.get(
  "/:orderId",
  validate(z.object({ orderId: z.string().uuid() }), "params"),
  asyncHandler(async (req, res) => {
    sendData(res, { order: await getMerchantOrder(req.userId as string, req.params.orderId as string) });
  }),
);

merchantOrdersRouter.patch(
  "/:orderId",
  validate(z.object({ orderId: z.string().uuid() }), "params"),
  validate(orderStatusSchema),
  asyncHandler(async (req, res) => {
    sendData(res, await changeOrderStatus(req.userId as string, req.params.orderId as string, req.body.status));
  }),
);
