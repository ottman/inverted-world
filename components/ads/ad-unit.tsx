"use client"

import { useEffect, useRef } from "react"
import { ADSENSE_CLIENT, adsEnabled } from "@/lib/ads"

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

// A responsive AdSense unit in the site's dark frame. Renders NOTHING until NEXT_PUBLIC_ADSENSE_CLIENT
// is set (and later can be suppressed for Inverted World+ members). `slot` is the ad-unit id from the
// AdSense dashboard. Designed to drop into the feed / story pages without shifting layout when off.
export function AdUnit({ slot, className, label = true }: { slot: string; className?: string; label?: boolean }) {
  const pushed = useRef(false)
  useEffect(() => {
    if (!adsEnabled() || pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      /* AdSense not ready / blocked — ignore */
    }
  }, [])

  if (!adsEnabled() || !slot) return null

  return (
    <div className={"overflow-hidden border border-[#f4efe2]/10 bg-[#050504]/30 " + (className || "")}>
      {label ? (
        <p className="px-2 pt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#f4efe2]/35">Advertisement</p>
      ) : null}
      <ins
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
