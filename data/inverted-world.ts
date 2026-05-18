export type ContentTopic = {
  id: string
  title: string
  signal: string
  query: string
  stance: string
  documents: string[]
}

export type ChannelVideo = {
  title: string
  date: string
  href: string
  topicId: string
  source: "Timcast" | "YouTube"
}

export type ResearchDocument = {
  title: string
  source: string
  url: string
  kind: "government" | "science" | "archive" | "legal" | "news-index"
  topicIds: string[]
}

export type NewsCoverageItem = {
  title: string
  outlet: string
  url: string
  publishedAt?: string
  sourceCountry?: string
  lane: "news" | "official" | "science" | "archive"
}

export const socialLinks = [
  { label: "YouTube", href: "https://www.youtube.com/@TalesfromtheInvertedWorld" },
  { label: "Facebook", href: "https://www.facebook.com/invertedtales" },
  { label: "Instagram", href: "https://www.instagram.com/invertedtales" },
  { label: "X", href: "https://x.com/InvertedTales" },
  { label: "Shane Cashman", href: "https://x.com/ShaneCashman" },
] as const

export const channelProfile = {
  name: "Tales From the Inverted World",
  liveName: "Inverted World Live",
  youtubeHandle: "@TalesfromtheInvertedWorld",
  youtubeChannelId: "UC7qGeFv85Oyct3xlKq-pedw",
  timcastChannelId: "ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
  timcastArchiveUrl: "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
  operatingLine:
    "An evidence-first research room for the strange, unexplained, classified, misreported, and not-yet-understood.",
  archiveCountLabel: "860+ Timcast archive videos plus YouTube channel coverage",
}

export const topics: ContentTopic[] = [
  {
    id: "uap-disclosure",
    title: "UAP disclosure",
    signal: "Pentagon files, NASA panels, anomalous aerospace claims",
    query: '"UAP" OR "UFO" Pentagon NASA disclosure AARO',
    stance: "Treat witness testimony as a lead, official denials as evidence, and missing records as a research object.",
    documents: ["AARO public releases", "NASA UAP Independent Study", "Congressional hearing records"],
  },
  {
    id: "secret-programs",
    title: "Secret programs",
    signal: "FOIA, intelligence history, mind-control and black-budget claims",
    query: '"MKULTRA" OR "CIA" "FOIA" "declassified" "secret program"',
    stance: "Separate proven historical programs from speculative continuity claims.",
    documents: ["CIA Reading Room", "National Security Archive", "FBI Vault"],
  },
  {
    id: "epstein-networks",
    title: "Epstein networks",
    signal: "Court records, travel logs, institutional ties, unresolved names",
    query: '"Jeffrey Epstein" court records documents network',
    stance: "Use court filings and primary records before narratives. Flag allegations, sealed gaps, and confirmed facts separately.",
    documents: ["CourtListener", "DOJ releases", "Federal court dockets"],
  },
  {
    id: "cryptids-paranormal",
    title: "Cryptids and paranormal",
    signal: "Bigfoot, ghosts, caller reports, folklore, field records",
    query: '"cryptid" OR "Bigfoot" OR "paranormal" sightings research',
    stance: "Respect witnesses, preserve context, and avoid upgrading anecdote into proof.",
    documents: ["Local archives", "State historical societies", "Folklore databases"],
  },
  {
    id: "ai-technocracy",
    title: "AI and technocracy",
    signal: "AI control systems, surveillance, synthetic media, autonomous governance",
    query: '"AI" surveillance autonomous systems governance technocracy',
    stance: "Track what is deployed, what is proposed, and what is feared as three different lanes.",
    documents: ["NIST AI RMF", "Executive orders", "Congressional reports"],
  },
  {
    id: "space-anomalies",
    title: "Space anomalies",
    signal: "NASA, meteor events, Mars rocks, solar storms, lost satellites",
    query: 'NASA anomaly meteor solar storm Mars "space weather"',
    stance: "Start from instrument data, then compare official interpretation against independent analysis.",
    documents: ["NASA NTRS", "NOAA SWPC", "NASA Exoplanet Archive"],
  },
]

export const featuredVideos: ChannelVideo[] = [
  {
    title: "TRUMP BRIEFED ON UFO RETRIEVAL PROGRAM",
    date: "2026-05-18",
    href: "https://www.youtube.com/watch?v=N1t2XSzrnfk",
    topicId: "uap-disclosure",
    source: "YouTube",
  },
  {
    title: "UFO FILES IMMINENT",
    date: "2026-05-07",
    href: "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
    topicId: "uap-disclosure",
    source: "Timcast",
  },
  {
    title: "SASQUATCH 2028",
    date: "2026-05-06",
    href: "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
    topicId: "cryptids-paranormal",
    source: "Timcast",
  },
  {
    title: "EVERY DEATH IS UFO RELATED NOW",
    date: "2026-05-05",
    href: "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
    topicId: "uap-disclosure",
    source: "Timcast",
  },
  {
    title: "PALANTIR'S MANIFESTO",
    date: "2026-04-24",
    href: "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
    topicId: "ai-technocracy",
    source: "Timcast",
  },
  {
    title: "TENTH PERSON TIED TO AMERICA'S SPACE/NUCLEAR SECRETS DISAPPEARS | Ep. 203",
    date: "2026-04-15",
    href: "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
    topicId: "secret-programs",
    source: "Timcast",
  },
  {
    title: "Ancient Breakaway Civilizations",
    date: "2026-04-17",
    href: "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
    topicId: "space-anomalies",
    source: "Timcast",
  },
  {
    title: "Epstein Files Reveal Cannibalism, Mind Control, and Mosquito Drones | Ep. 172",
    date: "2026-02-13",
    href: "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
    topicId: "epstein-networks",
    source: "Timcast",
  },
  {
    title: "CIA's Satanic MindWar Exposed: Brain Parasites, Psyops, and J6 Feds | Ep. 158",
    date: "2026-01-08",
    href: "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
    topicId: "secret-programs",
    source: "Timcast",
  },
  {
    title: "NASA Hints at Life Beyond Earth | Ep. 150",
    date: "2025-12-04",
    href: "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
    topicId: "space-anomalies",
    source: "Timcast",
  },
]

export const researchDocuments: ResearchDocument[] = [
  {
    title: "All-domain Anomaly Resolution Office public reporting",
    source: "AARO",
    url: "https://www.aaro.mil/",
    kind: "government",
    topicIds: ["uap-disclosure"],
  },
  {
    title: "NASA UAP Independent Study",
    source: "NASA",
    url: "https://science.nasa.gov/uap/",
    kind: "government",
    topicIds: ["uap-disclosure", "space-anomalies"],
  },
  {
    title: "CIA CREST and Reading Room",
    source: "CIA",
    url: "https://www.cia.gov/readingroom/",
    kind: "archive",
    topicIds: ["secret-programs", "uap-disclosure"],
  },
  {
    title: "The FBI Vault",
    source: "FBI",
    url: "https://vault.fbi.gov/",
    kind: "archive",
    topicIds: ["secret-programs", "epstein-networks"],
  },
  {
    title: "Federal Register document search",
    source: "National Archives",
    url: "https://www.federalregister.gov/",
    kind: "government",
    topicIds: ["ai-technocracy", "secret-programs", "space-anomalies"],
  },
  {
    title: "CourtListener opinion and docket search",
    source: "Free Law Project",
    url: "https://www.courtlistener.com/",
    kind: "legal",
    topicIds: ["epstein-networks", "secret-programs"],
  },
  {
    title: "NASA Technical Reports Server",
    source: "NASA",
    url: "https://ntrs.nasa.gov/",
    kind: "science",
    topicIds: ["space-anomalies", "ai-technocracy"],
  },
  {
    title: "NOAA Space Weather Prediction Center",
    source: "NOAA",
    url: "https://www.swpc.noaa.gov/",
    kind: "science",
    topicIds: ["space-anomalies"],
  },
  {
    title: "GDELT global news index",
    source: "GDELT",
    url: "https://www.gdeltproject.org/",
    kind: "news-index",
    topicIds: topics.map((topic) => topic.id),
  },
]

export const fallbackCoverage: NewsCoverageItem[] = [
  {
    title: "Use GDELT to compare same-topic coverage across global outlets",
    outlet: "GDELT",
    url: "https://api.gdeltproject.org/api/v2/doc/doc",
    lane: "news",
  },
  {
    title: "Search Federal Register for official rulemaking and agency notices",
    outlet: "Federal Register",
    url: "https://www.federalregister.gov/developers/documentation/api/v1",
    lane: "official",
  },
  {
    title: "Pull science and aerospace material from NASA NTRS",
    outlet: "NASA",
    url: "https://ntrs.nasa.gov/",
    lane: "science",
  },
]

export function getTopic(topicId: string | null | undefined) {
  return topics.find((topic) => topic.id === topicId) ?? topics[0]
}

export function getDocumentsForTopic(topicId: string) {
  return researchDocuments.filter((doc) => doc.topicIds.includes(topicId))
}

export function getVideosForTopic(topicId: string) {
  return featuredVideos.filter((video) => video.topicId === topicId)
}
