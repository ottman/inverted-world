"use client"

import { useState } from "react"

// POSTs to /api/checkout and redirects to Stripe. While Stripe isn't configured the route returns
// 503 and we show a "coming soon" state instead of erroring.
export function UpgradeButton() {
  const [state, setState] = useState<"idle" | "loading" | "soon" | "error">("idle")

  const go = async () => {
    setState("loading")
    try {
      const res = await fetch("/api/checkout", { method: "POST" })
      if (res.status === 503) return setState("soon")
      if (!res.ok) return setState("error")
      const data = (await res.json()) as { url?: string }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setState("error")
    } catch {
      setState("error")
    }
  }

  if (state === "soon") {
    return <p className="iw-serif text-lg text-[#f4efe2]/70">Memberships open soon — check back shortly.</p>
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={go}
        disabled={state === "loading"}
        className="iw-serif bg-[#df2f2f] px-7 py-3 text-xl text-[#fff8e6] transition hover:bg-[#df2f2f]/85 disabled:opacity-60"
      >
        {state === "loading" ? "One moment…" : "Become a member"}
      </button>
      {state === "error" ? <p className="text-sm text-[#df2f2f]">Something went wrong — try again.</p> : null}
    </div>
  )
}
