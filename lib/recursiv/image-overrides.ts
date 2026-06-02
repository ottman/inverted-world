import { aiThumbnailImage, type RightsClearedImage } from "@/lib/openverse"

// Hand-curated, per-story image overrides — the highest-accuracy layer. Keyword scoring (Openverse)
// gets the picture in the right ballpark, but for specific high-visibility stories where the best
// match is a particular photo (or where a precise generated scene beats anything on Openverse) we pin
// it here. Applied with top priority by the re-image job, so a correction lands without a code change
// to the selection logic. Two shapes per uri:
//   { imageUrl }  — a specific rights-cleared photo URL (with optional license/attribution)
//   { aiPrompt }  — a precise scene to generate (on-topic, photorealistic) when no good photo exists
type ImageOverride =
  | { imageUrl: string; license?: string; attribution?: string; sourceUrl?: string }
  | { aiPrompt: string }

const OVERRIDES: Record<string, ImageOverride> = {
  // Mothman — prefer a precise, atmospheric scene of the actual reported sighting (a winged figure
  // with red eyes over the Point Pleasant TNT-area igloos) over a stock cryptid drawing / movie poster.
  "tale-mothman-point-pleasant": {
    aiPrompt:
      "A tall winged humanoid figure with glowing red eyes standing in fog near abandoned WWII concrete munition igloos in a wooded West Virginia clearing at dusk, eerie, ominous",
  },
}

// The curated image for a story, or null if none is pinned. Returns a `trusted` image so callers can
// treat it as the final answer.
export function imageOverrideFor(uri: string): RightsClearedImage | null {
  const override = OVERRIDES[uri]
  if (!override) return null
  if ("imageUrl" in override && override.imageUrl) {
    return {
      url: override.imageUrl,
      license: override.license || "curated",
      attribution: override.attribution,
      sourceUrl: override.sourceUrl,
      relevance: 100,
      trusted: true,
    }
  }
  if ("aiPrompt" in override && override.aiPrompt) {
    return aiThumbnailImage(override.aiPrompt)
  }
  return null
}

export function hasImageOverride(uri: string): boolean {
  return Boolean(OVERRIDES[uri])
}
