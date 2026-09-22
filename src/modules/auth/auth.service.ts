import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { getPool } from "../../db/pool.js";
import { conflict, unauthorized } from "../../shared/errors.js";
import { isUniqueViolation } from "../../shared/pg.js";
import { ansaIdFromUserId } from "../identity/index.js";
import {
  findUserByEmail,
  findUserByEmailOrPhone,
  findUserById,
  findUserByPhone,
  insertUser,
  toPublicUser,
  type PublicUser,
} from "../users/index.js";
import {
  findActiveRefreshToken,
  hashRefreshToken,
  insertRefreshToken,
  newRefreshToken,
  revokeRefreshToken,
} from "./auth.repository.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthResult = {
  user: PublicUser & { ansaId: string };
  tokens: AuthTokens;
};

function parseDurationMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Unsupported TTL format: ${ttl}`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const ms = multipliers[unit];
  if (ms === undefined) {
    throw new Error(`Unsupported TTL format: ${ttl}`);
  }
  return value * ms;
}

function signAccessToken(userId: string): string {
  const { JWT_ACCESS_SECRET, JWT_ACCESS_TTL } = env();
  return jwt.sign({ typ: "access" }, JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, env().JWT_ACCESS_SECRET) as jwt.JwtPayload;
    if (payload.typ !== "access" || !payload.sub) {
      throw unauthorized("Invalid access token");
    }
    return payload.sub;
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      throw unauthorized("Invalid or expired access token");
    }
    throw err;
  }
}

async function issueTokens(userId: string): Promise<AuthTokens> {
  const { JWT_REFRESH_TTL, JWT_ACCESS_TTL } = env();
  const refreshToken = newRefreshToken();
  const expiresAt = new Date(Date.now() + parseDurationMs(JWT_REFRESH_TTL));
  await insertRefreshToken(getPool(), {
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt,
  });
  return {
    accessToken: signAccessToken(userId),
    refreshToken,
    expiresIn: JWT_ACCESS_TTL,
  };
}

function withAnsaId(user: PublicUser): PublicUser & { ansaId: string } {
  return { ...user, ansaId: ansaIdFromUserId(user.id) };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const db = getPool();
  const email = input.email ?? null;
  const phone = input.phone ?? null;

  if (email && (await findUserByEmail(db, email))) {
    throw conflict("An account with this email already exists");
  }
  if (phone && (await findUserByPhone(db, phone))) {
    throw conflict("An account with this phone already exists");
  }

  const passwordHash = await hashPassword(input.password);
  let row;
  try {
    row = await insertUser(db, { email, phone, passwordHash });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict("An account with this email or phone already exists");
    }
    throw err;
  }
  const tokens = await issueTokens(row.id);
  return { user: withAnsaId(toPublicUser(row)), tokens };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const db = getPool();
  const row = await findUserByEmailOrPhone(db, { email: input.email, phone: input.phone });
  if (!row) {
    throw unauthorized("Invalid credentials");
  }
  const ok = await verifyPassword(input.password, row.password_hash);
  if (!ok) {
    throw unauthorized("Invalid credentials");
  }
  const tokens = await issueTokens(row.id);
  return { user: withAnsaId(toPublicUser(row)), tokens };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const db = getPool();
  const tokenHash = hashRefreshToken(refreshToken);
  const existing = await findActiveRefreshToken(db, tokenHash);
  if (!existing) {
    throw unauthorized("Invalid refresh token");
  }
  await revokeRefreshToken(db, tokenHash);
  return issueTokens(existing.user_id);
}

export async function logout(refreshToken: string): Promise<void> {
  await revokeRefreshToken(getPool(), hashRefreshToken(refreshToken));
}

export async function getMe(userId: string): Promise<PublicUser & { ansaId: string }> {
  const row = await findUserById(getPool(), userId);
  if (!row) {
    throw unauthorized();
  }
  return withAnsaId(toPublicUser(row));
}
