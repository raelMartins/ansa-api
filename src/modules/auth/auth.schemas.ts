import { z } from "zod";

const email = z.string().trim().email().transform((v) => v.toLowerCase());
const phone = z.string().trim().min(8).max(20);
const password = z.string().min(8).max(128);

export const registerSchema = z
  .object({
    email: email.optional(),
    phone: phone.optional(),
    password,
  })
  .refine((v) => Boolean(v.email || v.phone), {
    message: "Provide email or phone",
    path: ["email"],
  });

export const loginSchema = z
  .object({
    email: email.optional(),
    phone: phone.optional(),
    password: z.string().min(1),
  })
  .refine((v) => Boolean(v.email || v.phone), {
    message: "Provide email or phone",
    path: ["email"],
  });

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
