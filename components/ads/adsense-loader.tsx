import Script from "next/script"
import { ADSENSE_CLIENT, adsEnabled } from "@/lib/ads"

// Loads the AdSense library once, only when a publisher id is configured. Off by default.
export function AdSenseLoader() {
  if (!adsEnabled()) return null
  return (
    <Script
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
    />
  )
}
