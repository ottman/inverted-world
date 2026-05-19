import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string
    mode?: "login" | "signup"
  }
  const email = body.email?.trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 })
  }

  if (process.env.AUTH_WEBHOOK_URL) {
    await fetch(process.env.AUTH_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        mode: body.mode || "signup",
        product: "inverted-world",
        createdAt: new Date().toISOString(),
      }),
    }).catch(() => null)
  }

  return NextResponse.json({
    ok: true,
    mode: body.mode || "signup",
    message: body.mode === "login" ? "Desk unlocked." : "You are in.",
    member: {
      email,
      role: "researcher",
      product: "inverted-world",
    },
  })
}
