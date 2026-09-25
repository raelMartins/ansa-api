import { randomBytes } from "node:crypto";
import { getPool } from "../../db/pool.js";
import { conflict, notFound } from "../../shared/errors.js";
import { isUniqueViolation } from "../../shared/pg.js";
import {
  archiveProductRow,
  findProductById,
  findProductByShopAndSlug,
  findShopByOwner,
  findShopBySlug,
  insertProduct,
  insertShop,
  listProductsByShop,
  listPublishedProductsByShop,
  updateProductRow,
  updateShopRow,
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
  createdAt: string;
};

export type PublicProduct = {
  id: string;
  shopId: string;
  title: string;
  description: string | null;
  priceKobo: number;
  currency: string;
  status: ProductStatus;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

function toPublicShop(row: ShopRow): PublicShop {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.created_at.toISOString(),
  };
}

function toPublicProduct(row: ProductRow): PublicProduct {
  return {
    id: row.id,
    shopId: row.shop_id,
    title: row.title,
    description: row.description,
    priceKobo: row.price_kobo,
    currency: row.currency,
    status: row.status,
    slug: row.slug,
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

export async function createShop(
  ownerUserId: string,
  input: { name: string; slug?: string; description?: string },
): Promise<PublicShop> {
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
    });
    return toPublicShop(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict("Shop slug is already taken");
    }
    throw err;
  }
}

export async function getMyShop(ownerUserId: string): Promise<PublicShop> {
  const row = await findShopByOwner(getPool(), ownerUserId);
  if (!row) throw notFound("Shop not found");
  return toPublicShop(row);
}

export async function updateMyShop(
  ownerUserId: string,
  patch: { name?: string; slug?: string; description?: string | null },
): Promise<PublicShop> {
  const existing = await findShopByOwner(getPool(), ownerUserId);
  if (!existing) throw notFound("Shop not found");
  try {
    const row = await updateShopRow(getPool(), existing.id, patch);
    return toPublicShop(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict("Shop slug is already taken");
    }
    throw err;
  }
}

async function requireOwnedShop(ownerUserId: string): Promise<ShopRow> {
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

export async function createProduct(
  ownerUserId: string,
  input: { title: string; description?: string; priceKobo: number; status: "draft" | "published"; slug?: string },
): Promise<PublicProduct> {
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
  patch: {
    title?: string;
    description?: string | null;
    priceKobo?: number;
    status?: ProductStatus;
    slug?: string;
  },
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
