import type { StripePlan } from "@better-auth/stripe"

export const STRIPE_PLANS: StripePlan[] = [
  {
    name: "basic",
    priceId: process.env.STRIPE_BASIC_PRICE_ID,
  },
  {
    name: "pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID,
  },
]
