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

describe("shop vertical slice", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE TABLE products, shops, refresh_tokens, users CASCADE");
  });

  it("rejects unauthenticated merchant shop access", async () => {
    const res = await request(app).post("/v1/me/shop").send({ name: "Rael Shop" });
    expect(res.status).toBe(401);
  });

  it("runs the merchant catalog journey and a public product read", async () => {
    const token = await register("merchant@example.com");

    const createdShop = await request(app)
      .post("/v1/me/shop")
      .set(auth(token))
      .send({ name: "Rael Shop", description: "Ankara and lace" });
    expect(createdShop.status).toBe(201);
    expect(createdShop.body.data.shop.slug).toBe("rael-shop");

    const duplicateShop = await request(app)
      .post("/v1/me/shop")
      .set(auth(token))
      .send({ name: "Other" });
    expect(duplicateShop.status).toBe(409);

    const createdProduct = await request(app)
      .post("/v1/me/shop/products")
      .set(auth(token))
      .send({ title: "Blue Ankara", priceKobo: 150000, description: "6 yards" });
    expect(createdProduct.status).toBe(201);
    expect(createdProduct.body.data.product.status).toBe("published");
    expect(createdProduct.body.data.product.priceKobo).toBe(150000);
    expect(createdProduct.body.data.product.currency).toBe("NGN");

    const productId = createdProduct.body.data.product.id as string;

    const listed = await request(app).get("/v1/me/shop/products").set(auth(token));
    expect(listed.status).toBe(200);
    expect(listed.body.data.products).toHaveLength(1);

    const updated = await request(app)
      .patch(`/v1/me/shop/products/${productId}`)
      .set(auth(token))
      .send({ title: "Blue Ankara (updated)", priceKobo: 175000 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.product.title).toBe("Blue Ankara (updated)");
    expect(updated.body.data.product.priceKobo).toBe(175000);

    const publicRead = await request(app).get("/v1/shops/rael-shop/products/blue-ankara");
    expect(publicRead.status).toBe(200);
    expect(publicRead.body.data.product.title).toBe("Blue Ankara (updated)");
    expect(publicRead.body.data.product.status).toBe("published");

    const archived = await request(app)
      .delete(`/v1/me/shop/products/${productId}`)
      .set(auth(token));
    expect(archived.status).toBe(200);
    expect(archived.body.data.product.status).toBe("archived");

    const hidden = await request(app).get("/v1/shops/rael-shop/products/blue-ankara");
    expect(hidden.status).toBe(404);

    const draft = await request(app)
      .post("/v1/me/shop/products")
      .set(auth(token))
      .send({ title: "Secret", priceKobo: 1000, status: "draft" });
    expect(draft.status).toBe(201);

    const draftHidden = await request(app).get("/v1/shops/rael-shop/products/secret");
    expect(draftHidden.status).toBe(404);

    const otherToken = await register("other@example.com");
    const otherSees = await request(app)
      .get(`/v1/me/shop/products/${productId}`)
      .set(auth(otherToken));
    expect(otherSees.status).toBe(404);
  });

  it("validates product payloads", async () => {
    const token = await register("validate@example.com");
    await request(app).post("/v1/me/shop").set(auth(token)).send({ name: "V Shop" });

    const res = await request(app)
      .post("/v1/me/shop/products")
      .set(auth(token))
      .send({ title: "X", priceKobo: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
