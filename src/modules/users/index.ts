/**
 * users — account records.
 * Other modules must use this public surface, not `users.repository`.
 */
export {
  createUserAccount,
  findAccountByEmail,
  findAccountByEmailOrPhone,
  findAccountById,
  findAccountByPhone,
  getPublicUserById,
  toPublicUser,
  type PublicUser,
  type UserAccount,
} from "./users.service.js";
