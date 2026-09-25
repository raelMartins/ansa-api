import { z } from "zod";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");

export const createShopSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slug.optional(),
  description: z.string().trim().max(2000).optional(),
});

export const updateShopSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: slug.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.slug !== undefined || v.description !== undefined, {
    message: "Provide at least one field to update",
  });

export const createProductSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  priceKobo: z.number().int().min(0).max(1_000_000_000),
  status: z.enum(["draft", "published"]).default("published"),
  slug: slug.optional(),
});

export const updateProductSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    priceKobo: z.number().int().min(0).max(1_000_000_000).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    slug: slug.optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.priceKobo !== undefined ||
      v.status !== undefined ||
      v.slug !== undefined,
    { message: "Provide at least one field to update" },
  );

export const productIdParamSchema = z.object({
  productId: z.string().uuid(),
});

export const publicProductParamsSchema = z.object({
  shopSlug: slug,
  productSlug: slug,
});

export const publicShopParamsSchema = z.object({
  shopSlug: slug,
});
