import { describe, expect, it } from 'vitest';

import {
  deletionBlocker,
  DISPLAY_NAME_MAX,
  parseDisplayName,
  storeSubscriptionsToCancel,
} from './account';

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

describe('a display name', () => {
  it('is kept, tidied', () => {
    expect(parseDisplayName('  María   José  ')).toEqual({ ok: true, name: 'María José' });
    expect(parseDisplayName('李小龙')).toEqual({ ok: true, name: '李小龙' });
    expect(parseDisplayName('Ana\nBcc: x')).toEqual({ ok: true, name: 'Ana Bcc: x' });
    expect(parseDisplayName('Ana 2')).toEqual({ ok: true, name: 'Ana 2' });
  });

  it('can be taken away', () => {
    expect(parseDisplayName('')).toEqual({ ok: true, name: null });
    expect(parseDisplayName('   ')).toEqual({ ok: true, name: null });
  });

  it('is refused when it is too long or is not text', () => {
    expect(parseDisplayName('a'.repeat(DISPLAY_NAME_MAX))).toEqual({
      ok: true,
      name: 'a'.repeat(DISPLAY_NAME_MAX),
    });
    expect(parseDisplayName('a'.repeat(DISPLAY_NAME_MAX + 1))).toEqual({ ok: false });
    expect(parseDisplayName(undefined)).toEqual({ ok: false });
    expect(parseDisplayName(42)).toEqual({ ok: false });
  });

  it('may not carry a link, an address or a phone number', () => {
    for (const name of [
      'Visit https://spam.example',
      'www.spam.example',
      'spam.example/offer',
      'write to me@example.test',
      '<b>Ana</b>',
      'Call 5551234567',
    ]) {
      expect(parseDisplayName(name), name).toEqual({ ok: false });
    }
  });
});
