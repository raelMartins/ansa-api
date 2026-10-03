import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { getPool } from "../../db/pool.js";

const app = createApp();

async function register(email: string): Promise<string> {
  const res = await request(app)
    .post("/v1/auth/register")
    .send({ email, password: "password1" });
  expect(res.status).toBe(201);
  return res.body.data.tokens.accessToken as string;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe("merchant orders", () => {
  beforeEach(async () => {
    await getPool().query(
      `TRUNCATE domain_events, notification_events, merchant_payments, merchant_order_items, merchant_orders,
         catalog_publications, merchant_whatsapp_settings, merchant_integrations, products, merchants,
         refresh_tokens, users CASCADE`,
    );
  });

  it("lists empty orders for a new merchant", async () => {
    const token = await register("orders-empty@example.com");
    const created = await request(app).post("/v1/me/merchants").set(auth(token)).send({ name: "Order Shop" });
    const merchantId = created.body.data.merchant.id as string;

    const list = await request(app).get(`/v1/me/merchants/${merchantId}/orders`).set(auth(token));
    expect(list.status).toBe(200);
    expect(list.body.data.orders).toEqual([]);
  });

  it("runs checkout, mock payment, list, detail, and status updates", async () => {
    const token = await register("orders-flow@example.com");
    const created = await request(app).post("/v1/me/merchants").set(auth(token)).send({ name: "Flow Shop" });
    const merchantId = created.body.data.merchant.id as string;
    const slug = created.body.data.merchant.slug as string;

    const productRes = await request(app)
      .post(`/v1/me/merchants/${merchantId}/products`)
      .set(auth(token))
      .send({ title: "Test Tee", priceKobo: 500000, status: "published", qtyAvailable: 10 });
    const productId = productRes.body.data.product.id as string;

    const checkout = await request(app)
      .post("/v1/checkout")
      .send({
        merchantSlug: slug,
        items: [{ productId, quantity: 2 }],
        customerName: "Ada Buyer",
        customerPhone: "+2348012345678",
        fulfilment: "pickup",
      });
    expect(checkout.status).toBe(201);
    const orderId = checkout.body.data.order.id as string;

    const listPending = await request(app).get(`/v1/me/merchants/${merchantId}/orders`).set(auth(token));
    expect(listPending.body.data.orders).toHaveLength(1);
    expect(listPending.body.data.orders[0].items).toHaveLength(1);
    expect(listPending.body.data.orders[0].customerName).toBe("Ada Buyer");

    const paid = await request(app).post("/v1/payments/mock/complete").send({ orderId });
    expect(paid.status).toBe(200);
    expect(paid.body.data.order.orderStatus).toBe("confirmed");
    expect(paid.body.data.order.paymentStatus).toBe("paid");

    const detail = await request(app)
      .get(`/v1/me/merchants/${merchantId}/orders/${orderId}`)
      .set(auth(token));
    expect(detail.status).toBe(200);
    expect(detail.body.data.order.subtotalKobo).toBe(1_000_000);

    const processing = await request(app)
      .patch(`/v1/me/merchants/${merchantId}/orders/${orderId}`)
      .set(auth(token))
      .send({ status: "processing" });
    expect(processing.status).toBe(200);
    expect(processing.body.data.order.orderStatus).toBe("processing");

    const invalidBody = await request(app)
      .patch(`/v1/me/merchants/${merchantId}/orders/${orderId}`)
      .set(auth(token))
      .send({ status: "not-a-status" });
    expect(invalidBody.status).toBe(400);
  });

  it("rejects fulfilment updates before payment and on terminal orders", async () => {
    const token = await register("orders-guard@example.com");
    const created = await request(app).post("/v1/me/merchants").set(auth(token)).send({ name: "Guard Shop" });
    const merchantId = created.body.data.merchant.id as string;
    const slug = created.body.data.merchant.slug as string;

    const productRes = await request(app)
      .post(`/v1/me/merchants/${merchantId}/products`)
      .set(auth(token))
      .send({ title: "Hat", priceKobo: 100000, status: "published", qtyAvailable: 5 });
    const productId = productRes.body.data.product.id as string;

    const checkout = await request(app)
      .post("/v1/checkout")
      .send({
        merchantSlug: slug,
        items: [{ productId, quantity: 1 }],
        customerName: "Guest",
        customerPhone: "+2348099999999",
        fulfilment: "pickup",
      });
    const orderId = checkout.body.data.order.id as string;

    const tooEarly = await request(app)
      .patch(`/v1/me/merchants/${merchantId}/orders/${orderId}`)
      .set(auth(token))
      .send({ status: "processing" });
    expect(tooEarly.status).toBe(400);

    await request(app).post("/v1/payments/mock/complete").send({ orderId });

    const delivered = await request(app)
      .patch(`/v1/me/merchants/${merchantId}/orders/${orderId}`)
      .set(auth(token))
      .send({ status: "delivered" });
    expect(delivered.status).toBe(200);

    const afterTerminal = await request(app)
      .patch(`/v1/me/merchants/${merchantId}/orders/${orderId}`)
      .set(auth(token))
      .send({ status: "processing" });
    expect(afterTerminal.status).toBe(409);
  });
});
