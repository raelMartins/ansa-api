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

describe("merchant vertical slice", () => {
  beforeEach(async () => {
    await getPool().query(
      `TRUNCATE domain_events, notification_events, merchant_payments, merchant_order_items, merchant_orders,
         catalog_publications, merchant_whatsapp_settings, merchant_integrations, products, merchants,
         refresh_tokens, users CASCADE`,
    );
  });

  it("rejects unauthenticated merchant access", async () => {
    const res = await request(app).post("/v1/me/merchants").send({ name: "Rael Merchant" });
    expect(res.status).toBe(401);
  });

  it("allows multiple merchants for one ansa identity", async () => {
    const token = await register("multi@example.com");
    const a = await request(app).post("/v1/me/merchants").set(auth(token)).send({ name: "Business A" });
    const b = await request(app).post("/v1/me/merchants").set(auth(token)).send({ name: "Business B" });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const list = await request(app).get("/v1/me/merchants").set(auth(token));
    expect(list.body.data.merchants).toHaveLength(2);
  });

  it("runs the merchant catalog journey and a public product read", async () => {
    const token = await register("merchant@example.com");

    const created = await request(app)
      .post("/v1/me/merchants")
      .set(auth(token))
      .send({ name: "Rael Merchant", description: "Ankara and lace" });
    expect(created.status).toBe(201);
    const merchantId = created.body.data.merchant.id as string;
    expect(created.body.data.merchant.slug).toBe("rael-merchant");

    const createdProduct = await request(app)
      .post(`/v1/me/merchants/${merchantId}/products`)
      .set(auth(token))
      .send({
        title: "Blue Ankara",
        priceKobo: 150000,
        description: "6 yards",
        imageUrls: ["https://picsum.photos/id/1015/800/800"],
      });
    expect(createdProduct.status).toBe(201);
    const productId = createdProduct.body.data.product.id as string;

    const listed = await request(app).get(`/v1/me/merchants/${merchantId}/products`).set(auth(token));
    expect(listed.body.data.products).toHaveLength(1);

    const updated = await request(app)
      .patch(`/v1/me/merchants/${merchantId}/products/${productId}`)
      .set(auth(token))
      .send({ title: "Blue Ankara (updated)", priceKobo: 175000 });
    expect(updated.body.data.product.title).toBe("Blue Ankara (updated)");

    const publicRead = await request(app).get("/v1/merchants/rael-merchant/products/blue-ankara");
    expect(publicRead.status).toBe(200);

    await request(app).delete(`/v1/me/merchants/${merchantId}/products/${productId}`).set(auth(token));
    const hidden = await request(app).get("/v1/merchants/rael-merchant/products/blue-ankara");
    expect(hidden.status).toBe(404);

    const otherToken = await register("other@example.com");
    const otherSees = await request(app)
      .get(`/v1/me/merchants/${merchantId}/products/${productId}`)
      .set(auth(otherToken));
    expect(otherSees.status).toBe(404);
  });

  it("returns merchant overview aggregates", async () => {
    const token = await register("overview@example.com");
    const created = await request(app).post("/v1/me/merchants").set(auth(token)).send({ name: "Overview Shop", location: "Lagos" });
    const merchantId = created.body.data.merchant.id as string;

    const overview = await request(app).get(`/v1/me/merchants/${merchantId}/overview`).set(auth(token));
    expect(overview.status).toBe(200);
    expect(overview.body.data.merchant.name).toBe("Overview Shop");
    expect(overview.body.data.salesMonthKobo).toBe(0);
    expect(overview.body.data.recentOrders).toEqual([]);
    expect(overview.body.data.generatedAt).toBeTruthy();
  });
});
