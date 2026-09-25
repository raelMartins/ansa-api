import type { Queryable } from "../../db/pool.js";

export type ShopRow = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ProductStatus = "draft" | "published" | "archived";

export type ProductRow = {
  id: string;
  shop_id: string;
  title: string;
  description: string | null;
  price_kobo: number;
  currency: string;
  status: ProductStatus;
  slug: string;
  created_at: Date;
  updated_at: Date;
};

export async function insertShop(
  db: Queryable,
  input: { ownerUserId: string; name: string; slug: string; description: string | null },
): Promise<ShopRow> {
  const { rows } = await db.query<ShopRow>(
    `INSERT INTO shops (owner_user_id, name, slug, description)
     VALUES ($1, $2, $3, $4)
     RETURNING id, owner_user_id, name, slug, description, created_at, updated_at`,
    [input.ownerUserId, input.name, input.slug, input.description],
  );
  const row = rows[0];
  if (!row) throw new Error("insertShop returned no row");
  return row;
}

export async function findShopByOwner(db: Queryable, ownerUserId: string): Promise<ShopRow | undefined> {
  const { rows } = await db.query<ShopRow>(
    `SELECT id, owner_user_id, name, slug, description, created_at, updated_at
     FROM shops WHERE owner_user_id = $1`,
    [ownerUserId],
  );
  return rows[0];
}

export async function findShopBySlug(db: Queryable, slug: string): Promise<ShopRow | undefined> {
  const { rows } = await db.query<ShopRow>(
    `SELECT id, owner_user_id, name, slug, description, created_at, updated_at
     FROM shops WHERE slug = $1`,
    [slug],
  );
  return rows[0];
}

export async function findShopById(db: Queryable, id: string): Promise<ShopRow | undefined> {
  const { rows } = await db.query<ShopRow>(
    `SELECT id, owner_user_id, name, slug, description, created_at, updated_at
     FROM shops WHERE id = $1`,
    [id],
  );
  return rows[0];
}

export async function updateShopRow(
  db: Queryable,
  id: string,
  patch: { name?: string; slug?: string; description?: string | null },
): Promise<ShopRow> {
  const { rows } = await db.query<ShopRow>(
    `UPDATE shops
     SET name = COALESCE($2, name),
         slug = COALESCE($3, slug),
         description = CASE WHEN $4::boolean THEN $5 ELSE description END,
         updated_at = now()
     WHERE id = $1
     RETURNING id, owner_user_id, name, slug, description, created_at, updated_at`,
    [id, patch.name ?? null, patch.slug ?? null, patch.description !== undefined, patch.description ?? null],
  );
  const row = rows[0];
  if (!row) throw new Error("updateShopRow returned no row");
  return row;
}

export async function insertProduct(
  db: Queryable,
  input: {
    shopId: string;
    title: string;
    description: string | null;
    priceKobo: number;
    status: ProductStatus;
    slug: string;
  },
): Promise<ProductRow> {
  const { rows } = await db.query<ProductRow>(
    `INSERT INTO products (shop_id, title, description, price_kobo, status, slug)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, shop_id, title, description, price_kobo, currency, status, slug, created_at, updated_at`,
    [input.shopId, input.title, input.description, input.priceKobo, input.status, input.slug],
  );
  const row = rows[0];
  if (!row) throw new Error("insertProduct returned no row");
  return row;
}

export async function listProductsByShop(db: Queryable, shopId: string): Promise<ProductRow[]> {
  const { rows } = await db.query<ProductRow>(
    `SELECT id, shop_id, title, description, price_kobo, currency, status, slug, created_at, updated_at
     FROM products
     WHERE shop_id = $1
     ORDER BY created_at DESC`,
    [shopId],
  );
  return rows;
}

export async function listPublishedProductsByShop(db: Queryable, shopId: string): Promise<ProductRow[]> {
  const { rows } = await db.query<ProductRow>(
    `SELECT id, shop_id, title, description, price_kobo, currency, status, slug, created_at, updated_at
     FROM products
     WHERE shop_id = $1 AND status = 'published'
     ORDER BY created_at DESC`,
    [shopId],
  );
  return rows;
}

export async function findProductById(db: Queryable, id: string): Promise<ProductRow | undefined> {
  const { rows } = await db.query<ProductRow>(
    `SELECT id, shop_id, title, description, price_kobo, currency, status, slug, created_at, updated_at
     FROM products WHERE id = $1`,
    [id],
  );
  return rows[0];
}

export async function findProductByShopAndSlug(
  db: Queryable,
  shopId: string,
  slug: string,
): Promise<ProductRow | undefined> {
  const { rows } = await db.query<ProductRow>(
    `SELECT id, shop_id, title, description, price_kobo, currency, status, slug, created_at, updated_at
     FROM products WHERE shop_id = $1 AND slug = $2`,
    [shopId, slug],
  );
  return rows[0];
}

export async function updateProductRow(
  db: Queryable,
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    priceKobo?: number;
    status?: ProductStatus;
    slug?: string;
  },
): Promise<ProductRow> {
  const { rows } = await db.query<ProductRow>(
    `UPDATE products
     SET title = COALESCE($2, title),
         description = CASE WHEN $3::boolean THEN $4 ELSE description END,
         price_kobo = COALESCE($5, price_kobo),
         status = COALESCE($6, status),
         slug = COALESCE($7, slug),
         updated_at = now()
     WHERE id = $1
     RETURNING id, shop_id, title, description, price_kobo, currency, status, slug, created_at, updated_at`,
    [
      id,
      patch.title ?? null,
      patch.description !== undefined,
      patch.description ?? null,
      patch.priceKobo ?? null,
      patch.status ?? null,
      patch.slug ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("updateProductRow returned no row");
  return row;
}

export async function archiveProductRow(db: Queryable, id: string): Promise<ProductRow> {
  return updateProductRow(db, id, { status: "archived" });
}
