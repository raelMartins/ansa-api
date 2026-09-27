DROP TABLE IF EXISTS notification_events;
DROP TABLE IF EXISTS shop_payments;
DROP TABLE IF EXISTS shop_order_items;
DROP TABLE IF EXISTS shop_orders;
DROP TABLE IF EXISTS catalog_publications;
DROP TABLE IF EXISTS shop_whatsapp_settings;
DROP TABLE IF EXISTS shop_integrations;

ALTER TABLE products
  DROP COLUMN IF EXISTS kind,
  DROP COLUMN IF EXISTS compare_at_kobo,
  DROP COLUMN IF EXISTS qty_available,
  DROP COLUMN IF EXISTS qty_sold,
  DROP COLUMN IF EXISTS sku,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS duration_minutes,
  DROP COLUMN IF EXISTS availability_note;

ALTER TABLE shops
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS whatsapp,
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS cover_url,
  DROP COLUMN IF EXISTS instagram_handle,
  DROP COLUMN IF EXISTS tiktok_handle,
  DROP COLUMN IF EXISTS x_handle,
  DROP COLUMN IF EXISTS onboarding_completed_at;
