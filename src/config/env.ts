import { z } from "zod";

const ttl = z.string().min(1);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: ttl.default("15m"),
  JWT_REFRESH_TTL: ttl.default("30d"),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:3000"),
});

export type Env = z.infer<typeof schema> & {
  corsOrigins: string[];
  isProduction: boolean;
};

let cached: Env | undefined;

function parse(raw: NodeJS.ProcessEnv): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }

  const data = parsed.data;
  if (data.NODE_ENV !== "test" && !data.DATABASE_URL) {
    throw new Error("Invalid environment: DATABASE_URL is required");
  }

  return {
    ...data,
    corsOrigins: data.CORS_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    isProduction: data.NODE_ENV === "production",
  };
}

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  cached = parse(raw);
  return cached;
}

export function env(): Env {
  if (!cached) {
    cached = parse(process.env);
  }
  return cached;
}

export function resetEnvForTests(): void {
  cached = undefined;
}
