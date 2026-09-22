import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";

const app = createApp();

describe("auth foundation", () => {
  it("rejects register without email or phone", async () => {
    const res = await request(app).post("/v1/auth/register").send({ password: "password1" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.requestId).toBeTruthy();
  });

  it("rejects login without credentials", async () => {
    const res = await request(app).post("/v1/auth/login").send({ password: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects /me without a bearer token", async () => {
    const res = await request(app).get("/v1/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns a structured 404", async () => {
    const res = await request(app).get("/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
