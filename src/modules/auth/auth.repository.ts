import { createHash, randomBytes } from "node:crypto";
import type { Queryable } from "../../db/pool.js";

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export async function insertRefreshToken(
  db: Queryable,
  input: { userId: string; tokenHash: string; expiresAt: Date },
): Promise<void> {
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [input.userId, input.tokenHash, input.expiresAt],
  );
}

export async function findActiveRefreshToken(
  db: Queryable,
  tokenHash: string,
): Promise<{ id: string; user_id: string; expires_at: Date } | undefined> {
  const { rows } = await db.query<{ id: string; user_id: string; expires_at: Date }>(
    `SELECT id, user_id, expires_at
     FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > now()`,
    [tokenHash],
  );
  return rows[0];
}

export async function revokeRefreshToken(db: Queryable, tokenHash: string): Promise<void> {
  await db.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [
    tokenHash,
  ]);
}

export async function revokeAllRefreshTokensForUser(db: Queryable, userId: string): Promise<void> {
  await db.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}
