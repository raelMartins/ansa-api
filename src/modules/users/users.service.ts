import type { Queryable } from "../../db/pool.js";
import { notFound } from "../../shared/errors.js";
import {
  findUserByEmail,
  findUserByEmailOrPhone,
  findUserById,
  findUserByPhone,
  insertUser,
  type UserRow,
} from "./users.repository.js";

export type PublicUser = {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

/** Account record for auth. Other product modules should use PublicUser, not this. */
export type UserAccount = {
  id: string;
  email: string | null;
  phone: string | null;
  passwordHash: string;
  createdAt: Date;
};

function toAccount(row: UserRow): UserAccount {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export function toPublicUser(row: UserRow | UserAccount): PublicUser {
  if ("passwordHash" in row) {
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      createdAt: row.createdAt.toISOString(),
    };
  }
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

export async function createUserAccount(
  db: Queryable,
  input: { email: string | null; phone: string | null; passwordHash: string },
): Promise<UserAccount> {
  return toAccount(await insertUser(db, input));
}

export async function findAccountByEmail(db: Queryable, email: string): Promise<UserAccount | undefined> {
  const row = await findUserByEmail(db, email);
  return row ? toAccount(row) : undefined;
}

export async function findAccountByPhone(db: Queryable, phone: string): Promise<UserAccount | undefined> {
  const row = await findUserByPhone(db, phone);
  return row ? toAccount(row) : undefined;
}

export async function findAccountByEmailOrPhone(
  db: Queryable,
  identifier: { email?: string; phone?: string },
): Promise<UserAccount | undefined> {
  const row = await findUserByEmailOrPhone(db, identifier);
  return row ? toAccount(row) : undefined;
}

export async function findAccountById(db: Queryable, id: string): Promise<UserAccount | undefined> {
  const row = await findUserById(db, id);
  return row ? toAccount(row) : undefined;
}
