import type { Queryable } from "../../db/pool.js";

export type UserRow = {
  id: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
};

export async function insertUser(
  db: Queryable,
  input: { email: string | null; phone: string | null; passwordHash: string },
): Promise<UserRow> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (email, phone, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, phone, password_hash, created_at, updated_at`,
    [input.email, input.phone, input.passwordHash],
  );
  const row = rows[0];
  if (!row) throw new Error("insertUser returned no row");
  return row;
}

export async function findUserByEmail(db: Queryable, email: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, phone, password_hash, created_at, updated_at FROM users WHERE email = $1`,
    [email],
  );
  return rows[0];
}

export async function findUserByPhone(db: Queryable, phone: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, phone, password_hash, created_at, updated_at FROM users WHERE phone = $1`,
    [phone],
  );
  return rows[0];
}

export async function findUserById(db: Queryable, id: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, phone, password_hash, created_at, updated_at FROM users WHERE id = $1`,
    [id],
  );
  return rows[0];
}

export async function findUserByEmailOrPhone(
  db: Queryable,
  identifier: { email?: string; phone?: string },
): Promise<UserRow | undefined> {
  if (identifier.email) return findUserByEmail(db, identifier.email);
  if (identifier.phone) return findUserByPhone(db, identifier.phone);
  return undefined;
}
