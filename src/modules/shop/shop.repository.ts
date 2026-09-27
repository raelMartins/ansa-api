import type { Queryable } from "../../db/pool.js";

export type ShopRow = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  phone: string | null;
  whatsapp: string | null;
  location: string | null;
  logo_url: string | null;
  cover_url: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  x_handle: string | null;
  onboarding_completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ProductStatus = "draft" | "published" | "archived";
export type CatalogKind = "product" | "service";

export type ProductRow = {
  id: string;
  shop_id: string;
  title: string;
  description: string | null;
  price_kobo: number;
  currency: string;
  status: ProductStatus;
  slug: string;
  image_urls: string[];
  kind: CatalogKind;
  compare_at_kobo: number | null;
  qty_available: number;
  qty_sold: number;
  sku: string | null;
  category: string | null;
  duration_minutes: number | null;
  availability_note: string | null;
  created_at: Date;
  updated_at: Date;
};

export const SHOP_COLS = `id, owner_user_id, name, slug, description, category, phone, whatsapp, location,
  logo_url, cover_url, instagram_handle, tiktok_handle, x_handle, onboarding_completed_at, created_at, updated_at`;

export const PRODUCT_COLS = `id, shop_id, title, description, price_kobo, currency, status, slug, image_urls,
  kind, compare_at_kobo, qty_available, qty_sold, sku, category, duration_minutes, availability_note, created_at, updated_at`;

export type ShopProfileInput = {
  ownerUserId: string;
  name: string;
  slug: string;
  description: string | null;
  category?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  location?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  instagramHandle?: string | null;
  tiktokHandle?: string | null;
  xHandle?: string | null;
  onboardingCompleted?: boolean;
};

export async function insertShop(db: Queryable, input: ShopProfileInput): Promise<ShopRow> {
  const { rows } = await db.query<ShopRow>(
    `INSERT INTO shops (
       owner_user_id, name, slug, description, category, phone, whatsapp, location,
       logo_url, cover_url, instagram_handle, tiktok_handle, x_handle, onboarding_completed_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, CASE WHEN $14 THEN now() ELSE NULL END)
     RETURNING ${SHOP_COLS}`,
    [
      input.ownerUserId,
      input.name,
      input.slug,
      input.description,
      input.category ?? null,
      input.phone ?? null,
      input.whatsapp ?? null,
      input.location ?? null,
      input.logoUrl ?? null,
      input.coverUrl ?? null,
      input.instagramHandle ?? null,
      input.tiktokHandle ?? null,
      input.xHandle ?? null,
      Boolean(input.onboardingCompleted),
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("insertShop returned no row");
  return row;
}

export async function findShopByOwner(db: Queryable, ownerUserId: string): Promise<ShopRow | undefined> {
  const { rows } = await db.query<ShopRow>(`SELECT ${SHOP_COLS} FROM shops WHERE owner_user_id = $1`, [ownerUserId]);
  return rows[0];
}

export async function findShopBySlug(db: Queryable, slug: string): Promise<ShopRow | undefined> {
  const { rows } = await db.query<ShopRow>(`SELECT ${SHOP_COLS} FROM shops WHERE slug = $1`, [slug]);
  return rows[0];
}

export async function findShopById(db: Queryable, id: string): Promise<ShopRow | undefined> {
  const { rows } = await db.query<ShopRow>(`SELECT ${SHOP_COLS} FROM shops WHERE id = $1`, [id]);
  return rows[0];
}

export type ShopPatch = {
  name?: string;
  slug?: string;
  description?: string | null;
  category?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  location?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  instagramHandle?: string | null;
  tiktokHandle?: string | null;
  xHandle?: string | null;
  onboardingCompleted?: boolean;
};

export async function updateShopRow(db: Queryable, id: string, patch: ShopPatch): Promise<ShopRow> {
  const { rows } = await db.query<ShopRow>(
    `UPDATE shops
     SET name = COALESCE($2, name),
         slug = COALESCE($3, slug),
         description = CASE WHEN $4::boolean THEN $5 ELSE description END,
         category = CASE WHEN $6::boolean THEN $7 ELSE category END,
         phone = CASE WHEN $8::boolean THEN $9 ELSE phone END,
         whatsapp = CASE WHEN $10::boolean THEN $11 ELSE whatsapp END,
         location = CASE WHEN $12::boolean THEN $13 ELSE location END,
         logo_url = CASE WHEN $14::boolean THEN $15 ELSE logo_url END,
         cover_url = CASE WHEN $16::boolean THEN $17 ELSE cover_url END,
         instagram_handle = CASE WHEN $18::boolean THEN $19 ELSE instagram_handle END,
         tiktok_handle = CASE WHEN $20::boolean THEN $21 ELSE tiktok_handle END,
         x_handle = CASE WHEN $22::boolean THEN $23 ELSE x_handle END,
         onboarding_completed_at = CASE WHEN $24::boolean THEN now() ELSE onboarding_completed_at END,
         updated_at = now()
     WHERE id = $1
     RETURNING ${SHOP_COLS}`,
    [
      id,
      patch.name ?? null,
      patch.slug ?? null,
      patch.description !== undefined,
      patch.description ?? null,
      patch.category !== undefined,
      patch.category ?? null,
      patch.phone !== undefined,
      patch.phone ?? null,
      patch.whatsapp !== undefined,
      patch.whatsapp ?? null,
      patch.location !== undefined,
      patch.location ?? null,
      patch.logoUrl !== undefined,
      patch.logoUrl ?? null,
      patch.coverUrl !== undefined,
      patch.coverUrl ?? null,
      patch.instagramHandle !== undefined,
      patch.instagramHandle ?? null,
      patch.tiktokHandle !== undefined,
      patch.tiktokHandle ?? null,
      patch.xHandle !== undefined,
      patch.xHandle ?? null,
      Boolean(patch.onboardingCompleted),
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("updateShopRow returned no row");
  return row;
}

export type InsertProductInput = {
  shopId: string;
  title: string;
  description: string | null;
  priceKobo: number;
  status: ProductStatus;
  slug: string;
  imageUrls?: string[];
  kind?: CatalogKind;
  compareAtKobo?: number | null;
  qtyAvailable?: number;
  sku?: string | null;
  category?: string | null;
  durationMinutes?: number | null;
  availabilityNote?: string | null;
};

export async function insertProduct(db: Queryable, input: InsertProductInput): Promise<ProductRow> {
  const { rows } = await db.query<ProductRow>(
    `INSERT INTO products (
       shop_id, title, description, price_kobo, status, slug, image_urls, kind,
       compare_at_kobo, qty_available, sku, category, duration_minutes, availability_note
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING ${PRODUCT_COLS}`,
    [
      input.shopId,
      input.title,
      input.description,
      input.priceKobo,
      input.status,
      input.slug,
      input.imageUrls ?? [],
      input.kind ?? "product",
      input.compareAtKobo ?? null,
      input.qtyAvailable ?? 20,
      input.sku ?? null,
      input.category ?? null,
      input.durationMinutes ?? null,
      input.availabilityNote ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("insertProduct returned no row");
  return row;
}

export async function listProductsByShop(db: Queryable, shopId: string): Promise<ProductRow[]> {
  const { rows } = await db.query<ProductRow>(
    `SELECT ${PRODUCT_COLS} FROM products WHERE shop_id = $1 ORDER BY created_at DESC`,
    [shopId],
  );
  return rows;
}

export async function listPublishedProductsByShop(db: Queryable, shopId: string): Promise<ProductRow[]> {
  const { rows } = await db.query<ProductRow>(
    `SELECT ${PRODUCT_COLS}
     FROM products
     WHERE shop_id = $1 AND status = 'published'
     ORDER BY created_at DESC`,
    [shopId],
  );
  return rows;
}

export async function findProductById(db: Queryable, id: string): Promise<ProductRow | undefined> {
  const { rows } = await db.query<ProductRow>(`SELECT ${PRODUCT_COLS} FROM products WHERE id = $1`, [id]);
  return rows[0];
}

export async function findProductByShopAndSlug(
  db: Queryable,
  shopId: string,
  slug: string,
): Promise<ProductRow | undefined> {
  const { rows } = await db.query<ProductRow>(
    `SELECT ${PRODUCT_COLS} FROM products WHERE shop_id = $1 AND slug = $2`,
    [shopId, slug],
  );
  return rows[0];
}

export type ProductPatch = {
  title?: string;
  description?: string | null;
  priceKobo?: number;
  status?: ProductStatus;
  slug?: string;
  imageUrls?: string[];
  kind?: CatalogKind;
  compareAtKobo?: number | null;
  qtyAvailable?: number;
  sku?: string | null;
  category?: string | null;
  durationMinutes?: number | null;
  availabilityNote?: string | null;
};

export async function updateProductRow(db: Queryable, id: string, patch: ProductPatch): Promise<ProductRow> {
  const { rows } = await db.query<ProductRow>(
    `UPDATE products
     SET title = COALESCE($2, title),
         description = CASE WHEN $3::boolean THEN $4 ELSE description END,
         price_kobo = COALESCE($5, price_kobo),
         status = COALESCE($6, status),
         slug = COALESCE($7, slug),
         image_urls = COALESCE($8, image_urls),
         kind = COALESCE($9, kind),
         compare_at_kobo = CASE WHEN $10::boolean THEN $11 ELSE compare_at_kobo END,
         qty_available = COALESCE($12, qty_available),
         sku = CASE WHEN $13::boolean THEN $14 ELSE sku END,
         category = CASE WHEN $15::boolean THEN $16 ELSE category END,
         duration_minutes = CASE WHEN $17::boolean THEN $18 ELSE duration_minutes END,
         availability_note = CASE WHEN $19::boolean THEN $20 ELSE availability_note END,
         updated_at = now()
     WHERE id = $1
     RETURNING ${PRODUCT_COLS}`,
    [
      id,
      patch.title ?? null,
      patch.description !== undefined,
      patch.description ?? null,
      patch.priceKobo ?? null,
      patch.status ?? null,
      patch.slug ?? null,
      patch.imageUrls ?? null,
      patch.kind ?? null,
      patch.compareAtKobo !== undefined,
      patch.compareAtKobo ?? null,
      patch.qtyAvailable ?? null,
      patch.sku !== undefined,
      patch.sku ?? null,
      patch.category !== undefined,
      patch.category ?? null,
      patch.durationMinutes !== undefined,
      patch.durationMinutes ?? null,
      patch.availabilityNote !== undefined,
      patch.availabilityNote ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("updateProductRow returned no row");
  return row;
}

export async function archiveProductRow(db: Queryable, id: string): Promise<ProductRow> {
  return updateProductRow(db, id, { status: "archived" });
}

/** Called from orders after successful payment. Prototype-safe decrement. */
export async function decrementProductStock(
  db: Queryable,
  productId: string,
  quantity: number,
): Promise<ProductRow> {
  const { rows } = await db.query<ProductRow>(
    `UPDATE products
     SET qty_available = qty_available - $2,
         qty_sold = qty_sold + $2,
         updated_at = now()
     WHERE id = $1
       AND kind = 'product'
       AND qty_available >= $2
     RETURNING ${PRODUCT_COLS}`,
    [productId, quantity],
  );
  const row = rows[0];
  if (!row) throw new Error("INSUFFICIENT_STOCK");
  return row;
}

export type IntegrationChannel = "whatsapp" | "instagram" | "tiktok" | "x";
export type IntegrationStatus = "not_connected" | "connecting" | "connected" | "error";

export type IntegrationRow = {
  id: string;
  shop_id: string;
  channel: IntegrationChannel;
  status: IntegrationStatus;
  provider: string;
  external_account: string | null;
  last_error: string | null;
  connected_at: Date | null;
  metadata: Record<string, unknown>;
  updated_at: Date;
};

export async function listIntegrations(db: Queryable, shopId: string): Promise<IntegrationRow[]> {
  const { rows } = await db.query<IntegrationRow>(
    `SELECT id, shop_id, channel, status, provider, external_account, last_error, connected_at, metadata, updated_at
     FROM shop_integrations WHERE shop_id = $1`,
    [shopId],
  );
  return rows;
}

export async function upsertIntegration(
  db: Queryable,
  input: {
    shopId: string;
    channel: IntegrationChannel;
    status: IntegrationStatus;
    provider: string;
    externalAccount?: string | null;
    lastError?: string | null;
    connected?: boolean;
  },
): Promise<IntegrationRow> {
  const { rows } = await db.query<IntegrationRow>(
    `INSERT INTO shop_integrations (shop_id, channel, status, provider, external_account, last_error, connected_at)
     VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $7 THEN now() ELSE NULL END)
     ON CONFLICT (shop_id, channel) DO UPDATE SET
       status = EXCLUDED.status,
       provider = EXCLUDED.provider,
       external_account = EXCLUDED.external_account,
       last_error = EXCLUDED.last_error,
       connected_at = CASE WHEN $7 THEN now() ELSE NULL END,
       updated_at = now()
     RETURNING id, shop_id, channel, status, provider, external_account, last_error, connected_at, metadata, updated_at`,
    [
      input.shopId,
      input.channel,
      input.status,
      input.provider,
      input.externalAccount ?? null,
      input.lastError ?? null,
      Boolean(input.connected),
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("upsertIntegration returned no row");
  return row;
}

export type WhatsAppSettingsRow = {
  shop_id: string;
  share_catalog: boolean;
  notify_merchant: boolean;
  notify_customer: boolean;
  contact_number: string | null;
  templates: Record<string, string>;
  updated_at: Date;
};

export async function getWhatsAppSettings(db: Queryable, shopId: string): Promise<WhatsAppSettingsRow | undefined> {
  const { rows } = await db.query<WhatsAppSettingsRow>(
    `SELECT shop_id, share_catalog, notify_merchant, notify_customer, contact_number, templates, updated_at
     FROM shop_whatsapp_settings WHERE shop_id = $1`,
    [shopId],
  );
  return rows[0];
}

export async function upsertWhatsAppSettings(
  db: Queryable,
  shopId: string,
  patch: Partial<{
    shareCatalog: boolean;
    notifyMerchant: boolean;
    notifyCustomer: boolean;
    contactNumber: string | null;
    templates: Record<string, string>;
  }>,
): Promise<WhatsAppSettingsRow> {
  const existing = await getWhatsAppSettings(db, shopId);
  const share = patch.shareCatalog ?? existing?.share_catalog ?? true;
  const merchant = patch.notifyMerchant ?? existing?.notify_merchant ?? true;
  const customer = patch.notifyCustomer ?? existing?.notify_customer ?? true;
  const contact = patch.contactNumber !== undefined ? patch.contactNumber : (existing?.contact_number ?? null);
  const templates = patch.templates ?? existing?.templates ?? {};
  const { rows } = await db.query<WhatsAppSettingsRow>(
    `INSERT INTO shop_whatsapp_settings (shop_id, share_catalog, notify_merchant, notify_customer, contact_number, templates)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (shop_id) DO UPDATE SET
       share_catalog = EXCLUDED.share_catalog,
       notify_merchant = EXCLUDED.notify_merchant,
       notify_customer = EXCLUDED.notify_customer,
       contact_number = EXCLUDED.contact_number,
       templates = EXCLUDED.templates,
       updated_at = now()
     RETURNING shop_id, share_catalog, notify_merchant, notify_customer, contact_number, templates, updated_at`,
    [shopId, share, merchant, customer, contact, JSON.stringify(templates)],
  );
  const row = rows[0];
  if (!row) throw new Error("upsertWhatsAppSettings returned no row");
  return row;
}

export type PublicationRow = {
  id: string;
  shop_id: string;
  product_id: string;
  channel: string;
  caption: string;
  status: string;
  provider: string;
  detail: string;
  created_at: Date;
};

export async function insertPublication(
  db: Queryable,
  input: {
    shopId: string;
    productId: string;
    channel: string;
    caption: string;
    status: string;
    provider: string;
    detail: string;
  },
): Promise<PublicationRow> {
  const { rows } = await db.query<PublicationRow>(
    `INSERT INTO catalog_publications (shop_id, product_id, channel, caption, status, provider, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, shop_id, product_id, channel, caption, status, provider, detail, created_at`,
    [input.shopId, input.productId, input.channel, input.caption, input.status, input.provider, input.detail],
  );
  const row = rows[0];
  if (!row) throw new Error("insertPublication returned no row");
  return row;
}

export async function listPublicationsForProduct(
  db: Queryable,
  productId: string,
): Promise<PublicationRow[]> {
  const { rows } = await db.query<PublicationRow>(
    `SELECT id, shop_id, product_id, channel, caption, status, provider, detail, created_at
     FROM catalog_publications WHERE product_id = $1 ORDER BY created_at DESC LIMIT 40`,
    [productId],
  );
  return rows;
}

export type NotificationEventRow = {
  id: string;
  shop_id: string;
  order_id: string | null;
  channel: string;
  template_key: string;
  status: string;
  provider: string;
  body: string;
  recipient: string | null;
  created_at: Date;
};

export async function insertNotificationEvent(
  db: Queryable,
  input: {
    shopId: string;
    orderId?: string | null;
    channel: string;
    templateKey: string;
    status: string;
    provider: string;
    body: string;
    recipient?: string | null;
  },
): Promise<NotificationEventRow> {
  const { rows } = await db.query<NotificationEventRow>(
    `INSERT INTO notification_events (shop_id, order_id, channel, template_key, status, provider, body, recipient)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, shop_id, order_id, channel, template_key, status, provider, body, recipient, created_at`,
    [
      input.shopId,
      input.orderId ?? null,
      input.channel,
      input.templateKey,
      input.status,
      input.provider,
      input.body,
      input.recipient ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("insertNotificationEvent returned no row");
  return row;
}

export async function listNotificationEvents(db: Queryable, shopId: string, limit = 40): Promise<NotificationEventRow[]> {
  const { rows } = await db.query<NotificationEventRow>(
    `SELECT id, shop_id, order_id, channel, template_key, status, provider, body, recipient, created_at
     FROM notification_events WHERE shop_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [shopId, limit],
  );
  return rows;
}
