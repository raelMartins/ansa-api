/**
 * PROTOTYPE: WhatsApp / notification provider boundary.
 * MockWhatsAppProvider never contacts Meta. Real MetaWhatsAppProvider is a stub
 * until credentials and template approval exist.
 */
export type WhatsAppTemplateKey =
  | "order_received"
  | "payment_confirmed"
  | "order_processing"
  | "out_for_delivery"
  | "delivered"
  | "order_cancelled";

export type SendTemplateInput = {
  to: string;
  templateKey: WhatsAppTemplateKey | string;
  body: string;
};

export type SendTemplateResult = {
  provider: "mock" | "meta";
  simulated: boolean;
  ok: boolean;
  detail: string;
};

export type WhatsAppProvider = {
  readonly name: "mock" | "meta";
  sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult>;
};

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = "mock" as const;

  async sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
    return {
      provider: "mock",
      simulated: true,
      ok: true,
      detail: `Prototype WhatsApp message simulated to ${input.to} (${input.templateKey}).`,
    };
  }
}

/** Not callable without Meta credentials. Kept as the swap-in boundary. */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = "meta" as const;

  async sendTemplate(): Promise<SendTemplateResult> {
    return {
      provider: "meta",
      simulated: false,
      ok: false,
      detail: "Meta WhatsApp is not configured. Use the mock provider in development.",
    };
  }
}

export function resolveWhatsAppProvider(): WhatsAppProvider {
  return new MockWhatsAppProvider();
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
