// Google AdSense config. Ads stay completely OFF (no script, no slots, no ads.txt) until you set
// NEXT_PUBLIC_ADSENSE_CLIENT to your AdSense publisher id (e.g. "ca-pub-1234567890123456").
// Add per-placement slot ids from the AdSense dashboard where <AdUnit slot="..." /> is used.
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || ""

export function adsEnabled(): boolean {
  return /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT)
}
