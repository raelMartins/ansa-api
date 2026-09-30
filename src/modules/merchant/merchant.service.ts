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
  findProductByMerchantAndSlug,
  listMerchantsByOwner,
  findMerchantByOwnerAndId,
  findMerchantById,
  findMerchantBySlug,
  getWhatsAppSettings,
  insertNotificationEvent,
  insertProduct,
  insertPublication,
  insertMerchant,
  listIntegrations,
  listNotificationEvents,
  listProductsByMerchant,
  listPublicationsForProduct,
  listPublishedProductsByMerchant,
  updateProductRow,
  updateMerchantRow,
  upsertIntegration,
  upsertWhatsAppSettings,
  type CatalogKind,
  type IntegrationChannel,
  type ProductRow,
  type ProductStatus,
  type MerchantRow,
} from "./merchant.repository.js";
import { DomainEventName, recordDomainEvent } from "../analytics/events.js";
import { resolveMediaProvider } from "../media/provider.js";
import { slugify, withSuffix } from "./slug.js";

export type PublicMerchant = {
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
  merchantId: string;
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

export function toPublicMerchant(row: MerchantRow): PublicMerchant {
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
    merchantId: row.merchant_id,
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

async function uniqueMerchantSlug(preferred: string): Promise<string> {
  const db = getPool();
  let candidate = preferred;
  for (let i = 0; i < 8; i += 1) {
    const existing = await findMerchantBySlug(db, candidate);
    if (!existing) return candidate;
    candidate = withSuffix(preferred, uniqueSuffix());
  }
  throw conflict("Could not allocate a unique shop slug");
}

async function uniqueProductSlug(merchantId: string, preferred: string): Promise<string> {
  const db = getPool();
  let candidate = preferred;
  for (let i = 0; i < 8; i += 1) {
    const existing = await findProductByMerchantAndSlug(db, merchantId, candidate);
    if (!existing) return candidate;
    candidate = withSuffix(preferred, uniqueSuffix());
  }
  throw conflict("Could not allocate a unique product slug");
}

export type CreateMerchantInput = {
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

export async function createMerchant(ownerUserId: string, input: CreateMerchantInput): Promise<PublicMerchant> {
  const db = getPool();
  const base = input.slug ?? slugify(input.name);
  const slug = await uniqueMerchantSlug(base);
  try {
    const row = await insertMerchant(db, {
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
    await recordDomainEvent({
      eventName: DomainEventName.merchantCreated,
      userId: ownerUserId,
      merchantId: row.id,
      properties: { slug: row.slug },
    });
    return toPublicMerchant(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict("Merchant slug is already taken");
    }
    throw err;
  }
}

const CHANNELS: IntegrationChannel[] = ["whatsapp", "instagram", "tiktok", "x"];

async function ensureDefaultIntegrations(merchantId: string): Promise<void> {
  const db = getPool();
  const existing = await listIntegrations(db, merchantId);
  const have = new Set(existing.map((r) => r.channel));
  for (const channel of CHANNELS) {
    if (have.has(channel)) continue;
    await upsertIntegration(db, {
      merchantId,
      channel,
      status: "not_connected",
      provider: "mock",
    });
  }
}

export async function listMerchantsForOwner(ownerUserId: string): Promise<PublicMerchant[]> {
  const rows = await listMerchantsByOwner(getPool(), ownerUserId);
  for (const row of rows) await ensureDefaultIntegrations(row.id);
  return rows.map(toPublicMerchant);
}

export async function getMerchant(ownerUserId: string, merchantId: string): Promise<PublicMerchant> {
  const row = await requireOwnedMerchant(ownerUserId, merchantId);
  await ensureDefaultIntegrations(row.id);
  return toPublicMerchant(row);
}

export async function updateMerchant(ownerUserId: string, merchantId: string, patch: CreateMerchantInput): Promise<PublicMerchant> {
  await requireOwnedMerchant(ownerUserId, merchantId);
  try {
    const row = await updateMerchantRow(getPool(), merchantId, {
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
    return toPublicMerchant(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict("Merchant slug is already taken");
    }
    throw err;
  }
}

export async function requireOwnedMerchant(ownerUserId: string, merchantId: string): Promise<MerchantRow> {
  const row = await findMerchantByOwnerAndId(getPool(), ownerUserId, merchantId);
  if (!row) throw notFound("Merchant not found");
  return row;
}

async function requireOwnedProduct(ownerUserId: string, merchantId: string, productId: string): Promise<ProductRow> {
  const shop = await requireOwnedMerchant(ownerUserId, merchantId);
  const product = await findProductById(getPool(), productId);
  if (!product || product.merchant_id !== shop.id) {
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

export async function createProduct(ownerUserId: string, merchantId: string, input: CreateProductInput): Promise<PublicProduct> {
  const shop = await requireOwnedMerchant(ownerUserId, merchantId);
  const slug = await uniqueProductSlug(shop.id, input.slug ?? slugify(input.title));
  try {
    const row = await insertProduct(getPool(), {
      merchantId: shop.id,
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
      throw conflict("A product with this slug already exists for this merchant");
    }
    throw err;
  }
}

export async function listMyProducts(ownerUserId: string, merchantId: string): Promise<PublicProduct[]> {
  const shop = await requireOwnedMerchant(ownerUserId, merchantId);
  const rows = await listProductsByMerchant(getPool(), shop.id);
  return rows.map(toPublicProduct);
}

export async function getMyProduct(ownerUserId: string, merchantId: string, productId: string): Promise<PublicProduct> {
  return toPublicProduct(await requireOwnedProduct(ownerUserId, merchantId, productId));
}

export async function updateMyProduct(
  ownerUserId: string,
  merchantId: string,
  productId: string,
  patch: Partial<CreateProductInput> & { status?: ProductStatus },
): Promise<PublicProduct> {
  await requireOwnedProduct(ownerUserId, merchantId, productId);
  try {
    const row = await updateProductRow(getPool(), productId, patch);
    return toPublicProduct(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict("A product with this slug already exists for this merchant");
    }
    throw err;
  }
}

export async function archiveMyProduct(ownerUserId: string, merchantId: string, productId: string): Promise<PublicProduct> {
  await requireOwnedProduct(ownerUserId, merchantId, productId);
  return toPublicProduct(await archiveProductRow(getPool(), productId));
}

export async function getPublicMerchant(merchantSlug: string): Promise<PublicMerchant> {
  const shop = await findMerchantBySlug(getPool(), merchantSlug);
  if (!shop) throw notFound("Merchant not found");
  return toPublicMerchant(shop);
}

export async function listPublicProducts(merchantSlug: string): Promise<PublicProduct[]> {
  const shop = await findMerchantBySlug(getPool(), merchantSlug);
  if (!shop) throw notFound("Merchant not found");
  const rows = await listPublishedProductsByMerchant(getPool(), shop.id);
  return rows.map(toPublicProduct);
}

export async function getPublicProduct(merchantSlug: string, productSlug: string): Promise<PublicProduct> {
  const shop = await findMerchantBySlug(getPool(), merchantSlug);
  if (!shop) throw notFound("Product not found");
  const product = await findProductByMerchantAndSlug(getPool(), shop.id, productSlug);
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

export async function listMyIntegrations(ownerUserId: string, merchantId: string) {
  const shop = await requireOwnedMerchant(ownerUserId, merchantId);
  await ensureDefaultIntegrations(shop.id);
  const rows = await listIntegrations(getPool(), shop.id);
  return rows.map(toPublicIntegration);
}

export async function simulateConnect(
  ownerUserId: string,
  merchantId: string,
  channel: IntegrationChannel,
  account?: string,
): Promise<ReturnType<typeof toPublicIntegration>> {
  const shop = await requireOwnedMerchant(ownerUserId, merchantId);
  await upsertIntegration(getPool(), {
    merchantId: shop.id,
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
    merchantId: shop.id,
    channel,
    status: "connected",
    provider: "mock",
    externalAccount: handle,
    connected: true,
  });
  return toPublicIntegration(row);
}

export async function disconnectChannel(ownerUserId: string, merchantId: string, channel: IntegrationChannel) {
  const shop = await requireOwnedMerchant(ownerUserId, merchantId);
  const row = await upsertIntegration(getPool(), {
    merchantId: shop.id,
    channel,
    status: "not_connected",
    provider: "mock",
    externalAccount: null,
    connected: false,
  });
  return toPublicIntegration(row);
}

export async function getMyWhatsApp(ownerUserId: string, merchantId: string) {
  const shop = await requireOwnedMerchant(ownerUserId, merchantId);
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
  merchantId: string,
  patch: {
    shareCatalog?: boolean;
    notifyMerchant?: boolean;
    notifyCustomer?: boolean;
    contactNumber?: string | null;
    templates?: Record<string, string>;
  },
) {
  const shop = await requireOwnedMerchant(ownerUserId, merchantId);
  await upsertWhatsAppSettings(getPool(), shop.id, patch);
  return getMyWhatsApp(ownerUserId, merchantId);
}

function formatNairaLabel(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
}

export async function shareItem(
  ownerUserId: string,
  merchantId: string,
  productId: string,
  input: { channel: IntegrationChannel; caption?: string },
) {
  const shop = await requireOwnedMerchant(ownerUserId, merchantId);
  const product = await requireOwnedProduct(ownerUserId, merchantId, productId);
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
      merchantName: shop.name,
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
    merchantId: shop.id,
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

export async function getItemShare(ownerUserId: string, merchantId: string, productId: string) {
  const shop = await requireOwnedMerchant(ownerUserId, merchantId);
  const product = await requireOwnedProduct(ownerUserId, merchantId, productId);
  await ensureDefaultIntegrations(shop.id);
  const [integrations, publications] = await Promise.all([
    listIntegrations(getPool(), shop.id),
    listPublicationsForProduct(getPool(), product.id),
  ]);
  const url = `${env().PUBLIC_APP_URL}/shop/${shop.slug}/${product.slug}`;
  const caption = defaultCaption({
    title: product.title,
    priceLabel: formatNairaLabel(product.price_kobo),
    merchantName: shop.name,
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
  merchantId: string;
  orderId: string;
  templateKey: string;
  vars: Record<string, string>;
  recipient: string | null;
}): Promise<{ body: string; detail: string; simulated: boolean }> {
  const settings = await getWhatsAppSettings(getPool(), input.merchantId);
  const template = settings?.templates?.[input.templateKey] ?? `Update: {{reference}}`;
  const body = renderTemplate(template, input.vars);
  const to = input.recipient ?? settings?.contact_number ?? "unknown";
  const result = await resolveWhatsAppProvider().sendTemplate({
    to,
    templateKey: input.templateKey,
    body,
  });
  await insertNotificationEvent(getPool(), {
    merchantId: input.merchantId,
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

export async function listMyActivity(ownerUserId: string, merchantId: string) {
  const shop = await requireOwnedMerchant(ownerUserId, merchantId);
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
  try {
    const result = await resolveMediaProvider(uploadsDir).upload({ dataUrl, maxBytes: 4_000_000 });
    return { url: result.url };
  } catch (err) {
    throw badRequest(err instanceof Error ? err.message : "Could not save media");
  }
}

export { findMerchantBySlug, findProductById, listMerchantsByOwner, findMerchantById, findMerchantByOwnerAndId };
export { decrementProductStock, getWhatsAppSettings } from "./merchant.repository.js";
export type { IntegrationChannel, MerchantRow, ProductRow } from "./merchant.repository.js";
