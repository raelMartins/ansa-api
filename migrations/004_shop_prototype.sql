-- owner: shop (catalog + business profile + integrations)
-- prototype: extra shop/catalog fields and channel connection state.
-- orders/payments/notifications tables are owned by those modules but shipped
-- together so the prototype can run from one migrate.

ALTER TABLE shops
  ADD COLUMN category TEXT CHECK (category IS NULL OR char_length(category) BETWEEN 1 AND 80),
  ADD COLUMN phone TEXT CHECK (phone IS NULL OR char_length(phone) BETWEEN 7 AND 24),
  ADD COLUMN whatsapp TEXT CHECK (whatsapp IS NULL OR char_length(whatsapp) BETWEEN 7 AND 24),
  ADD COLUMN location TEXT CHECK (location IS NULL OR char_length(location) <= 200),
  ADD COLUMN logo_url TEXT CHECK (logo_url IS NULL OR char_length(logo_url) <= 2000),
  ADD COLUMN cover_url TEXT CHECK (cover_url IS NULL OR char_length(cover_url) <= 2000),
  ADD COLUMN instagram_handle TEXT CHECK (instagram_handle IS NULL OR char_length(instagram_handle) <= 80),
  ADD COLUMN tiktok_handle TEXT CHECK (tiktok_handle IS NULL OR char_length(tiktok_handle) <= 80),
  ADD COLUMN x_handle TEXT CHECK (x_handle IS NULL OR char_length(x_handle) <= 80),
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE products
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'product' CHECK (kind IN ('product', 'service')),
  ADD COLUMN compare_at_kobo INTEGER CHECK (compare_at_kobo IS NULL OR (compare_at_kobo >= 0 AND compare_at_kobo <= 1000000000)),
  ADD COLUMN qty_available INTEGER NOT NULL DEFAULT 20 CHECK (qty_available >= 0),
  ADD COLUMN qty_sold INTEGER NOT NULL DEFAULT 0 CHECK (qty_sold >= 0),
  ADD COLUMN sku TEXT CHECK (sku IS NULL OR char_length(sku) <= 64),
  ADD COLUMN category TEXT CHECK (category IS NULL OR char_length(category) <= 80),
  ADD COLUMN duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 5 AND 1440),
  ADD COLUMN availability_note TEXT CHECK (availability_note IS NULL OR char_length(availability_note) <= 200);

-- owner: shop
CREATE TABLE shop_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'tiktok', 'x')),
  status TEXT NOT NULL CHECK (status IN ('not_connected', 'connecting', 'connected', 'error')),
  provider TEXT NOT NULL CHECK (provider IN ('mock', 'meta', 'tiktok', 'x')),
  external_account TEXT,
  last_error TEXT,
  connected_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, channel)
);

CREATE INDEX shop_integrations_shop_id_idx ON shop_integrations (shop_id);

-- owner: shop
CREATE TABLE shop_whatsapp_settings (
  shop_id UUID PRIMARY KEY REFERENCES shops (id) ON DELETE CASCADE,
  share_catalog BOOLEAN NOT NULL DEFAULT true,
  notify_merchant BOOLEAN NOT NULL DEFAULT true,
  notify_customer BOOLEAN NOT NULL DEFAULT true,
  contact_number TEXT,
  templates JSONB NOT NULL DEFAULT '{
    "order_received": "Hi {{name}}, {{shop}} received order {{reference}}. Total {{total}}.",
    "payment_confirmed": "Payment confirmed for {{reference}}. Thank you, {{name}}.",
    "order_processing": "{{shop}} is preparing order {{reference}}.",
    "out_for_delivery": "Order {{reference}} is out for delivery.",
    "delivered": "Order {{reference}} has been delivered. Enjoy!",
    "order_cancelled": "Order {{reference}} was cancelled."
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- owner: shop
CREATE TABLE catalog_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'tiktok', 'x')),
  caption TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('simulated', 'failed')),
  provider TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX catalog_publications_product_idx ON catalog_publications (product_id, created_at DESC);

-- owner: orders
CREATE TABLE shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE CHECK (char_length(reference) BETWEEN 6 AND 24),
  customer_name TEXT NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 120),
  customer_phone TEXT NOT NULL CHECK (char_length(customer_phone) BETWEEN 7 AND 24),
  customer_email TEXT CHECK (customer_email IS NULL OR char_length(customer_email) <= 160),
  fulfilment TEXT NOT NULL CHECK (fulfilment IN ('pickup', 'delivery')),
  delivery_address TEXT,
  delivery_instructions TEXT,
  delivery_fee_kobo INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_kobo >= 0),
  subtotal_kobo INTEGER NOT NULL CHECK (subtotal_kobo >= 0),
  total_kobo INTEGER NOT NULL CHECK (total_kobo >= 0),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'paid', 'failed')),
  order_status TEXT NOT NULL CHECK (
    order_status IN (
      'pending',
      'confirmed',
      'processing',
      'ready',
      'out_for_delivery',
      'delivered',
      'cancelled'
    )
  ),
  payment_provider TEXT NOT NULL DEFAULT 'mock',
  payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX shop_orders_shop_id_idx ON shop_orders (shop_id, created_at DESC);
CREATE INDEX shop_orders_reference_idx ON shop_orders (reference);

-- owner: orders
CREATE TABLE shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders (id) ON DELETE CASCADE,
  product_id UUID REFERENCES products (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('product', 'service')),
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  unit_price_kobo INTEGER NOT NULL CHECK (unit_price_kobo >= 0)
);

CREATE INDEX shop_order_items_order_id_idx ON shop_order_items (order_id);

-- owner: payments
CREATE TABLE shop_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders (id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('mock', 'paystack')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
  amount_kobo INTEGER NOT NULL CHECK (amount_kobo >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_reference TEXT,
  simulated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX shop_payments_order_id_idx ON shop_payments (order_id);

-- owner: notifications
CREATE TABLE notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  order_id UUID REFERENCES shop_orders (id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  template_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('simulated', 'failed')),
  provider TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notification_events_shop_id_idx ON notification_events (shop_id, created_at DESC);
