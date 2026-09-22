/**
 * Payment/escrow orchestration shell.
 * ansa does not operate payment rails. No provider until the founder confirms.
 * All future money writes must be transactional, auditable, and idempotent.
 */
export const moduleName = "payments" as const;
