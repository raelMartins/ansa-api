/**
 * PROTOTYPE: payment provider boundary.
 * Mock is the development default. Flutterwave is wired when configured;
 * ansa does not operate payment rails.
 */
import { env } from "../../config/env.js";

export type PaymentProviderName = "mock" | "flutterwave";

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

/**
 * Flutterwave initialize (PROTOTYPE — not production-complete).
 * OPEN: webhooks, settlement, protected transactions, legal arrangement.
 */
export class FlutterwavePaymentProvider implements PaymentProvider {
  readonly name = "flutterwave" as const;

  constructor(private readonly secretKey: string) {}

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const res = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: input.reference,
        amount: input.amountKobo / 100,
        currency: "NGN",
        redirect_url: input.callbackUrl,
        customer: { email: input.email },
      }),
    });
    const json = (await res.json()) as {
      status?: string;
      message?: string;
      data?: { link?: string };
    };
    if (!res.ok || json.status !== "success" || !json.data?.link) {
      throw new Error(json.message ?? "Flutterwave initialize failed");
    }
    return {
      provider: "flutterwave",
      simulated: false,
      authorizationUrl: json.data.link,
    };
  }
}

export function resolvePaymentProvider(): PaymentProvider {
  const { PAYMENT_PROVIDER, FLUTTERWAVE_SECRET_KEY } = env();
  if (PAYMENT_PROVIDER === "flutterwave" && FLUTTERWAVE_SECRET_KEY) {
    return new FlutterwavePaymentProvider(FLUTTERWAVE_SECRET_KEY);
  }
  return new MockPaymentProvider();
}
