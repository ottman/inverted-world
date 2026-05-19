import { featuredVideos, researchDocuments, topics } from "@/data/inverted-world"

export type IntelligenceArticle = {
  id: string
  title: string
  deck: string
  topicId: string
  topic: string
  publishedAt: string
  heat: number
  source: string
  sourceUrl: string
  thumbnail: {
    glyph: string
    sigil: string
    palette: string
  }
  body: string[]
  thumbnailPrompt: string
}

const lanes = [
  {
    topicId: "uap-disclosure",
    topic: "SKYWATCH",
    glyph: "AARO",
    sigil: "UAP-221",
    source: "AARO / NASA",
    sourceUrl: "https://www.aaro.mil/",
    hooks: [
      "retrieval-program briefings",
      "unidentified sensor tracks",
      "NASA language shifts",
      "classified chain-of-custody gaps",
      "witness testimony against denials",
    ],
  },
  {
    topicId: "secret-programs",
    topic: "BLACK VAULT",
    glyph: "FOIA",
    sigil: "MK-Δ",
    source: "CIA Reading Room",
    sourceUrl: "https://www.cia.gov/readingroom/",
    hooks: [
      "old programs with modern shadows",
      "psyops paperwork",
      "mind-control archives",
      "intelligence cutouts",
      "missing declassification trails",
    ],
  },
  {
    topicId: "epstein-networks",
    topic: "POWER WEB",
    glyph: "DOCKET",
    sigil: "E-172",
    source: "CourtListener",
    sourceUrl: "https://www.courtlistener.com/",
    hooks: [
      "sealed names",
      "institutional protection",
      "travel-log anomalies",
      "financial connective tissue",
      "court record blind spots",
    ],
  },
  {
    topicId: "cryptids-paranormal",
    topic: "HIGH STRANGENESS",
    glyph: "SIGHT",
    sigil: "CR-08",
    source: "Local archives",
    sourceUrl: "https://archive.org/",
    hooks: [
      "witness clusters",
      "folklore that refuses to die",
      "field reports",
      "paranormal pattern drift",
      "sightings with mundane counterreads",
    ],
  },
  {
    topicId: "ai-technocracy",
    topic: "MACHINE STATE",
    glyph: "AI",
    sigil: "PAL",
    source: "NIST / Federal Register",
    sourceUrl: "https://www.nist.gov/itl/ai-risk-management-framework",
    hooks: [
      "data-center buildouts",
      "surveillance governance",
      "autonomous enforcement",
      "model risk policy",
      "synthetic-media control loops",
    ],
  },
  {
    topicId: "space-anomalies",
    topic: "OFF-WORLD",
    glyph: "NASA",
    sigil: "SOL",
    source: "NASA / NOAA",
    sourceUrl: "https://ntrs.nasa.gov/",
    hooks: [
      "space-weather disruption",
      "instrument anomalies",
      "meteor events",
      "Mars and lunar weirdness",
      "satellite failure stories",
    ],
  },
  {
    topicId: "secret-programs",
    topic: "BIO VAULT",
    glyph: "LAB",
    sigil: "CV-19",
    source: "NIH / Congress",
    sourceUrl: "https://www.nih.gov/",
    hooks: [
      "origin disputes",
      "research funding chains",
      "redacted grants",
      "public-health narrative reversals",
      "laboratory oversight gaps",
    ],
  },
  {
    topicId: "ai-technocracy",
    topic: "HIDDEN GRID",
    glyph: "NODE",
    sigil: "DC-24",
    source: "Federal Register",
    sourceUrl: "https://www.federalregister.gov/",
    hooks: [
      "floating data centers",
      "energy demand shock",
      "offshore jurisdiction",
      "private cloud sovereignty",
      "infrastructure no one voted for",
    ],
  },
  {
    topicId: "epstein-networks",
    topic: "POWER WEB",
    glyph: "MAP",
    sigil: "NET",
    source: "Open records",
    sourceUrl: "https://www.documentcloud.org/",
    hooks: [
      "philanthropy as access",
      "private-island logistics",
      "NGO overlap",
      "media silence patterns",
      "names that appear in too many places",
    ],
  },
  {
    topicId: "uap-disclosure",
    topic: "SKYWATCH",
    glyph: "FILE",
    sigil: "UFO",
    source: "Congress / AARO",
    sourceUrl: "https://www.congress.gov/",
    hooks: [
      "legislative pressure",
      "contractor carveouts",
      "whistleblower protection",
      "retrieval rumors",
      "official phrasing changes",
    ],
  },
]

const frames = [
  "What changed in the last 72 hours",
  "The document trail",
  "The strongest skeptical read",
  "The weird read that still fits",
  "Who benefits if this is ignored",
  "The source map",
  "The missing records",
  "The timeline nobody has cleaned up",
  "The agency language shift",
  "The media framing split",
]

const thumbnailPalettes = [
  "from-[#050504] via-[#21180d] to-[#e8b45c]",
  "from-[#050504] via-[#141d20] to-[#7dd3fc]",
  "from-[#050504] via-[#1c1020] to-[#d8b4fe]",
  "from-[#050504] via-[#102017] to-[#8ee6a8]",
  "from-[#050504] via-[#230b0b] to-[#e53935]",
]

function pickVideo(topicId: string, index: number) {
  const matches = featuredVideos.filter((video) => video.topicId === topicId)
  return matches[index % Math.max(matches.length, 1)]
}

function pickDocument(topicId: string, index: number) {
  const matches = researchDocuments.filter((doc) => doc.topicIds.includes(topicId))
  return matches[index % Math.max(matches.length, 1)]
}

export const intelligenceArticles: IntelligenceArticle[] = Array.from({ length: 100 }, (_, index) => {
  const lane = lanes[index % lanes.length]
  const frame = frames[Math.floor(index / lanes.length) % frames.length]
  const hook = lane.hooks[index % lane.hooks.length]
  const topic = topics.find((item) => item.id === lane.topicId)
  const video = pickVideo(lane.topicId, index)
  const doc = pickDocument(lane.topicId, index)
  const source = doc?.source || lane.source
  const sourceUrl = doc?.url || lane.sourceUrl
  const day = 18 - (index % 9)
  const publishedAt = `2026-05-${String(Math.max(day, 1)).padStart(2, "0")}`
  const heat = 99 - (index % 40)
  const title = `${lane.topic}: ${frame}`
  const deck = `${hook}. ${source} is the first stop; ${video?.title || "the archive"} is the media hook.`

  return {
    id: `iw-${String(index + 1).padStart(3, "0")}`,
    title,
    deck,
    topicId: lane.topicId,
    topic: lane.topic,
    publishedAt,
    heat,
    source,
    sourceUrl,
    thumbnail: {
      glyph: lane.glyph,
      sigil: lane.sigil,
      palette: thumbnailPalettes[index % thumbnailPalettes.length],
    },
    body: [
      `Signal: ${hook}. The live question is whether the visible record changed, or whether the narrative around it changed.`,
      `Record: start with ${source}, then cross-check the channel archive item "${video?.title || "the archive"}" for the media angle that made this worth watching.`,
      `Weird read: ${frame.toLowerCase()} may point to a hidden system, a protected actor, or a missing document trail.`,
      `Skeptical read: weak sourcing, old material resurfacing, agency ambiguity, or audience incentives may explain the heat.`,
      topic?.stance || "Separate what is documented, what is alleged, and what is still missing.",
      `Next search: ${topic?.query || lane.topic} site:.gov OR filetype:pdf; then compare coverage across hostile, mainstream, and primary-source lanes.`,
    ],
    thumbnailPrompt:
      `AI thumbnail prompt: ${lane.topic} conspiracy intelligence cover, amber-black terminal grid, ${lane.glyph} sigil, archival paper texture, ` +
      "cinematic mystery lighting, no faces, no photoreal claims, no fake documents, Inverted World style.",
  }
})
