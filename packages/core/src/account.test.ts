import { describe, expect, it } from 'vitest';

import { deletionBlocker, storeSubscriptionsToCancel } from './account';

describe('deletionBlocker', () => {
  it('lets a learner with nothing shared delete their account', () => {
    expect(deletionBlocker({ verifiedContent: 0, ownedOrganizations: [] })).toBeNull();
  });

  it('lets an owner go when their organization is empty and unpaid: it goes with them', () => {
    expect(
      deletionBlocker({
        verifiedContent: 0,
        ownedOrganizations: [{ otherMembers: 0, hasSeats: false }],
      }),
    ).toBeNull();
  });

  it('stops an owner whose organization has people in it, or seats being paid for', () => {
    expect(
      deletionBlocker({
        verifiedContent: 0,
        ownedOrganizations: [
          { otherMembers: 0, hasSeats: false },
          { otherMembers: 3, hasSeats: false },
        ],
      }),
    ).toBe('organization');
    expect(
      deletionBlocker({
        verifiedContent: 0,
        ownedOrganizations: [{ otherMembers: 0, hasSeats: true }],
      }),
    ).toBe('organization');
  });

  it('stops a reviewer: what they verified keeps its record', () => {
    expect(deletionBlocker({ verifiedContent: 12, ownedOrganizations: [] })).toBe('staff');
    // Whichever else applies, this is the one to say.
    expect(
      deletionBlocker({
        verifiedContent: 1,
        ownedOrganizations: [{ otherMembers: 5, hasSeats: true }],
      }),
    ).toBe('staff');
  });
});

describe('storeSubscriptionsToCancel', () => {
  it('names the stores where a subscription will keep renewing', () => {
    expect(
      storeSubscriptionsToCancel([
        { provider: 'play_store', plan: 'pro_monthly', renews: true },
        { provider: 'app_store', plan: 'pro_yearly', renews: true },
        { provider: 'app_store', plan: 'pro_monthly', renews: true },
      ]),
    ).toEqual(['app_store', 'play_store']);
  });

  it('leaves out what does not renew, and what the server can cancel itself', () => {
    expect(
      storeSubscriptionsToCancel([
        { provider: 'app_store', plan: 'country_pass', renews: false },
        { provider: 'app_store', plan: 'pro_monthly', renews: false },
        { provider: 'stripe', plan: 'pro_monthly', renews: true },
        { provider: 'manual', plan: 'team', renews: true },
      ]),
    ).toEqual([]);
    expect(storeSubscriptionsToCancel([])).toEqual([]);
  });
});
