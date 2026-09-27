import { randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { getPool } from "../../db/pool.js";
import { badRequest, conflict, notFound } from "../../shared/errors.js";
import { resolvePaymentProvider } from "../payments/index.js";
import {
  decrementProductStock,
  findProductById,
  findShopById,
  findShopBySlug,
  recordOrderNotification,
  requireOwnedShop,
  toPublicShop,
} from "../shop/shop.service.js";
import { listProductsByShop } from "../shop/shop.repository.js";
import {
  findOrderById,
  findOrderByReference,
  insertOrder,
  insertOrderItem,
  insertPayment,
  listCustomers,
  listOrderItems,
  listOrdersByShop,
  markPaymentPaid,
  shopOrderStats,
  updateOrderPayment,
  updateOrderStatus,
  type OrderItemRow,
  type OrderRow,
  type OrderStatus,
} from "./orders.repository.js";

const DELIVERY_FEE_KOBO = 250_000;

export type CheckoutItemInput = { productId: string; quantity: number };

export type CheckoutInput = {
  shopSlug: string;
  items: CheckoutItemInput[];
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  fulfilment: "pickup" | "delivery";
  deliveryAddress?: string;
  deliveryInstructions?: string;
};

function newReference(): string {
  return `ANSA-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function toPublicOrder(order: OrderRow, items: OrderItemRow[], shopName?: string) {
  return {
    id: order.id,
    shopId: order.shop_id,
    shopName: shopName ?? null,
    reference: order.reference,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerEmail: order.customer_email,
    fulfilment: order.fulfilment,
    deliveryAddress: order.delivery_address,
    deliveryInstructions: order.delivery_instructions,
    deliveryFeeKobo: order.delivery_fee_kobo,
    subtotalKobo: order.subtotal_kobo,
    totalKobo: order.total_kobo,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    paymentProvider: order.payment_provider,
    createdAt: order.created_at.toISOString(),
    updatedAt: order.updated_at.toISOString(),
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      title: i.title,
      kind: i.kind,
      quantity: i.quantity,
      unitPriceKobo: i.unit_price_kobo,
    })),
  };
}

export async function checkout(input: CheckoutInput) {
  if (input.items.length === 0) throw badRequest("Cart is empty");
  if (input.fulfilment === "delivery" && !input.deliveryAddress?.trim()) {
    throw badRequest("Delivery address is required");
  }

  const shop = await findShopBySlug(getPool(), input.shopSlug);
  if (!shop) throw notFound("Shop not found");

  const lines: { productId: string; title: string; kind: "product" | "service"; quantity: number; unitPriceKobo: number }[] =
    [];
  let subtotal = 0;
  for (const item of input.items) {
    const product = await findProductById(getPool(), item.productId);
    if (!product || product.shop_id !== shop.id || product.status !== "published") {
      throw notFound("One of the items is no longer available");
    }
    if (item.quantity < 1 || item.quantity > 99) throw badRequest("Invalid quantity");
    if (product.kind === "product" && product.qty_available < item.quantity) {
      throw conflict(`${product.title} does not have enough stock`);
    }
    lines.push({
      productId: product.id,
      title: product.title,
      kind: product.kind,
      quantity: item.quantity,
      unitPriceKobo: product.price_kobo,
    });
    subtotal += product.price_kobo * item.quantity;
  }

  const deliveryFee = input.fulfilment === "delivery" ? DELIVERY_FEE_KOBO : 0;
  const total = subtotal + deliveryFee;
  const provider = resolvePaymentProvider();
  const reference = newReference();
  const db = getPool();
  const client = await db.connect();
  let order: OrderRow;
  try {
    await client.query("BEGIN");
    order = await insertOrder(client, {
      shopId: shop.id,
      reference,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      customerEmail: input.customerEmail?.trim() || null,
      fulfilment: input.fulfilment,
      deliveryAddress: input.deliveryAddress?.trim() || null,
      deliveryInstructions: input.deliveryInstructions?.trim() || null,
      deliveryFeeKobo: deliveryFee,
      subtotalKobo: subtotal,
      totalKobo: total,
      paymentStatus: "pending",
      orderStatus: "pending",
      paymentProvider: provider.name,
    });
    for (const line of lines) {
      await insertOrderItem(client, {
        orderId: order.id,
        productId: line.productId,
        title: line.title,
        kind: line.kind,
        quantity: line.quantity,
        unitPriceKobo: line.unitPriceKobo,
      });
    }
    await insertPayment(client, {
      orderId: order.id,
      provider: provider.name,
      status: "pending",
      amountKobo: total,
      idempotencyKey: `pay:${order.id}`,
      simulated: provider.name === "mock",
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const callbackUrl = `${env().PUBLIC_APP_URL}/order/${reference}`;
  const init = await provider.initialize({
    amountKobo: total,
    email: input.customerEmail?.trim() || `${input.customerPhone.replace(/\D/g, "")}@guest.ansa.local`,
    reference,
    callbackUrl,
  });

  const items = await listOrderItems(getPool(), order.id);
  return {
    order: toPublicOrder(order, items, shop.name),
    shop: toPublicShop(shop),
    payment: {
      provider: init.provider,
      simulated: init.simulated,
      authorizationUrl: init.authorizationUrl,
    },
  };
}

export async function completeMockPayment(orderId: string) {
  const db = getPool();
  const existing = await findOrderById(db, orderId);
  if (!existing) throw notFound("Order not found");
  if (existing.payment_status === "paid") {
    const items = await listOrderItems(db, existing.id);
    return { order: toPublicOrder(existing, items), alreadyPaid: true };
  }

  const client = await db.connect();
  let paid: OrderRow;
  try {
    await client.query("BEGIN");
    const items = await listOrderItems(client, existing.id);
    for (const item of items) {
      if (item.kind !== "product" || !item.product_id) continue;
      try {
        await decrementProductStock(client, item.product_id, item.quantity);
      } catch {
        throw conflict("Not enough inventory to complete this payment");
      }
    }
    await markPaymentPaid(client, existing.id);
    paid = await updateOrderPayment(client, existing.id, {
      paymentStatus: "paid",
      orderStatus: "confirmed",
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const shopRow = await findShopById(db, paid.shop_id);
  const notify = await recordOrderNotification({
    shopId: paid.shop_id,
    orderId: paid.id,
    templateKey: "payment_confirmed",
    vars: {
      name: paid.customer_name,
      shop: shopRow?.name ?? "ansa shop",
      reference: paid.reference,
      total: new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(paid.total_kobo / 100),
    },
    recipient: paid.customer_phone,
  });

  const items = await listOrderItems(db, paid.id);
  return {
    order: toPublicOrder(paid, items, shopRow?.name),
    alreadyPaid: false,
    notification: notify,
  };
}

export async function getPublicOrder(reference: string) {
  const order = await findOrderByReference(getPool(), reference);
  if (!order) throw notFound("Order not found");
  const items = await listOrderItems(getPool(), order.id);
  const shop = await findShopById(getPool(), order.shop_id);
  return { order: toPublicOrder(order, items, shop?.name), shop: shop ? toPublicShop(shop) : null };
}

export async function listMerchantOrders(ownerUserId: string) {
  const shop = await requireOwnedShop(ownerUserId);
  const orders = await listOrdersByShop(getPool(), shop.id);
  const result = [];
  for (const order of orders) {
    const items = await listOrderItems(getPool(), order.id);
    result.push(toPublicOrder(order, items, shop.name));
  }
  return result;
}

export async function getMerchantOrder(ownerUserId: string, orderId: string) {
  const shop = await requireOwnedShop(ownerUserId);
  const order = await findOrderById(getPool(), orderId);
  if (!order || order.shop_id !== shop.id) throw notFound("Order not found");
  const items = await listOrderItems(getPool(), order.id);
  return toPublicOrder(order, items, shop.name);
}

const STATUS_TEMPLATE: Partial<Record<OrderStatus, string>> = {
  confirmed: "order_received",
  processing: "order_processing",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: "order_cancelled",
};

export async function changeOrderStatus(ownerUserId: string, orderId: string, status: OrderStatus) {
  const shop = await requireOwnedShop(ownerUserId);
  const order = await findOrderById(getPool(), orderId);
  if (!order || order.shop_id !== shop.id) throw notFound("Order not found");
  const updated = await updateOrderStatus(getPool(), orderId, status);
  const templateKey = STATUS_TEMPLATE[status];
  let notification = null;
  if (templateKey) {
    notification = await recordOrderNotification({
      shopId: shop.id,
      orderId: updated.id,
      templateKey,
      vars: {
        name: updated.customer_name,
        shop: shop.name,
        reference: updated.reference,
        total: new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(updated.total_kobo / 100),
      },
      recipient: updated.customer_phone,
    });
  }
  const items = await listOrderItems(getPool(), updated.id);
  return { order: toPublicOrder(updated, items, shop.name), notification };
}

export async function merchantOverview(ownerUserId: string) {
  const shop = await requireOwnedShop(ownerUserId);
  const stats = await shopOrderStats(getPool(), shop.id);
  const products = await listProductsByShop(getPool(), shop.id);
  const recentOrders = (await listOrdersByShop(getPool(), shop.id)).slice(0, 6);
  const withItems = [];
  for (const order of recentOrders) {
    const items = await listOrderItems(getPool(), order.id);
    withItems.push(toPublicOrder(order, items, shop.name));
  }
  const published = products.filter((p) => p.status === "published").length;
  const lowStock = products.filter((p) => p.kind === "product" && p.qty_available <= 3 && p.status !== "archived").length;
  return {
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
    },
    salesKobo: stats.revenueKobo,
    orders: stats.orderCount,
    paidOrders: stats.paidCount,
    products: products.length,
    published,
    lowStock,
    recentOrders: withItems,
  };
}

export async function merchantCustomers(ownerUserId: string) {
  const shop = await requireOwnedShop(ownerUserId);
  return listCustomers(getPool(), shop.id);
}
