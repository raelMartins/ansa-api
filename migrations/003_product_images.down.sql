ALTER TABLE products DROP CONSTRAINT IF EXISTS products_image_urls_len;
ALTER TABLE products DROP COLUMN IF EXISTS image_urls;
