// Deleting an account: what stands in the way, and what the learner has to
// be told first. The rules, not the deleting.

export const deletionBlockers = ['staff', 'organization'] as const;
export type DeletionBlocker = (typeof deletionBlockers)[number];

export interface DeletionFacts {
  /**
   * Questions or translations this account checked against a source and
   * published. Their record of who verified them has to stay.
   */
  verifiedContent: number;
  /** The organizations this account owns. */
  ownedOrganizations: readonly {
    /** Members other than the owner. */
    otherMembers: number;
    /** Whether seats are being paid for. */
    hasSeats: boolean;
  }[];
}

/**
 * Why an account cannot be deleted by its owner alone, or null when it can.
 *
 * A reviewer's account is tied to the content they verified. An organization
 * with people in it, or seats being paid for, is not one person's to remove:
 * it has to be handed over or closed first. An owner's empty organization
 * goes with them.
 */
export function deletionBlocker(facts: DeletionFacts): DeletionBlocker | null {
  if (facts.verifiedContent > 0) return 'staff';
  const shared = facts.ownedOrganizations.some(
    (organization) => organization.otherMembers > 0 || organization.hasSeats,
  );
  return shared ? 'organization' : null;
}

/** A purchase as account deletion sees it. */
export interface DeletionPurchase {
  provider: 'stripe' | 'app_store' | 'play_store' | 'manual';
  plan: string;
  /** Whether it will renew unless cancelled. */
  renews: boolean;
}

/**
 * Subscriptions the learner must cancel themselves, in their phone's store,
 * because nobody else can: deleting the account does not stop the store
 * charging for them.
 */
export function storeSubscriptionsToCancel(
  purchases: readonly DeletionPurchase[],
): ('app_store' | 'play_store')[] {
  const stores = new Set<'app_store' | 'play_store'>();
  for (const purchase of purchases) {
    if (!purchase.renews) continue;
    if (purchase.provider === 'app_store' || purchase.provider === 'play_store') {
      stores.add(purchase.provider);
    }
  }
  return [...stores].sort();
}
