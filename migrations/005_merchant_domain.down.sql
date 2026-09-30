DROP TABLE IF EXISTS domain_events;

ALTER TABLE notification_events RENAME COLUMN merchant_id TO shop_id;
ALTER INDEX IF EXISTS notification_events_merchant_id_idx RENAME TO notification_events_shop_id_idx;

UPDATE merchant_orders SET payment_provider = 'paystack' WHERE payment_provider = 'mock' AND payment_provider <> 'paystack';
ALTER TABLE merchant_orders RENAME COLUMN merchant_id TO shop_id;
ALTER TABLE merchant_orders RENAME TO shop_orders;

ALTER TABLE merchant_order_items RENAME TO shop_order_items;
ALTER TABLE merchant_payments RENAME TO shop_payments;

ALTER TABLE catalog_publications RENAME COLUMN merchant_id TO shop_id;

ALTER TABLE merchant_whatsapp_settings RENAME COLUMN merchant_id TO shop_id;
ALTER TABLE merchant_whatsapp_settings RENAME TO shop_whatsapp_settings;

ALTER TABLE merchant_integrations RENAME COLUMN merchant_id TO shop_id;
ALTER TABLE merchant_integrations RENAME TO shop_integrations;

ALTER TABLE products DROP COLUMN IF EXISTS source_media_metadata;
ALTER TABLE products RENAME COLUMN merchant_id TO shop_id;

DROP INDEX IF EXISTS merchants_owner_user_id_idx;
ALTER TABLE merchants RENAME TO shops;
ALTER TABLE shops ADD CONSTRAINT shops_owner_user_id_key UNIQUE (owner_user_id);
