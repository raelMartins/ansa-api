/**
 * users — account records.
 * Other modules must call this public surface, not query `users` directly.
 */
export { getPublicUserById, toPublicUser, type PublicUser } from "./users.service.js";
export {
  findUserByEmail,
  findUserByEmailOrPhone,
  findUserById,
  findUserByPhone,
  insertUser,
  type UserRow,
} from "./users.repository.js";
