import type { Queryable } from "../../db/pool.js";
import { notFound } from "../../shared/errors.js";
import { findUserById, type UserRow } from "./users.repository.js";

export type PublicUser = {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getPublicUserById(db: Queryable, id: string): Promise<PublicUser> {
  const row = await findUserById(db, id);
  if (!row) throw notFound("User not found");
  return toPublicUser(row);
}

export type { UserRow };
export { findUserByEmail, findUserByEmailOrPhone, findUserById, findUserByPhone, insertUser } from "./users.repository.js";
