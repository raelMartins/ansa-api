import type { Queryable } from "../../db/pool.js";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed";
export type Fulfilment = "pickup" | "delivery";

export type OrderRow = {
  id: string;
  merchant_id: string;
  reference: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  fulfilment: Fulfilment;
  delivery_address: string | null;
  delivery_instructions: string | null;
  delivery_fee_kobo: number;
  subtotal_kobo: number;
  total_kobo: number;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  payment_provider: string;
  payment_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  title: string;
  kind: "product" | "service";
  quantity: number;
  unit_price_kobo: number;
};

const ORDER_COLS = `id, merchant_id, reference, customer_name, customer_phone, customer_email, fulfilment,
  delivery_address, delivery_instructions, delivery_fee_kobo, subtotal_kobo, total_kobo, payment_status,
  order_status, payment_provider, payment_id, created_at, updated_at`;

export async function insertOrder(
  db: Queryable,
  input: {
    merchantId: string;
    reference: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    fulfilment: Fulfilment;
    deliveryAddress: string | null;
    deliveryInstructions: string | null;
    deliveryFeeKobo: number;
    subtotalKobo: number;
    totalKobo: number;
    paymentStatus: PaymentStatus;
    orderStatus: OrderStatus;
    paymentProvider: string;
  },
): Promise<OrderRow> {
  const { rows } = await db.query<OrderRow>(
    `INSERT INTO merchant_orders (
       merchant_id, reference, customer_name, customer_phone, customer_email, fulfilment,
       delivery_address, delivery_instructions, delivery_fee_kobo, subtotal_kobo, total_kobo,
       payment_status, order_status, payment_provider
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING ${ORDER_COLS}`,
    [
      input.merchantId,
      input.reference,
      input.customerName,
      input.customerPhone,
      input.customerEmail,
      input.fulfilment,
      input.deliveryAddress,
      input.deliveryInstructions,
      input.deliveryFeeKobo,
      input.subtotalKobo,
      input.totalKobo,
      input.paymentStatus,
      input.orderStatus,
      input.paymentProvider,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("insertOrder returned no row");
  return row;
}

export async function insertOrderItem(
  db: Queryable,
  input: {
    orderId: string;
    productId: string | null;
    title: string;
    kind: "product" | "service";
    quantity: number;
    unitPriceKobo: number;
  },
): Promise<OrderItemRow> {
  const { rows } = await db.query<OrderItemRow>(
    `INSERT INTO merchant_order_items (order_id, product_id, title, kind, quantity, unit_price_kobo)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, order_id, product_id, title, kind, quantity, unit_price_kobo`,
    [input.orderId, input.productId, input.title, input.kind, input.quantity, input.unitPriceKobo],
  );
  const row = rows[0];
  if (!row) throw new Error("insertOrderItem returned no row");
  return row;
}

export async function findOrderById(db: Queryable, id: string): Promise<OrderRow | undefined> {
  const { rows } = await db.query<OrderRow>(`SELECT ${ORDER_COLS} FROM merchant_orders WHERE id = $1`, [id]);
  return rows[0];
}

export async function findOrderByReference(db: Queryable, reference: string): Promise<OrderRow | undefined> {
  const { rows } = await db.query<OrderRow>(`SELECT ${ORDER_COLS} FROM merchant_orders WHERE reference = $1`, [
    reference,
  ]);
  return rows[0];
}

export async function listOrdersByMerchant(db: Queryable, merchantId: string): Promise<OrderRow[]> {
  const { rows } = await db.query<OrderRow>(
    `SELECT ${ORDER_COLS} FROM merchant_orders WHERE merchant_id = $1 ORDER BY created_at DESC`,
    [merchantId],
  );
  return rows;
}

export async function listOrderItems(db: Queryable, orderId: string): Promise<OrderItemRow[]> {
  const { rows } = await db.query<OrderItemRow>(
    `SELECT id, order_id, product_id, title, kind, quantity, unit_price_kobo
     FROM merchant_order_items WHERE order_id = $1`,
    [orderId],
  );
  return rows;
}

export async function updateOrderPayment(
  db: Queryable,
  orderId: string,
  patch: { paymentStatus: PaymentStatus; orderStatus?: OrderStatus; paymentId?: string; paymentProvider?: string },
): Promise<OrderRow> {
  const { rows } = await db.query<OrderRow>(
    `UPDATE merchant_orders
     SET payment_status = $2,
         order_status = COALESCE($3, order_status),
         payment_id = COALESCE($4, payment_id),
         payment_provider = COALESCE($5, payment_provider),
         updated_at = now()
     WHERE id = $1
     RETURNING ${ORDER_COLS}`,
    [orderId, patch.paymentStatus, patch.orderStatus ?? null, patch.paymentId ?? null, patch.paymentProvider ?? null],
  );
  const row = rows[0];
  if (!row) throw new Error("updateOrderPayment returned no row");
  return row;
}

export async function updateOrderStatus(db: Queryable, orderId: string, status: OrderStatus): Promise<OrderRow> {
  const { rows } = await db.query<OrderRow>(
    `UPDATE merchant_orders SET order_status = $2, updated_at = now() WHERE id = $1 RETURNING ${ORDER_COLS}`,
    [orderId, status],
  );
  const row = rows[0];
  if (!row) throw new Error("updateOrderStatus returned no row");
  return row;
}

export async function insertPayment(
  db: Queryable,
  input: {
    orderId: string;
    provider: string;
    status: PaymentStatus;
    amountKobo: number;
    idempotencyKey: string;
    providerReference?: string | null;
    simulated: boolean;
  },
) {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO merchant_payments (order_id, provider, status, amount_kobo, idempotency_key, provider_reference, simulated)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [
      input.orderId,
      input.provider,
      input.status,
      input.amountKobo,
      input.idempotencyKey,
      input.providerReference ?? null,
      input.simulated,
    ],
  );
  return rows[0]!.id;
}

export async function markPaymentPaid(db: Queryable, orderId: string): Promise<void> {
  await db.query(`UPDATE merchant_payments SET status = 'paid', updated_at = now() WHERE order_id = $1`, [orderId]);
}

export async function merchantOrderStats(db: Queryable, merchantId: string) {
  const { rows } = await db.query<{
    order_count: string;
    paid_count: string;
    revenue_kobo: string;
  }>(
    `SELECT
       COUNT(*)::text AS order_count,
       COUNT(*) FILTER (WHERE payment_status = 'paid')::text AS paid_count,
       COALESCE(SUM(total_kobo) FILTER (WHERE payment_status = 'paid'), 0)::text AS revenue_kobo
     FROM merchant_orders WHERE merchant_id = $1`,
    [merchantId],
  );
  const row = rows[0]!;
  return {
    orderCount: Number(row.order_count),
    paidCount: Number(row.paid_count),
    revenueKobo: Number(row.revenue_kobo),
  };
}

export async function merchantDashboardMetrics(db: Queryable, merchantId: string) {
  const { rows } = await db.query<{
    sales_month_kobo: string;
    sales_prev_month_kobo: string;
    sold_orders_month: string;
    to_fulfill: string;
    ready_for_pickup: string;
    customer_count: string;
    new_customers_month: string;
  }>(
    `SELECT
       COALESCE(SUM(total_kobo) FILTER (
         WHERE payment_status = 'paid'
           AND created_at >= date_trunc('month', timezone('UTC', now()))
       ), 0)::text AS sales_month_kobo,
       COALESCE(SUM(total_kobo) FILTER (
         WHERE payment_status = 'paid'
           AND created_at >= date_trunc('month', timezone('UTC', now()) - interval '1 month')
           AND created_at < date_trunc('month', timezone('UTC', now()))
       ), 0)::text AS sales_prev_month_kobo,
       COUNT(*) FILTER (
         WHERE payment_status = 'paid'
           AND created_at >= date_trunc('month', timezone('UTC', now()))
       )::text AS sold_orders_month,
       COUNT(*) FILTER (
         WHERE payment_status = 'paid'
           AND order_status IN ('pending', 'confirmed', 'processing')
       )::text AS to_fulfill,
       COUNT(*) FILTER (WHERE order_status = 'ready')::text AS ready_for_pickup,
       COUNT(DISTINCT customer_phone)::text AS customer_count,
       COUNT(DISTINCT customer_phone) FILTER (
         WHERE created_at >= date_trunc('month', timezone('UTC', now()))
       )::text AS new_customers_month
     FROM merchant_orders
     WHERE merchant_id = $1`,
    [merchantId],
  );
  const row = rows[0]!;
  return {
    salesMonthKobo: Number(row.sales_month_kobo),
    salesPrevMonthKobo: Number(row.sales_prev_month_kobo),
    soldOrdersMonth: Number(row.sold_orders_month),
    toFulfill: Number(row.to_fulfill),
    readyForPickup: Number(row.ready_for_pickup),
    customerCount: Number(row.customer_count),
    newCustomersMonth: Number(row.new_customers_month),
  };
}

const customerIdentitySql = `customer_name = $2 AND customer_phone = $3 AND customer_email IS NOT DISTINCT FROM $4`;

export async function listCustomers(db: Queryable, merchantId: string) {
  const { rows } = await db.query<{
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    orders: string;
    paid_orders: string;
    spent_kobo: string;
    first_order: Date;
    last_order: Date;
  }>(
    `SELECT customer_name, customer_phone, customer_email,
            COUNT(*)::text AS orders,
            COUNT(*) FILTER (WHERE payment_status = 'paid')::text AS paid_orders,
            COALESCE(SUM(total_kobo) FILTER (WHERE payment_status = 'paid'), 0)::text AS spent_kobo,
            MIN(created_at) AS first_order,
            MAX(created_at) AS last_order
     FROM merchant_orders
     WHERE merchant_id = $1
     GROUP BY customer_name, customer_phone, customer_email
     ORDER BY last_order DESC`,
    [merchantId],
  );
  return rows.map((r) => ({
    name: r.customer_name,
    phone: r.customer_phone,
    email: r.customer_email,
    orders: Number(r.orders),
    paidOrders: Number(r.paid_orders),
    spentKobo: Number(r.spent_kobo),
    firstOrderAt: r.first_order.toISOString(),
    lastOrderAt: r.last_order.toISOString(),
  }));
}

export type CustomerIdentityInput = {
  name: string;
  phone: string;
  email: string | null;
};

export async function findCustomerAggregate(db: Queryable, merchantId: string, identity: CustomerIdentityInput) {
  const { rows } = await db.query<{
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    orders: string;
    paid_orders: string;
    spent_kobo: string;
    first_order: Date;
    last_order: Date;
    latest_delivery_address: string | null;
  }>(
    `SELECT customer_name, customer_phone, customer_email,
            COUNT(*)::text AS orders,
            COUNT(*) FILTER (WHERE payment_status = 'paid')::text AS paid_orders,
            COALESCE(SUM(total_kobo) FILTER (WHERE payment_status = 'paid'), 0)::text AS spent_kobo,
            MIN(created_at) AS first_order,
            MAX(created_at) AS last_order,
            (
              SELECT delivery_address FROM merchant_orders o2
              WHERE o2.merchant_id = $1
                AND o2.customer_name = merchant_orders.customer_name
                AND o2.customer_phone = merchant_orders.customer_phone
                AND o2.customer_email IS NOT DISTINCT FROM merchant_orders.customer_email
                AND o2.delivery_address IS NOT NULL
                AND TRIM(o2.delivery_address) <> ''
              ORDER BY o2.created_at DESC
              LIMIT 1
            ) AS latest_delivery_address
     FROM merchant_orders
     WHERE merchant_id = $1 AND ${customerIdentitySql}
     GROUP BY customer_name, customer_phone, customer_email`,
    [merchantId, identity.name, identity.phone, identity.email],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    name: r.customer_name,
    phone: r.customer_phone,
    email: r.customer_email,
    orders: Number(r.orders),
    paidOrders: Number(r.paid_orders),
    spentKobo: Number(r.spent_kobo),
    firstOrderAt: r.first_order.toISOString(),
    lastOrderAt: r.last_order.toISOString(),
    latestDeliveryAddress: r.latest_delivery_address,
  };
}

export async function listOrdersForCustomer(db: Queryable, merchantId: string, identity: CustomerIdentityInput) {
  const { rows } = await db.query<OrderRow>(
    `SELECT * FROM merchant_orders
     WHERE merchant_id = $1 AND ${customerIdentitySql}
     ORDER BY created_at DESC
     LIMIT 100`,
    [merchantId, identity.name, identity.phone, identity.email],
  );
  return rows;
}
