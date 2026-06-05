import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, rateLimitResponse, requestClientId } from "@/lib/api-security"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Stripe Checkout entry point for "Inverted World+". INERT until the `stripe` package is installed
// and STRIPE_SECRET_KEY + STRIPE_PLUS_PRICE_ID are set (returns 503). Activation: see
// docs/stripe-setup.md — then uncomment the session-creation block below.
export async function POST(request: NextRequest) {
  const clientId = requestClientId(request)
  const rate = checkRateLimit(`checkout:${clientId}`, { max: 5, windowMs: 60_000 })
  if (!rate.ok) return rateLimitResponse(rate)

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PLUS_PRICE_ID) {
    return NextResponse.json({ error: "Membership checkout is not configured yet." }, { status: 503 })
  }

  // --- Activation (after `npm i stripe` + keys are set) -------------------------------------------
  // const Stripe = (await import("stripe")).default
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  // const origin = request.headers.get("origin") || "https://www.inverted.world"
  // const session = await stripe.checkout.sessions.create({
  //   mode: "subscription",
  //   line_items: [{ price: process.env.STRIPE_PLUS_PRICE_ID, quantity: 1 }],
  //   allow_promotion_codes: true,
  //   success_url: `${origin}/plus/success?session_id={CHECKOUT_SESSION_ID}`,
  //   cancel_url: `${origin}/plus`,
  // })
  // return NextResponse.json({ url: session.url })
  // -----------------------------------------------------------------------------------------------

  return NextResponse.json({ error: "Membership checkout is not configured yet." }, { status: 503 })
}
