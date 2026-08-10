import { incrementQuotaUsed } from './db';

/**
 * Atomically increment the org's quota usage counter.
 * Called at the end of a completed run (not per step, per full run).
 */
export async function incrementQuota(orgId: string, amount = 1): Promise<void> {
  for (let i = 0; i < amount; i++) {
    await incrementQuotaUsed(orgId);
  }
}
