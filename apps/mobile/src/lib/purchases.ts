import { planFromProductId } from '@oathly/api/billing';
import type { PaidPlan } from '@oathly/core';
import { Platform } from 'react-native';

import { revenueCatKeys } from './env';

// Buying plans in the app: App Store and Google Play purchases, through
// RevenueCat. The store takes the payment; RevenueCat tells our server
// (a webhook), and the server's subscriptions table is what the app reads
// access from. So nothing here decides what anyone may use: it only sells.
//
// (The browser build has no store: see purchases.web.ts.)

/** Something the store sells, with the store's own localised price. */
export interface StoreOffer {
  productId: string;
  plan: PaidPlan;
  /** For a Country Pass. */
  countryCode: string | null;
  /** As the store formats it for this customer: "$7.99", "7,99 €". */
  price: string;
  /** Opens the store's purchase sheet. False if the customer backed out. */
  buy: () => Promise<boolean>;
}

type Sdk = typeof import('react-native-purchases');

/**
 * RevenueCat's SDK, where the app was built with it and has a key for this
 * platform. It is a native module, so it is loaded with care: its absence
 * only means plans cannot be bought in this build.
 */
function loadSdk(): { purchases: Sdk['default']; key: string } | null {
  const key = Platform.OS === 'ios' ? revenueCatKeys.ios : revenueCatKeys.android;
  if (!key) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require('react-native-purchases') as Sdk;
    return { purchases: sdk.default, key };
  } catch {
    return null;
  }
}

const sdk = loadSdk();
let identified: string | null = null;

/**
 * Tells RevenueCat who is buying: the learner's Oathly id, which is how the
 * webhook knows whose purchase it is.
 */
async function identify(userId: string): Promise<void> {
  if (!sdk || identified === userId) return;
  if (identified === null) sdk.purchases.configure({ apiKey: sdk.key, appUserID: userId });
  else await sdk.purchases.logIn(userId);
  identified = userId;
}

export const purchases = {
  /** Whether plans can be bought in this build of the app. */
  available: sdk !== null,

  /** What the store has on sale, as plans. Empty when nothing can be bought here. */
  async offers(userId: string): Promise<StoreOffer[]> {
    if (!sdk) return [];
    await identify(userId);
    const offerings = await sdk.purchases.getOfferings();
    const offers = new Map<string, StoreOffer>();
    for (const offering of Object.values(offerings.all)) {
      for (const item of offering.availablePackages) {
        const product = planFromProductId(item.product.identifier);
        if (!product || offers.has(item.product.identifier)) continue;
        offers.set(item.product.identifier, {
          productId: item.product.identifier,
          ...product,
          price: item.product.priceString,
          buy: async () => {
            try {
              await sdk.purchases.purchasePackage(item);
              return true;
            } catch (error) {
              if ((error as { userCancelled?: boolean }).userCancelled) return false;
              throw error;
            }
          },
        });
      }
    }
    return [...offers.values()];
  },

  /** Brings back what this store account has already bought (a new phone, a reinstall). */
  async restore(userId: string): Promise<void> {
    if (!sdk) return;
    await identify(userId);
    await sdk.purchases.restorePurchases();
  },

  /** The store's page for changing or cancelling the subscription, if there is one. */
  async manageUrl(userId: string): Promise<string | null> {
    if (!sdk) return null;
    await identify(userId);
    return (await sdk.purchases.getCustomerInfo()).managementURL;
  },

  /** On sign-out: the next person to sign in is someone else to the store too. */
  async forget(): Promise<void> {
    if (!sdk || identified === null) return;
    identified = null;
    try {
      await sdk.purchases.logOut();
    } catch {
      // Already anonymous.
    }
  },
};
