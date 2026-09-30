import { describe, expect, it } from "vitest";
import { MockPaymentProvider, resolvePaymentProvider } from "./provider.js";

describe("payment provider", () => {
  it("defaults to mock in test env", () => {
    const p = resolvePaymentProvider();
    expect(p.name).toBe("mock");
    expect(p).toBeInstanceOf(MockPaymentProvider);
  });

  it("mock initialize returns simulated result", async () => {
    const p = new MockPaymentProvider();
    const result = await p.initialize({
      amountKobo: 10000,
      email: "a@b.com",
      reference: "ref-1",
      callbackUrl: "http://localhost/cb",
    });
    expect(result.provider).toBe("mock");
    expect(result.simulated).toBe(true);
  });
});
