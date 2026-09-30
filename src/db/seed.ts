/**
 * PROTOTYPE: development seed. Wipes shop/order data and recreates demo merchants.
 * Run: pnpm seed (after pnpm migrate). Never run against production.
 */
import "dotenv/config";
import { env } from "../config/env.js";
import { closePool, getPool } from "./pool.js";
import { hashPassword } from "../modules/auth/password.js";

const DEMO_PASSWORD = "password123";

type SeedItem = {
  title: string;
  slug: string;
  kind: "product" | "service";
  priceKobo: number;
  compareAtKobo?: number;
  qty: number;
  category: string;
  description: string;
  image: string;
  status?: "published" | "draft";
  durationMinutes?: number;
  availabilityNote?: string;
};

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=70`;

const merchants: {
  email: string;
  shop: {
    name: string;
    slug: string;
    description: string;
    category: string;
    phone: string;
    whatsapp: string;
    location: string;
    logo: string;
    cover: string;
    instagram: string;
    tiktok: string;
    x: string;
  };
  items: SeedItem[];
}[] = [
  {
    email: "zola@demo.ansa",
    shop: {
      name: "Zola Atelier",
      slug: "zola-atelier",
      description: "Contemporary Ankara, adire and hand-finished pieces made in Lagos. Delivery across Nigeria.",
      category: "Fashion",
      phone: "+2348031234567",
      whatsapp: "+2348031234567",
      location: "Yaba, Lagos",
      logo: img("photo-1524504388940-b1c1722653e1"),
      cover: img("photo-1509631179647-0177331693ae"),
      instagram: "zola.atelier",
      tiktok: "zolaatelier",
      x: "zolaatelier",
    },
    items: [
      {
        title: "Adire Wrap Dress",
        slug: "adire-wrap-dress",
        kind: "product",
        priceKobo: 4_250_000,
        compareAtKobo: 5_000_000,
        qty: 14,
        category: "Dresses",
        description: "Hand-dyed indigo adire, cut as a flowing wrap. Sizes 8–16. Cold hand wash.",
        image: img("photo-1515372039744-b8f02a3ae446"),
      },
      {
        title: "Lagos Leather Slides",
        slug: "lagos-leather-slides",
        kind: "product",
        priceKobo: 1_800_000,
        qty: 8,
        category: "Footwear",
        description: "Tan leather slides, hand-stitched in Aba. Soft footbed, made to last.",
        image: img("photo-1603487742131-4160ec999306"),
      },
      {
        title: "Oshodi Heavy Tee",
        slug: "oshodi-heavy-tee",
        kind: "product",
        priceKobo: 950_000,
        qty: 6,
        category: "Tops",
        description: "Heavyweight cotton tee with a small embroidered mark.",
        image: img("photo-1521572163474-6864f9cf17ab"),
        status: "draft",
      },
      {
        title: "Mini Gold Bracelet",
        slug: "mini-gold-bracelet",
        kind: "product",
        priceKobo: 1_240_000,
        qty: 32,
        category: "Accessories",
        description: "Delicate gold-plated chain bracelet. Gift-wrapped on request.",
        image: img("photo-1611591437281-460bfbe1220a"),
      },
      {
        title: "Woven Market Tote",
        slug: "woven-market-tote",
        kind: "product",
        priceKobo: 1_500_000,
        qty: 2,
        category: "Accessories",
        description: "Hand-woven raffia tote with leather handles.",
        image: img("photo-1590874103328-eac38a683ce7"),
      },
      {
        title: "Bespoke Fitting Session",
        slug: "bespoke-fitting-session",
        kind: "service",
        priceKobo: 1_000_000,
        qty: 0,
        category: "Services",
        description: "One-on-one measurement and style consultation at our Yaba studio. Fee is deducted from your order.",
        image: img("photo-1558769132-cb1aea458c5e"),
        durationMinutes: 45,
        availabilityNote: "Tue–Sat, 10am–5pm",
      },
    ],
  },
  {
    email: "mama@demo.ansa",
    shop: {
      name: "Mama Put Pantry",
      slug: "mama-put-pantry",
      description: "Small-batch pepper sauces, spice blends and weekend jollof trays from Ibadan.",
      category: "Food & drink",
      phone: "+2348051112222",
      whatsapp: "+2348051112222",
      location: "Bodija, Ibadan",
      logo: img("photo-1556910103-1c02745aae4d"),
      cover: img("photo-1604329760661-e71dc83f8f26"),
      instagram: "mamaputpantry",
      tiktok: "mamaputpantry",
      x: "mamaputpantry",
    },
    items: [
      {
        title: "Ata Dindin Pepper Sauce",
        slug: "ata-dindin-pepper-sauce",
        kind: "product",
        priceKobo: 450_000,
        qty: 40,
        category: "Sauces",
        description: "Fried pepper sauce, 350ml jar. Hot, smoky, keeps for 3 weeks refrigerated.",
        image: img("photo-1472476443507-c7a5948772fc"),
      },
      {
        title: "Suya Spice Blend",
        slug: "suya-spice-blend",
        kind: "product",
        priceKobo: 300_000,
        qty: 25,
        category: "Spices",
        description: "Yaji blend with groundnut, ginger and cayenne. 200g pouch.",
        image: img("photo-1596040033229-a9821ebd058d"),
      },
      {
        title: "Party Jollof Tray",
        slug: "party-jollof-tray",
        kind: "service",
        priceKobo: 2_800_000,
        qty: 0,
        category: "Catering",
        description: "Smoky party jollof for 10, with plantain and chicken. Order 48 hours ahead.",
        image: img("photo-1604329760661-e71dc83f8f26"),
        availabilityNote: "Fri–Sun pickup or Ibadan delivery",
      },
    ],
  },
];

const customers = [
  { name: "Amaka Obi", phone: "+2348092223333", email: "amaka@example.com" },
  { name: "Tunde Bakare", phone: "+2348024445555", email: "tunde@example.com" },
  { name: "Ifeoma Nwosu", phone: "+2348106667777", email: null },
  { name: "Kemi Adeyemi", phone: "+2347038889999", email: "kemi@example.com" },
];

const orderStatuses = ["delivered", "out_for_delivery", "processing", "confirmed", "pending", "cancelled"] as const;

async function main() {
  if (env().isProduction) throw new Error("Refusing to seed production");
  const db = getPool();
  const client = await db.connect();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  try {
    await client.query("BEGIN");
    await client.query(
      `TRUNCATE notification_events, merchant_payments, merchant_order_items, merchant_orders,
         catalog_publications, merchant_whatsapp_settings, merchant_integrations, products, merchants CASCADE`,
    );
    await client.query(`DELETE FROM users WHERE email LIKE '%@demo.ansa'`);

    for (const [mi, m] of merchants.entries()) {
      const user = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
        [m.email, passwordHash],
      );
      const s = m.shop;
      const shop = await client.query<{ id: string }>(
        `INSERT INTO merchants (owner_user_id, name, slug, description, category, phone, whatsapp, location,
           logo_url, cover_url, instagram_handle, tiktok_handle, x_handle, onboarding_completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now()) RETURNING id`,
        [user.rows[0]!.id, s.name, s.slug, s.description, s.category, s.phone, s.whatsapp, s.location,
          s.logo, s.cover, s.instagram, s.tiktok, s.x],
      );
      const merchantId = shop.rows[0]!.id;

      for (const channel of ["whatsapp", "instagram", "tiktok", "x"]) {
        const connected = channel === "whatsapp" || (mi === 0 && channel === "instagram");
        await client.query(
          `INSERT INTO merchant_integrations (merchant_id, channel, status, provider, external_account, connected_at)
           VALUES ($1,$2,$3,'mock',$4, CASE WHEN $5 THEN now() ELSE NULL END)`,
          [merchantId, channel, connected ? "connected" : "not_connected",
            connected ? (channel === "whatsapp" ? s.whatsapp : `@${s.instagram}`) : null, connected],
        );
      }
      await client.query(
        `INSERT INTO merchant_whatsapp_settings (merchant_id, contact_number) VALUES ($1, $2)`,
        [merchantId, s.whatsapp],
      );

      const productIds: { id: string; title: string; kind: "product" | "service"; price: number }[] = [];
      for (const [i, it] of m.items.entries()) {
        const p = await client.query<{ id: string }>(
          `INSERT INTO products (merchant_id, title, slug, description, price_kobo, compare_at_kobo, status, image_urls,
             kind, qty_available, category, duration_minutes, availability_note, sku, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now() - ($15 || ' hours')::interval)
           RETURNING id`,
          [merchantId, it.title, it.slug, it.description, it.priceKobo, it.compareAtKobo ?? null,
            it.status ?? "published", [it.image], it.kind, it.qty, it.category, it.durationMinutes ?? null,
            it.availabilityNote ?? null, it.kind === "product" ? `${s.slug.slice(0, 3).toUpperCase()}-${100 + i}` : null,
            String(i * 5)],
        );
        if ((it.status ?? "published") === "published") {
          productIds.push({ id: p.rows[0]!.id, title: it.title, kind: it.kind, price: it.priceKobo });
        }
      }

      const orderCount = mi === 0 ? 6 : 3;
      for (let o = 0; o < orderCount; o += 1) {
        const c = customers[(o + mi) % customers.length]!;
        const status = orderStatuses[o % orderStatuses.length]!;
        const paid = status !== "pending" && status !== "cancelled";
        const line = productIds[o % productIds.length]!;
        const qty = line.kind === "product" ? 1 + (o % 2) : 1;
        const delivery = o % 3 !== 2;
        const fee = delivery ? 250_000 : 0;
        const subtotal = line.price * qty;
        const ref = `ANSA-${(0xa10000 + mi * 4096 + o * 97).toString(16).toUpperCase().slice(-6)}`;
        const order = await client.query<{ id: string }>(
          `INSERT INTO merchant_orders (merchant_id, reference, customer_name, customer_phone, customer_email, fulfilment,
             delivery_address, delivery_fee_kobo, subtotal_kobo, total_kobo, payment_status, order_status,
             payment_provider, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'mock', now() - ($13 || ' hours')::interval)
           RETURNING id`,
          [merchantId, ref, c.name, c.phone, c.email, delivery ? "delivery" : "pickup",
            delivery ? "12 Admiralty Way, Lekki Phase 1, Lagos" : null, fee, subtotal, subtotal + fee,
            paid ? "paid" : "pending", status, String(o * 19 + 2)],
        );
        const orderId = order.rows[0]!.id;
        await client.query(
          `INSERT INTO merchant_order_items (order_id, product_id, title, kind, quantity, unit_price_kobo)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [orderId, line.id, line.title, line.kind, qty, line.price],
        );
        await client.query(
          `INSERT INTO merchant_payments (order_id, provider, status, amount_kobo, idempotency_key, simulated)
           VALUES ($1,'mock',$2,$3,$4,true)`,
          [orderId, paid ? "paid" : "pending", subtotal + fee, `pay:${orderId}`],
        );
        if (paid && line.kind === "product") {
          await client.query(
            `UPDATE products SET qty_sold = qty_sold + $2 WHERE id = $1`,
            [line.id, qty],
          );
          await client.query(
            `INSERT INTO notification_events (merchant_id, order_id, channel, template_key, status, provider, body, recipient, created_at)
             VALUES ($1,$2,'whatsapp','payment_confirmed','simulated','mock',$3,$4, now() - ($5 || ' hours')::interval)`,
            [merchantId, orderId, `Payment confirmed for ${ref}. Thank you, ${c.name}.`, c.phone, String(o * 19 + 1)],
          );
        }
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  console.log("\nSeeded demo data.");
  for (const m of merchants) {
    console.log(`  ${m.email} / ${DEMO_PASSWORD}  →  /shop/${m.shop.slug}`);
  }
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool();
  process.exit(1);
});
