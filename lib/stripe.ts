import Stripe from "stripe";

// Lazily instantiate the Stripe client so a missing STRIPE_SECRET_KEY does not
// crash the whole module at import time — instead the caller gets a clear error.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Stripe is not configured on the server (missing STRIPE_SECRET_KEY). Set the live secret key in the server environment."
    );
  }
  if (!_stripe) {
    _stripe = new Stripe(key, {
      // @ts-ignore - pinned account API version
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return _stripe;
}

// Backwards-compatible proxy: existing `import { stripe }` call sites keep
// working, but the real client is only built on first property access.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    const client = getStripe();
    // @ts-ignore
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;
