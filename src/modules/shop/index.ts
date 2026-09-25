/**
 * shop — merchant catalog (v1 slice).
 * Owns `shops` and `products`. Does not touch payments or delivery tables.
 */
export { merchantShopRouter } from "./shop.merchant.routes.js";
export { publicShopRouter } from "./shop.public.routes.js";
