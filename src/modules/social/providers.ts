/**
 * PROTOTYPE: social channel providers.
 * Mock* never call Instagram/TikTok/X APIs. Real classes exist as the swap-in boundary.
 */
export type SocialChannel = "whatsapp" | "instagram" | "tiktok" | "x";

export type SocialPublishInput = {
  account: string;
  caption: string;
  itemUrl: string;
  title: string;
};

export type SocialPublishResult = {
  provider: string;
  simulated: boolean;
  ok: boolean;
  detail: string;
};

export type SocialProvider = {
  readonly channel: SocialChannel;
  readonly name: string;
  publish(input: SocialPublishInput): Promise<SocialPublishResult>;
};

function simulated(channel: SocialChannel, provider: string, account: string): SocialPublishResult {
  return {
    provider,
    simulated: true,
    ok: true,
    detail: `Prototype publication simulated on ${channel} (${provider}) for ${account}. Nothing was posted to the real network.`,
  };
}

export class MockInstagramProvider implements SocialProvider {
  readonly channel = "instagram" as const;
  readonly name = "mock";
  async publish(input: SocialPublishInput): Promise<SocialPublishResult> {
    return simulated("instagram", this.name, input.account);
  }
}

export class InstagramProvider implements SocialProvider {
  readonly channel = "instagram" as const;
  readonly name = "meta";
  async publish(): Promise<SocialPublishResult> {
    return {
      provider: this.name,
      simulated: false,
      ok: false,
      detail: "Instagram Graph API is not connected.",
    };
  }
}

export class MockTikTokProvider implements SocialProvider {
  readonly channel = "tiktok" as const;
  readonly name = "mock";
  async publish(input: SocialPublishInput): Promise<SocialPublishResult> {
    return simulated("tiktok", this.name, input.account);
  }
}

export class TikTokProvider implements SocialProvider {
  readonly channel = "tiktok" as const;
  readonly name = "tiktok";
  async publish(): Promise<SocialPublishResult> {
    return {
      provider: this.name,
      simulated: false,
      ok: false,
      detail: "TikTok Content Posting API is not connected.",
    };
  }
}

export class MockXProvider implements SocialProvider {
  readonly channel = "x" as const;
  readonly name = "mock";
  async publish(input: SocialPublishInput): Promise<SocialPublishResult> {
    return simulated("x", this.name, input.account);
  }
}

export class XProvider implements SocialProvider {
  readonly channel = "x" as const;
  readonly name = "x";
  async publish(): Promise<SocialPublishResult> {
    return {
      provider: this.name,
      simulated: false,
      ok: false,
      detail: "X API is not connected.",
    };
  }
}

export class MockWhatsAppCatalogProvider implements SocialProvider {
  readonly channel = "whatsapp" as const;
  readonly name = "mock";
  async publish(input: SocialPublishInput): Promise<SocialPublishResult> {
    return simulated("whatsapp", this.name, input.account);
  }
}

export function resolveSocialProvider(channel: Exclude<SocialChannel, "whatsapp">): SocialProvider {
  if (channel === "instagram") return new MockInstagramProvider();
  if (channel === "tiktok") return new MockTikTokProvider();
  return new MockXProvider();
}

export function defaultCaption(input: { title: string; priceLabel: string; shopName: string; url: string }): string {
  return `${input.title} — ${input.priceLabel}\nfrom ${input.shopName} on ansa\n${input.url}`;
}
