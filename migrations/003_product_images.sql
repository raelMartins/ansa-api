-- owner: shop
-- Product photos are URL references only. File upload/storage is not in this slice.

ALTER TABLE products
  ADD COLUMN image_urls TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE products
  ADD CONSTRAINT products_image_urls_len CHECK (cardinality(image_urls) <= 8);
