import type { PaidPlan } from '@oathly/core';

// The browser build has no app store, so nothing can be bought in it. Plans
// bought elsewhere still show, because access is read from the server.
// Same interface as purchases.ts.

export interface StoreOffer {
  productId: string;
  plan: PaidPlan;
  countryCode: string | null;
  price: string;
  buy: () => Promise<boolean>;
}

export const purchases = {
  available: false,
  offers: (_userId: string): Promise<StoreOffer[]> => Promise.resolve([]),
  restore: (_userId: string): Promise<void> => Promise.resolve(),
  manageUrl: (_userId: string): Promise<string | null> => Promise.resolve(null),
  forget: (): Promise<void> => Promise.resolve(),
};
