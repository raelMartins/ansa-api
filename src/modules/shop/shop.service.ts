import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { getPool } from "../../db/pool.js";
import { badRequest, conflict, notFound } from "../../shared/errors.js";
import { isUniqueViolation } from "../../shared/pg.js";
import { defaultCaption, MockWhatsAppCatalogProvider, resolveSocialProvider } from "../social/index.js";
import { renderTemplate, resolveWhatsAppProvider } from "../notifications/index.js";
import {
  archiveProductRow,
  findProductById,
  findProductByShopAndSlug,
  findShopByOwner,
  findShopById,
  findShopBySlug,
  getWhatsAppSettings,
  insertNotificationEvent,
  insertProduct,
  insertPublication,
  insertShop,
  listIntegrations,
  listNotificationEvents,
  listProductsByShop,
  listPublicationsForProduct,
  listPublishedProductsByShop,
  updateProductRow,
  updateShopRow,
  upsertIntegration,
  upsertWhatsAppSettings,
  type CatalogKind,
  type IntegrationChannel,
  type ProductRow,
  type ProductStatus,
  type ShopRow,
} from "./shop.repository.js";
import { slugify, withSuffix } from "./slug.js";

export type PublicShop = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  phone: string | null;
  whatsapp: string | null;
  location: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  xHandle: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
};

export type PublicProduct = {
  id: string;
  shopId: string;
  title: string;
  description: string | null;
  priceKobo: number;
  compareAtKobo: number | null;
  currency: string;
  status: ProductStatus;
  slug: string;
  imageUrls: string[];
  kind: CatalogKind;
  qtyAvailable: number;
  qtySold: number;
  sku: string | null;
  category: string | null;
  durationMinutes: number | null;
  availabilityNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toPublicShop(row: ShopRow): PublicShop {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    phone: row.phone,
    whatsapp: row.whatsapp,
    location: row.location,
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    instagramHandle: row.instagram_handle,
    tiktokHandle: row.tiktok_handle,
    xHandle: row.x_handle,
    onboardingCompleted: Boolean(row.onboarding_completed_at),
    createdAt: row.created_at.toISOString(),
  };
}

export function toPublicProduct(row: ProductRow): PublicProduct {
  return {
    id: row.id,
    shopId: row.shop_id,
    title: row.title,
    description: row.description,
    priceKobo: row.price_kobo,
    compareAtKobo: row.compare_at_kobo,
    currency: row.currency,
    status: row.status,
    slug: row.slug,
    imageUrls: row.image_urls ?? [],
    kind: row.kind,
    qtyAvailable: row.qty_available,
    qtySold: row.qty_sold,
    sku: row.sku,
    category: row.category,
    durationMinutes: row.duration_minutes,
    availabilityNote: row.availability_note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function uniqueSuffix(): string {
  return randomBytes(3).toString("hex");
}

async function uniqueShopSlug(preferred: string): Promise<string> {
  const db = getPool();
  let candidate = preferred;
  for (let i = 0; i < 8; i += 1) {
    const existing = await findShopBySlug(db, candidate);
    if (!existing) return candidate;
    candidate = withSuffix(preferred, uniqueSuffix());
  }
  throw conflict("Could not allocate a unique shop slug");
}

async function uniqueProductSlug(shopId: string, preferred: string): Promise<string> {
  const db = getPool();
  let candidate = preferred;
  for (let i = 0; i < 8; i += 1) {
    const existing = await findProductByShopAndSlug(db, shopId, candidate);
    if (!existing) return candidate;
    candidate = withSuffix(preferred, uniqueSuffix());
  }
  throw conflict("Could not allocate a unique product slug");
}

export type CreateShopInput = {
  name: string;
  slug?: string;
  description?: string;
  category?: string;
  phone?: string;
  whatsapp?: string;
  location?: string;
  logoUrl?: string;
  coverUrl?: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  xHandle?: string;
  onboardingCompleted?: boolean;
};

export async function createShop(ownerUserId: string, input: CreateShopInput): Promise<PublicShop> {
  const db = getPool();
  if (await findShopByOwner(db, ownerUserId)) {
    throw conflict("This account already has a shop");
  }
  const base = input.slug ?? slugify(input.name);
  const slug = await uniqueShopSlug(base);
  try {
    const row = await insertShop(db, {
      ownerUserId,
      name: input.name,
      slug,
      description: input.description ?? null,
      category: input.category,
      phone: input.phone,
      whatsapp: input.whatsapp,
      location: input.location,
      logoUrl: input.logoUrl,
      coverUrl: input.coverUrl,
      instagramHandle: input.instagramHandle,
      tiktokHandle: input.tiktokHandle,
      xHandle: input.xHandle,
      onboardingCompleted: input.onboardingCompleted ?? true,
    });
    await ensureDefaultIntegrations(row.id);
    await upsertWhatsAppSettings(db, row.id, { contactNumber: input.whatsapp ?? input.phone ?? null });
    return toPublicShop(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict("Shop slug is already taken");
    }
    throw err;
  }
}

const CHANNELS: IntegrationChannel[] = ["whatsapp", "instagram", "tiktok", "x"];

async function ensureDefaultIntegrations(shopId: string): Promise<void> {
  const db = getPool();
  const existing = await listIntegrations(db, shopId);
  const have = new Set(existing.map((r) => r.channel));
  for (const channel of CHANNELS) {
    if (have.has(channel)) continue;
    await upsertIntegration(db, {
      shopId,
      channel,
      status: "not_connected",
      provider: "mock",
    });
  }
}

export async function getMyShop(ownerUserId: string): Promise<PublicShop> {
  const row = await findShopByOwner(getPool(), ownerUserId);
  if (!row) throw notFound("Shop not found");
  await ensureDefaultIntegrations(row.id);
  return toPublicShop(row);
}

export async function updateMyShop(ownerUserId: string, patch: CreateShopInput): Promise<PublicShop> {
  const existing = await findShopByOwner(getPool(), ownerUserId);
  if (!existing) throw notFound("Shop not found");
  try {
    const row = await updateShopRow(getPool(), existing.id, {
      name: patch.name,
      slug: patch.slug,
      description: patch.description,
      category: patch.category,
      phone: patch.phone,
      whatsapp: patch.whatsapp,
      location: patch.location,
      logoUrl: patch.logoUrl,
      coverUrl: patch.coverUrl,
      instagramHandle: patch.instagramHandle,
      tiktokHandle: patch.tiktokHandle,
      xHandle: patch.xHandle,
      onboardingCompleted: patch.onboardingCompleted,
    });
    return toPublicShop(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict("Shop slug is already taken");
    }
    throw err;
  }
}

export async function requireOwnedShop(ownerUserId: string): Promise<ShopRow> {
  const shop = await findShopByOwner(getPool(), ownerUserId);
  if (!shop) throw notFound("Shop not found");
  return shop;
}

async function requireOwnedProduct(ownerUserId: string, productId: string): Promise<ProductRow> {
  const shop = await requireOwnedShop(ownerUserId);
  const product = await findProductById(getPool(), productId);
  if (!product || product.shop_id !== shop.id) {
    throw notFound("Product not found");
  }
  return product;
}

export type CreateProductInput = {
  title: string;
  description?: string;
  priceKobo: number;
  status: "draft" | "published";
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

export async function createProduct(ownerUserId: string, input: CreateProductInput): Promise<PublicProduct> {
  const shop = await requireOwnedShop(ownerUserId);
  const slug = await uniqueProductSlug(shop.id, input.slug ?? slugify(input.title));
  try {
    const row = await insertProduct(getPool(), {
      shopId: shop.id,
      title: input.title,
      description: input.description ?? null,
      priceKobo: input.priceKobo,
      status: input.status,
      slug,
      imageUrls: input.imageUrls,
      kind: input.kind,
      compareAtKobo: input.compareAtKobo,
      qtyAvailable: input.qtyAvailable,
      sku: input.sku,
      category: input.category,
      durationMinutes: input.durationMinutes,
      availabilityNote: input.availabilityNote,
    });
    return toPublicProduct(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict("A product with this slug already exists in the shop");
    }
    throw err;
  }
}

export async function listMyProducts(ownerUserId: string): Promise<PublicProduct[]> {
  const shop = await requireOwnedShop(ownerUserId);
  const rows = await listProductsByShop(getPool(), shop.id);
  return rows.map(toPublicProduct);
}

export async function getMyProduct(ownerUserId: string, productId: string): Promise<PublicProduct> {
  return toPublicProduct(await requireOwnedProduct(ownerUserId, productId));
}

export async function updateMyProduct(
  ownerUserId: string,
  productId: string,
  patch: Partial<CreateProductInput> & { status?: ProductStatus },
): Promise<PublicProduct> {
  await requireOwnedProduct(ownerUserId, productId);
  try {
    const row = await updateProductRow(getPool(), productId, patch);
    return toPublicProduct(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict("A product with this slug already exists in the shop");
    }
    throw err;
  }
}

export async function archiveMyProduct(ownerUserId: string, productId: string): Promise<PublicProduct> {
  await requireOwnedProduct(ownerUserId, productId);
  return toPublicProduct(await archiveProductRow(getPool(), productId));
}

export async function getPublicShop(shopSlug: string): Promise<PublicShop> {
  const shop = await findShopBySlug(getPool(), shopSlug);
  if (!shop) throw notFound("Shop not found");
  return toPublicShop(shop);
}

export async function listPublicProducts(shopSlug: string): Promise<PublicProduct[]> {
  const shop = await findShopBySlug(getPool(), shopSlug);
  if (!shop) throw notFound("Shop not found");
  const rows = await listPublishedProductsByShop(getPool(), shop.id);
  return rows.map(toPublicProduct);
}

export async function getPublicProduct(shopSlug: string, productSlug: string): Promise<PublicProduct> {
  const shop = await findShopBySlug(getPool(), shopSlug);
  if (!shop) throw notFound("Product not found");
  const product = await findProductByShopAndSlug(getPool(), shop.id, productSlug);
  if (!product || product.status !== "published") {
    throw notFound("Product not found");
  }
  return toPublicProduct(product);
}

export function toPublicIntegration(row: {
  channel: IntegrationChannel;
  status: string;
  provider: string;
  external_account: string | null;
  last_error: string | null;
  connected_at: Date | null;
  updated_at: Date;
}) {
  return {
    channel: row.channel,
    status: row.status,
    provider: row.provider,
    externalAccount: row.external_account,
    lastError: row.last_error,
    connectedAt: row.connected_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
    simulated: row.provider === "mock",
  };
}

export async function listMyIntegrations(ownerUserId: string) {
  const shop = await requireOwnedShop(ownerUserId);
  await ensureDefaultIntegrations(shop.id);
  const rows = await listIntegrations(getPool(), shop.id);
  return rows.map(toPublicIntegration);
}

export async function simulateConnect(
  ownerUserId: string,
  channel: IntegrationChannel,
  account?: string,
): Promise<ReturnType<typeof toPublicIntegration>> {
  const shop = await requireOwnedShop(ownerUserId);
  await upsertIntegration(getPool(), {
    shopId: shop.id,
    channel,
    status: "connecting",
    provider: "mock",
  });
  const handle =
    account?.trim() ||
    (channel === "whatsapp"
      ? (shop.whatsapp ?? shop.phone ?? "+2348000000000")
      : `@${shop.slug}`);
  const row = await upsertIntegration(getPool(), {
    shopId: shop.id,
    channel,
    status: "connected",
    provider: "mock",
    externalAccount: handle,
    connected: true,
  });
  return toPublicIntegration(row);
}

export async function disconnectChannel(ownerUserId: string, channel: IntegrationChannel) {
  const shop = await requireOwnedShop(ownerUserId);
  const row = await upsertIntegration(getPool(), {
    shopId: shop.id,
    channel,
    status: "not_connected",
    provider: "mock",
    externalAccount: null,
    connected: false,
  });
  return toPublicIntegration(row);
}

export async function getMyWhatsApp(ownerUserId: string) {
  const shop = await requireOwnedShop(ownerUserId);
  await ensureDefaultIntegrations(shop.id);
  const settings = await upsertWhatsAppSettings(getPool(), shop.id, {
    contactNumber: (await getWhatsAppSettings(getPool(), shop.id))?.contact_number ?? shop.whatsapp ?? shop.phone,
  });
  const integrations = await listIntegrations(getPool(), shop.id);
  const wa = integrations.find((i) => i.channel === "whatsapp");
  return {
    connection: wa ? toPublicIntegration(wa) : null,
    settings: {
      shareCatalog: settings.share_catalog,
      notifyMerchant: settings.notify_merchant,
      notifyCustomer: settings.notify_customer,
      contactNumber: settings.contact_number,
      templates: settings.templates,
    },
  };
}

export async function updateMyWhatsApp(
  ownerUserId: string,
  patch: {
    shareCatalog?: boolean;
    notifyMerchant?: boolean;
    notifyCustomer?: boolean;
    contactNumber?: string | null;
    templates?: Record<string, string>;
  },
) {
  const shop = await requireOwnedShop(ownerUserId);
  await upsertWhatsAppSettings(getPool(), shop.id, patch);
  return getMyWhatsApp(ownerUserId);
}

function formatNairaLabel(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
}

export async function shareItem(
  ownerUserId: string,
  productId: string,
  input: { channel: IntegrationChannel; caption?: string },
) {
  const shop = await requireOwnedShop(ownerUserId);
  const product = await requireOwnedProduct(ownerUserId, productId);
  await ensureDefaultIntegrations(shop.id);
  const integrations = await listIntegrations(getPool(), shop.id);
  const conn = integrations.find((i) => i.channel === input.channel);
  if (!conn || conn.status !== "connected") {
    throw badRequest(`${input.channel} is not connected`);
  }
  const itemUrl = `${env().PUBLIC_APP_URL}/shop/${shop.slug}/${product.slug}`;
  const caption =
    input.caption?.trim() ||
    defaultCaption({
      title: product.title,
      priceLabel: formatNairaLabel(product.price_kobo),
      shopName: shop.name,
      url: itemUrl,
    });

  const result =
    input.channel === "whatsapp"
      ? await new MockWhatsAppCatalogProvider().publish({
          account: conn.external_account ?? shop.slug,
          caption,
          itemUrl,
          title: product.title,
        })
      : await resolveSocialProvider(input.channel).publish({
          account: conn.external_account ?? shop.slug,
          caption,
          itemUrl,
          title: product.title,
        });

  const pub = await insertPublication(getPool(), {
    shopId: shop.id,
    productId: product.id,
    channel: input.channel,
    caption,
    status: result.ok ? "simulated" : "failed",
    provider: result.provider,
    detail: result.detail,
  });

  return {
    publication: {
      id: pub.id,
      channel: pub.channel,
      caption: pub.caption,
      status: pub.status,
      provider: pub.provider,
      detail: pub.detail,
      createdAt: pub.created_at.toISOString(),
      simulated: true,
    },
  };
}

export async function getItemShare(ownerUserId: string, productId: string) {
  const shop = await requireOwnedShop(ownerUserId);
  const product = await requireOwnedProduct(ownerUserId, productId);
  await ensureDefaultIntegrations(shop.id);
  const [integrations, publications] = await Promise.all([
    listIntegrations(getPool(), shop.id),
    listPublicationsForProduct(getPool(), product.id),
  ]);
  const url = `${env().PUBLIC_APP_URL}/shop/${shop.slug}/${product.slug}`;
  const caption = defaultCaption({
    title: product.title,
    priceLabel: formatNairaLabel(product.price_kobo),
    shopName: shop.name,
    url,
  });
  return {
    url,
    defaultCaption: caption,
    integrations: integrations.map(toPublicIntegration),
    publications: publications.map((p) => ({
      id: p.id,
      channel: p.channel,
      caption: p.caption,
      status: p.status,
      provider: p.provider,
      detail: p.detail,
      createdAt: p.created_at.toISOString(),
      simulated: p.provider === "mock",
    })),
  };
}

export async function recordOrderNotification(input: {
  shopId: string;
  orderId: string;
  templateKey: string;
  vars: Record<string, string>;
  recipient: string | null;
}): Promise<{ body: string; detail: string; simulated: boolean }> {
  const settings = await getWhatsAppSettings(getPool(), input.shopId);
  const template = settings?.templates?.[input.templateKey] ?? `Update: {{reference}}`;
  const body = renderTemplate(template, input.vars);
  const to = input.recipient ?? settings?.contact_number ?? "unknown";
  const result = await resolveWhatsAppProvider().sendTemplate({
    to,
    templateKey: input.templateKey,
    body,
  });
  await insertNotificationEvent(getPool(), {
    shopId: input.shopId,
    orderId: input.orderId,
    channel: "whatsapp",
    templateKey: input.templateKey,
    status: result.ok ? "simulated" : "failed",
    provider: result.provider,
    body,
    recipient: to,
  });
  return { body, detail: result.detail, simulated: result.simulated };
}

export async function listMyActivity(ownerUserId: string) {
  const shop = await requireOwnedShop(ownerUserId);
  const events = await listNotificationEvents(getPool(), shop.id, 50);
  return events.map((e) => ({
    id: e.id,
    channel: e.channel,
    templateKey: e.template_key,
    status: e.status,
    provider: e.provider,
    body: e.body,
    recipient: e.recipient,
    orderId: e.order_id,
    createdAt: e.created_at.toISOString(),
    simulated: e.provider === "mock",
  }));
}

const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../uploads");

export function getUploadsDir(): string {
  return uploadsDir;
}

export async function saveMerchantMedia(dataUrl: string): Promise<{ url: string }> {
  const match = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/i.exec(dataUrl.replace(/\s/g, ""));
  if (!match?.[1] || !match[2] || !match[3]) {
    throw badRequest("Use a PNG, JPEG, WebP, or GIF data URL");
  }
  const sub = match[2].toLowerCase();
  const ext = sub === "jpeg" || sub === "jpg" ? "jpg" : sub;
  const buf = Buffer.from(match[3], "base64");
  if (buf.length > 4_000_000) {
    throw badRequest("Image is too large (max 4MB)");
  }
  await mkdir(uploadsDir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(uploadsDir, name), buf);
  return { url: `/uploads/${name}` };
}

export { findShopBySlug, findProductById, findShopByOwner, findShopById };
export { decrementProductStock, getWhatsAppSettings } from "./shop.repository.js";
export type { IntegrationChannel, ShopRow, ProductRow } from "./shop.repository.js";
