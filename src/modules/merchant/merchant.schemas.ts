import { z } from "zod";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");

const mediaRef = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (u) => u.startsWith("http://") || u.startsWith("https://") || u.startsWith("/uploads/"),
    "Use an http(s) URL or an uploaded /uploads path",
  );

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const createMerchantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slug.optional(),
  description: z.string().trim().max(2000).optional(),
  category: optionalText(80),
  phone: optionalText(24),
  whatsapp: optionalText(24),
  location: optionalText(200),
  logoUrl: mediaRef.optional(),
  coverUrl: mediaRef.optional(),
  instagramHandle: optionalText(80),
  tiktokHandle: optionalText(80),
  xHandle: optionalText(80),
  onboardingCompleted: z.boolean().optional(),
});

export const updateMerchantSchema = createMerchantSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update",
  });

export const createProductSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  priceKobo: z.number().int().min(0).max(1_000_000_000),
  status: z.enum(["draft", "published"]).default("published"),
  slug: slug.optional(),
  imageUrls: z.array(mediaRef).max(8).optional(),
  kind: z.enum(["product", "service"]).optional(),
  compareAtKobo: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  qtyAvailable: z.number().int().min(0).max(1_000_000).optional(),
  sku: optionalText(64),
  category: optionalText(80),
  durationMinutes: z.number().int().min(5).max(1440).nullable().optional(),
  availabilityNote: optionalText(200),
});

export const updateProductSchema = createProductSchema
  .partial()
  .extend({
    status: z.enum(["draft", "published", "archived"]).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update",
  });

export const productIdParamSchema = z.object({
  productId: z.string().uuid(),
});

export const publicProductParamsSchema = z.object({
  merchantSlug: slug,
  productSlug: slug,
});

export const publicShopParamsSchema = z.object({
  merchantSlug: slug,
});

export const channelParamSchema = z.object({
  channel: z.enum(["whatsapp", "instagram", "tiktok", "x"]),
});

export const connectSchema = z.object({
  account: z.string().trim().max(80).optional(),
});

export const shareSchema = z.object({
  channel: z.enum(["whatsapp", "instagram", "tiktok", "x"]),
  caption: z.string().trim().max(2000).optional(),
});

export const whatsappSettingsSchema = z
  .object({
    shareCatalog: z.boolean().optional(),
    notifyMerchant: z.boolean().optional(),
    notifyCustomer: z.boolean().optional(),
    contactNumber: z.string().trim().max(24).nullable().optional(),
    templates: z.record(z.string().max(500)).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nothing to update" });

export const mediaSchema = z.object({
  dataUrl: z.string().min(20).max(6_000_000),
});
