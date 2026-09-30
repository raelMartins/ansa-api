-- owner: merchant (domain alignment — shop → merchant, multi-merchant per user)
-- Apply after 004. Renames prototype tables/columns; does not edit prior migrations.

-- Core merchant entity (was shops)
ALTER TABLE shops RENAME TO merchants;
ALTER TABLE merchants DROP CONSTRAINT IF EXISTS shops_owner_user_id_key;
CREATE INDEX IF NOT EXISTS merchants_owner_user_id_idx ON merchants (owner_user_id);

-- Catalog
ALTER TABLE products RENAME COLUMN shop_id TO merchant_id;
ALTER INDEX IF EXISTS products_shop_id_idx RENAME TO products_merchant_id_idx;
ALTER INDEX IF EXISTS products_shop_status_idx RENAME TO products_merchant_status_idx;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source_media_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN products.source_media_metadata IS
  'Merchant-provided media evidence metadata (not verification).';

-- Integrations & settings
ALTER TABLE shop_integrations RENAME TO merchant_integrations;
ALTER TABLE merchant_integrations RENAME COLUMN shop_id TO merchant_id;
ALTER INDEX IF EXISTS shop_integrations_shop_id_idx RENAME TO merchant_integrations_merchant_id_idx;

ALTER TABLE shop_whatsapp_settings RENAME TO merchant_whatsapp_settings;
ALTER TABLE merchant_whatsapp_settings RENAME COLUMN shop_id TO merchant_id;

ALTER TABLE catalog_publications RENAME COLUMN shop_id TO merchant_id;

-- Orders & payments
ALTER TABLE shop_orders RENAME TO merchant_orders;
ALTER TABLE merchant_orders RENAME COLUMN shop_id TO merchant_id;
ALTER INDEX IF EXISTS shop_orders_shop_id_idx RENAME TO merchant_orders_merchant_id_idx;
ALTER INDEX IF EXISTS shop_orders_reference_idx RENAME TO merchant_orders_reference_idx;

ALTER TABLE shop_order_items RENAME TO merchant_order_items;
ALTER INDEX IF EXISTS shop_order_items_order_id_idx RENAME TO merchant_order_items_order_id_idx;

ALTER TABLE shop_payments RENAME TO merchant_payments;
ALTER INDEX IF EXISTS shop_payments_order_id_idx RENAME TO merchant_payments_order_id_idx;

ALTER TABLE merchant_payments DROP CONSTRAINT IF EXISTS shop_payments_provider_check;
ALTER TABLE merchant_payments ADD CONSTRAINT merchant_payments_provider_check
  CHECK (provider IN ('mock', 'flutterwave'));
UPDATE merchant_payments SET provider = 'mock' WHERE provider = 'paystack';

ALTER TABLE merchant_orders
  ALTER COLUMN payment_provider SET DEFAULT 'mock';
UPDATE merchant_orders SET payment_provider = 'mock' WHERE payment_provider = 'paystack';

-- Notifications
ALTER TABLE notification_events RENAME COLUMN shop_id TO merchant_id;
ALTER INDEX IF EXISTS notification_events_shop_id_idx RENAME TO notification_events_merchant_id_idx;

-- Analytics / instrumentation foundation (not a full analytics product)
CREATE TABLE domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL CHECK (char_length(event_name) BETWEEN 3 AND 120),
  merchant_id UUID REFERENCES merchants (id) ON DELETE SET NULL,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX domain_events_name_occurred_idx ON domain_events (event_name, occurred_at DESC);
CREATE INDEX domain_events_merchant_id_idx ON domain_events (merchant_id, occurred_at DESC);
