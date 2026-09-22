import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies a matching password", async () => {
    const stored = await hashPassword("correct-horse");
    await expect(verifyPassword("correct-horse", stored)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct-horse");
    await expect(verifyPassword("wrong", stored)).resolves.toBe(false);
  });
});
