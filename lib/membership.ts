import { cookies } from "next/headers"

// "Inverted World+" membership. MVP: a per-browser flag the Stripe Checkout success handler sets
// after a verified paid session. The site has no account system yet, so this is per-device only —
// upgrading to durable, cross-device entitlements needs login (see docs/stripe-setup.md).
export const MEMBERSHIP_COOKIE = "iw_plus"

export function membershipConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PLUS_PRICE_ID)
}

export async function isMember(): Promise<boolean> {
  try {
    return (await cookies()).get(MEMBERSHIP_COOKIE)?.value === "1"
  } catch {
    return false
  }
}
