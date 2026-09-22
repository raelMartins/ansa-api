/**
 * identity / ansa ID
 * v1: the ansa ID is the user UUID. KYC/check stays in the check module later.
 */
export function ansaIdFromUserId(userId: string): string {
  return userId;
}
