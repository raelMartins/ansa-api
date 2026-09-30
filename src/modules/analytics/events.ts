import { getPool } from "../../db/pool.js";

/** Canonical domain event names (analytics/instrumentation foundation). */
export const DomainEventName = {
  merchantCreated: "merchant.created",
  merchantUpdated: "merchant.updated",
  productCreated: "product.created",
  orderCreated: "order.created",
  orderStatusChanged: "order.status_changed",
  checkoutStarted: "checkout.started",
} as const;

export type DomainEventNameValue = (typeof DomainEventName)[keyof typeof DomainEventName];

export async function recordDomainEvent(input: {
  eventName: DomainEventNameValue;
  userId?: string | null;
  merchantId?: string | null;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO domain_events (event_name, user_id, merchant_id, properties)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [
      input.eventName,
      input.userId ?? null,
      input.merchantId ?? null,
      JSON.stringify(input.properties ?? {}),
    ],
  );
}
