import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";

const app = createApp();

describe("health", () => {
  it("returns liveness on /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.service).toBe("ansa-api");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("returns liveness on /v1/health", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
  });

  it("does not require a database for liveness", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
  });

  it("returns 503 on /v1/ready when the database is not configured", async () => {
    const res = await request(app).get("/v1/ready");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
