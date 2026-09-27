/**
 * PROTOTYPE: payment provider boundary.
 * Mock is the development default. Paystack is used only when a secret exists
 * and PAYMENT_PROVIDER=paystack. ansa does not operate payment rails.
 */
import { env } from "../../config/env.js";

export type PaymentProviderName = "mock" | "paystack";

export type InitializePaymentInput = {
  amountKobo: number;
  email: string;
  reference: string;
  callbackUrl: string;
};

export type InitializePaymentResult = {
  provider: PaymentProviderName;
  simulated: boolean;
  authorizationUrl?: string;
  accessCode?: string;
};

export type PaymentProvider = {
  readonly name: PaymentProviderName;
  initialize(input: InitializePaymentInput): Promise<InitializePaymentResult>;
};

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    return {
      provider: "mock",
      simulated: true,
      authorizationUrl: input.callbackUrl,
    };
  }
}

export class PaystackPaymentProvider implements PaymentProvider {
  readonly name = "paystack" as const;

  constructor(private readonly secretKey: string) {}

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountKobo,
        email: input.email,
        reference: input.reference,
        callback_url: input.callbackUrl,
        currency: "NGN",
      }),
    });
    const json = (await res.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; access_code?: string };
    };
    if (!res.ok || !json.status || !json.data?.authorization_url) {
      throw new Error(json.message ?? "Paystack initialize failed");
    }
    return {
      provider: "paystack",
      simulated: false,
      authorizationUrl: json.data.authorization_url,
      accessCode: json.data.access_code,
    };
  }
}

export function resolvePaymentProvider(): PaymentProvider {
  const { PAYMENT_PROVIDER, PAYSTACK_SECRET_KEY } = env();
  if (PAYMENT_PROVIDER === "paystack" && PAYSTACK_SECRET_KEY) {
    return new PaystackPaymentProvider(PAYSTACK_SECRET_KEY);
  }
  return new MockPaymentProvider();
}
