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
  videoId?: string
  embedUrl?: string
  thumbnail?: string
  description?: string
  kind?: "episode" | "short"
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
  youtubeUploadsPlaylistId: "UU7qGeFv85Oyct3xlKq-pedw",
  youtubeUploadsEmbedUrl:
    "https://www.youtube.com/embed/videoseries?list=UU7qGeFv85Oyct3xlKq-pedw&rel=0",
  youtubeRssUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC7qGeFv85Oyct3xlKq-pedw",
  timcastChannelId: "ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
  timcastArchiveUrl: "https://timcast.com/channel/ef7a7c4c-d491-11ed-9f19-b07b25f8c291",
  operatingLine:
    "An evidence-first research room for the strange, unexplained, classified, misreported, and not-yet-understood.",
  archiveCountLabel: "Full YouTube uploads playlist plus 860+ Timcast archive videos",
}

export const topics: ContentTopic[] = [
  {
    id: "uap-disclosure",
    title: "Skywatch",
    signal: "Pentagon files, NASA panels, anomalous aerospace claims",
    query: '"UAP" OR "UFO" Pentagon NASA disclosure AARO',
    stance: "Treat witness testimony as a lead, official denials as evidence, and missing records as a research object.",
    documents: ["AARO public releases", "NASA UAP Independent Study", "Congressional hearing records"],
  },
  {
    id: "secret-programs",
    title: "Declassified",
    signal: "FOIA, intelligence history, mind-control and black-budget claims",
    query: '"MKULTRA" OR "CIA" "FOIA" "declassified" "secret program"',
    stance: "Separate proven historical programs from speculative continuity claims.",
    documents: ["CIA Reading Room", "National Security Archive", "FBI Vault"],
  },
  {
    id: "epstein-networks",
    title: "Power Web",
    signal: "Court records, travel logs, institutional ties, unresolved names",
    query: '"Jeffrey Epstein" court records documents network',
    stance: "Use court filings and primary records before narratives. Flag allegations, sealed gaps, and confirmed facts separately.",
    documents: ["CourtListener", "DOJ releases", "Federal court dockets"],
  },
  {
    id: "cryptids-paranormal",
    title: "High Strangeness",
    signal: "Bigfoot, ghosts, caller reports, folklore, field records",
    query: '"cryptid" OR "Bigfoot" OR "paranormal" sightings research',
    stance: "Respect witnesses, preserve context, and avoid upgrading anecdote into proof.",
    documents: ["Local archives", "State historical societies", "Folklore databases"],
  },
  {
    id: "ai-technocracy",
    title: "Machine State",
    signal: "AI control systems, surveillance, synthetic media, autonomous governance",
    query: '"AI" surveillance autonomous systems governance technocracy',
    stance: "Track what is deployed, what is proposed, and what is feared as three different lanes.",
    documents: ["NIST AI RMF", "Executive orders", "Congressional reports"],
  },
  {
    id: "space-anomalies",
    title: "Off-World Signals",
    signal: "NASA, meteor events, Mars rocks, solar storms, lost satellites",
    query: 'NASA anomaly meteor solar storm Mars "space weather"',
    stance: "Start from instrument data, then compare official interpretation against independent analysis.",
    documents: ["NASA NTRS", "NOAA SWPC", "NASA Exoplanet Archive"],
  },
]

export const universalTopic: ContentTopic = {
  id: "all",
  title: "The Inverted Index",
  signal: "Conspiracies, paranormal events, hidden networks, anomalous science, and the unanswered edges of reality",
  query:
    '("UAP" OR "UFO" OR "MKULTRA" OR "Jeffrey Epstein" OR "cryptid" OR "paranormal" OR "AI surveillance" OR "NASA anomaly" OR "classified program")',
  stance:
    "Start from records, respect anomalies, separate proof from possibility, and keep the door open where the record is incomplete.",
  documents: [
    "government records",
    "court dockets",
    "declassified archives",
    "science datasets",
    "cross-outlet news coverage",
  ],
}

export const truthSearchQuery = universalTopic.query

export const featuredVideos: ChannelVideo[] = [
  {
    title: "TRUMP BRIEFED ON UFO RETRIEVAL PROGRAM",
    date: "2026-05-18",
    href: "https://www.youtube.com/watch?v=N1t2XSzrnfk",
    topicId: "uap-disclosure",
    source: "YouTube",
    videoId: "N1t2XSzrnfk",
    embedUrl: "https://www.youtube.com/embed/N1t2XSzrnfk?rel=0",
    thumbnail: "https://i3.ytimg.com/vi/N1t2XSzrnfk/hqdefault.jpg",
    kind: "episode",
  },
  {
    title: "BERMUDA TRIANGLE MYSTERY SOLVED",
    date: "2026-05-18",
    href: "https://www.youtube.com/watch?v=buV734vffR0",
    topicId: "space-anomalies",
    source: "YouTube",
    videoId: "buV734vffR0",
    embedUrl: "https://www.youtube.com/embed/buV734vffR0?rel=0",
    thumbnail: "https://i3.ytimg.com/vi/buV734vffR0/hqdefault.jpg",
    kind: "episode",
  },
  {
    title: "COVID COVERUP",
    date: "2026-05-18",
    href: "https://www.youtube.com/watch?v=8cSaStj158I",
    topicId: "secret-programs",
    source: "YouTube",
    videoId: "8cSaStj158I",
    embedUrl: "https://www.youtube.com/embed/8cSaStj158I?rel=0",
    thumbnail: "https://i1.ytimg.com/vi/8cSaStj158I/hqdefault.jpg",
    kind: "episode",
  },
  {
    title: "APOCALYPTIC",
    date: "2026-05-18",
    href: "https://www.youtube.com/watch?v=ApaRfQOuUO4",
    topicId: "cryptids-paranormal",
    source: "YouTube",
    videoId: "ApaRfQOuUO4",
    embedUrl: "https://www.youtube.com/embed/ApaRfQOuUO4?rel=0",
    thumbnail: "https://i2.ytimg.com/vi/ApaRfQOuUO4/hqdefault.jpg",
    kind: "episode",
  },
  {
    title: "THERES NO TREAM IN POLITICS #shorts",
    date: "2026-05-16",
    href: "https://www.youtube.com/shorts/3WyKJa_F_Wg",
    topicId: "ai-technocracy",
    source: "YouTube",
    videoId: "3WyKJa_F_Wg",
    embedUrl: "https://www.youtube.com/embed/3WyKJa_F_Wg?rel=0",
    thumbnail: "https://i4.ytimg.com/vi/3WyKJa_F_Wg/hqdefault.jpg",
    kind: "short",
  },
  {
    title: "FEEDING INTO THE HYSTERIA #shorts",
    date: "2026-05-15",
    href: "https://www.youtube.com/shorts/BxI3cT1k45w",
    topicId: "secret-programs",
    source: "YouTube",
    videoId: "BxI3cT1k45w",
    embedUrl: "https://www.youtube.com/embed/BxI3cT1k45w?rel=0",
    thumbnail: "https://i3.ytimg.com/vi/BxI3cT1k45w/hqdefault.jpg",
    kind: "short",
  },
  {
    title: "THEY WANT YOU TO FEEL INSANE",
    date: "2026-05-15",
    href: "https://www.youtube.com/watch?v=oiMLnd_4aHY",
    topicId: "secret-programs",
    source: "YouTube",
    videoId: "oiMLnd_4aHY",
    embedUrl: "https://www.youtube.com/embed/oiMLnd_4aHY?rel=0",
    thumbnail: "https://i4.ytimg.com/vi/oiMLnd_4aHY/hqdefault.jpg",
    kind: "episode",
  },
  {
    title: "Data Centers HERE, Data Centers THERE, Data Centers EVERYWHERE #shorts",
    date: "2026-05-14",
    href: "https://www.youtube.com/shorts/f_bplTaaDJQ",
    topicId: "ai-technocracy",
    source: "YouTube",
    videoId: "f_bplTaaDJQ",
    embedUrl: "https://www.youtube.com/embed/f_bplTaaDJQ?rel=0",
    thumbnail: "https://i3.ytimg.com/vi/f_bplTaaDJQ/hqdefault.jpg",
    kind: "short",
  },
  {
    title: "BERMUDA TRIANGLE & FLOATING DATA CENTERS",
    date: "2026-05-14",
    href: "https://www.youtube.com/watch?v=D2-R8FERWoM",
    topicId: "ai-technocracy",
    source: "YouTube",
    videoId: "D2-R8FERWoM",
    embedUrl: "https://www.youtube.com/embed/D2-R8FERWoM?rel=0",
    thumbnail: "https://i1.ytimg.com/vi/D2-R8FERWoM/hqdefault.jpg",
    kind: "episode",
  },
  {
    title: "THE ERA OF THE CONSPIRACY THEORIST #shorts",
    date: "2026-05-13",
    href: "https://www.youtube.com/shorts/czJEpZvDJ3A",
    topicId: "secret-programs",
    source: "YouTube",
    videoId: "czJEpZvDJ3A",
    embedUrl: "https://www.youtube.com/embed/czJEpZvDJ3A?rel=0",
    thumbnail: "https://i4.ytimg.com/vi/czJEpZvDJ3A/hqdefault.jpg",
    kind: "short",
  },
  {
    title: "LUNA PLANNING MKULTRA HEARING",
    date: "2026-05-13",
    href: "https://www.youtube.com/watch?v=5v5RPBw7oos",
    topicId: "secret-programs",
    source: "YouTube",
    videoId: "5v5RPBw7oos",
    embedUrl: "https://www.youtube.com/embed/5v5RPBw7oos?rel=0",
    thumbnail: "https://i2.ytimg.com/vi/5v5RPBw7oos/hqdefault.jpg",
    kind: "episode",
  },
  {
    title: "DISTRACTION AFTER DISTRACTION #shorts",
    date: "2026-05-12",
    href: "https://www.youtube.com/shorts/cLgGJWS6abM",
    topicId: "secret-programs",
    source: "YouTube",
    videoId: "cLgGJWS6abM",
    embedUrl: "https://www.youtube.com/embed/cLgGJWS6abM?rel=0",
    thumbnail: "https://i4.ytimg.com/vi/cLgGJWS6abM/hqdefault.jpg",
    kind: "short",
  },
  {
    title: "4-FOOT-BEINGS IN UFO FILES ARE NOT KEVIN HART",
    date: "2026-05-12",
    href: "https://www.youtube.com/watch?v=Jn4SAKfonCQ",
    topicId: "uap-disclosure",
    source: "YouTube",
    videoId: "Jn4SAKfonCQ",
    embedUrl: "https://www.youtube.com/embed/Jn4SAKfonCQ?rel=0",
    thumbnail: "https://i3.ytimg.com/vi/Jn4SAKfonCQ/hqdefault.jpg",
    kind: "episode",
  },
  {
    title: "The Note Epstein Left Behind",
    date: "2026-05-11",
    href: "https://www.youtube.com/watch?v=gBH6UjvSXnQ",
    topicId: "epstein-networks",
    source: "YouTube",
    videoId: "gBH6UjvSXnQ",
    embedUrl: "https://www.youtube.com/embed/gBH6UjvSXnQ?rel=0",
    thumbnail: "https://i4.ytimg.com/vi/gBH6UjvSXnQ/hqdefault.jpg",
    kind: "episode",
  },
  {
    title: "BABA VANGA'S 2026 PREDICTIONS",
    date: "2026-05-11",
    href: "https://www.youtube.com/watch?v=k27iBDWl0DI",
    topicId: "cryptids-paranormal",
    source: "YouTube",
    videoId: "k27iBDWl0DI",
    embedUrl: "https://www.youtube.com/embed/k27iBDWl0DI?rel=0",
    thumbnail: "https://i4.ytimg.com/vi/k27iBDWl0DI/hqdefault.jpg",
    kind: "episode",
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
    title: "ODNI UAP and national intelligence report library",
    source: "ODNI",
    url: "https://www.dni.gov/index.php/newsroom/reports-publications",
    kind: "government",
    topicIds: ["uap-disclosure", "secret-programs"],
  },
  {
    title: "Congress.gov UAP search",
    source: "Congress.gov",
    url: "https://www.congress.gov/search?q=%7B%22search%22%3A%22UAP%22%7D",
    kind: "government",
    topicIds: ["uap-disclosure", "secret-programs"],
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
    title: "CIA Reading Room MKULTRA search",
    source: "CIA",
    url: "https://www.cia.gov/readingroom/search/site/MKULTRA",
    kind: "archive",
    topicIds: ["secret-programs"],
  },
  {
    title: "The FBI Vault",
    source: "FBI",
    url: "https://vault.fbi.gov/",
    kind: "archive",
    topicIds: ["secret-programs", "epstein-networks"],
  },
  {
    title: "FBI Vault Jeffrey Epstein files",
    source: "FBI",
    url: "https://vault.fbi.gov/jeffrey-epstein",
    kind: "archive",
    topicIds: ["epstein-networks"],
  },
  {
    title: "FOIA.gov request and agency records portal",
    source: "FOIA.gov",
    url: "https://www.foia.gov/",
    kind: "government",
    topicIds: ["secret-programs", "epstein-networks", "ai-technocracy"],
  },
  {
    title: "National Security Archive declassified collections",
    source: "National Security Archive",
    url: "https://nsarchive.gwu.edu/",
    kind: "archive",
    topicIds: ["secret-programs", "uap-disclosure"],
  },
  {
    title: "National Archives research catalog",
    source: "National Archives",
    url: "https://catalog.archives.gov/",
    kind: "archive",
    topicIds: ["secret-programs", "uap-disclosure", "space-anomalies"],
  },
  {
    title: "GovInfo congressional and federal records",
    source: "GovInfo",
    url: "https://www.govinfo.gov/",
    kind: "government",
    topicIds: ["secret-programs", "ai-technocracy", "uap-disclosure"],
  },
  {
    title: "MuckRock FOIA archive",
    source: "MuckRock",
    url: "https://www.muckrock.com/foi/",
    kind: "archive",
    topicIds: ["secret-programs", "epstein-networks", "ai-technocracy"],
  },
  {
    title: "Federal Register document search",
    source: "National Archives",
    url: "https://www.federalregister.gov/",
    kind: "government",
    topicIds: ["ai-technocracy", "secret-programs", "space-anomalies"],
  },
  {
    title: "Regulations.gov public docket search",
    source: "Regulations.gov",
    url: "https://www.regulations.gov/",
    kind: "government",
    topicIds: ["ai-technocracy", "secret-programs"],
  },
  {
    title: "CourtListener opinion and docket search",
    source: "Free Law Project",
    url: "https://www.courtlistener.com/",
    kind: "legal",
    topicIds: ["epstein-networks", "secret-programs"],
  },
  {
    title: "PACER federal court records",
    source: "U.S. Courts",
    url: "https://pacer.uscourts.gov/",
    kind: "legal",
    topicIds: ["epstein-networks", "secret-programs"],
  },
  {
    title: "Southern District of New York public releases",
    source: "DOJ SDNY",
    url: "https://www.justice.gov/usao-sdny",
    kind: "legal",
    topicIds: ["epstein-networks", "secret-programs"],
  },
  {
    title: "DOJ FOIA reference guide",
    source: "DOJ",
    url: "https://www.justice.gov/oip/doj-reference-guide",
    kind: "government",
    topicIds: ["epstein-networks", "secret-programs"],
  },
  {
    title: "SEC EDGAR company and institution filings",
    source: "SEC",
    url: "https://www.sec.gov/edgar/search/",
    kind: "legal",
    topicIds: ["epstein-networks", "ai-technocracy"],
  },
  {
    title: "NIST AI Risk Management Framework",
    source: "NIST",
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
    kind: "government",
    topicIds: ["ai-technocracy"],
  },
  {
    title: "CISA artificial intelligence security resources",
    source: "CISA",
    url: "https://www.cisa.gov/ai",
    kind: "government",
    topicIds: ["ai-technocracy"],
  },
  {
    title: "NIST publications search",
    source: "NIST",
    url: "https://www.nist.gov/publications",
    kind: "science",
    topicIds: ["ai-technocracy", "secret-programs"],
  },
  {
    title: "NIH PubMed biomedical literature",
    source: "NIH",
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    kind: "science",
    topicIds: ["secret-programs", "ai-technocracy"],
  },
  {
    title: "NASA Technical Reports Server",
    source: "NASA",
    url: "https://ntrs.nasa.gov/",
    kind: "science",
    topicIds: ["space-anomalies", "ai-technocracy"],
  },
  {
    title: "NASA ADS astrophysics literature",
    source: "NASA ADS",
    url: "https://ui.adsabs.harvard.edu/",
    kind: "science",
    topicIds: ["space-anomalies"],
  },
  {
    title: "NASA Center for Near Earth Object Studies fireball data",
    source: "NASA CNEOS",
    url: "https://cneos.jpl.nasa.gov/fireballs/",
    kind: "science",
    topicIds: ["space-anomalies"],
  },
  {
    title: "NASA Exoplanet Archive",
    source: "NASA",
    url: "https://exoplanetarchive.ipac.caltech.edu/",
    kind: "science",
    topicIds: ["space-anomalies"],
  },
  {
    title: "NOAA Space Weather Prediction Center",
    source: "NOAA",
    url: "https://www.swpc.noaa.gov/",
    kind: "science",
    topicIds: ["space-anomalies"],
  },
  {
    title: "USGS earthquake and hazard data",
    source: "USGS",
    url: "https://earthquake.usgs.gov/",
    kind: "science",
    topicIds: ["space-anomalies"],
  },
  {
    title: "Library of Congress Folklife collections",
    source: "Library of Congress",
    url: "https://www.loc.gov/folklife/",
    kind: "archive",
    topicIds: ["cryptids-paranormal"],
  },
  {
    title: "Smithsonian collections search",
    source: "Smithsonian",
    url: "https://www.si.edu/search/collection-images",
    kind: "archive",
    topicIds: ["cryptids-paranormal", "space-anomalies"],
  },
  {
    title: "Internet Archive TV News Search",
    source: "Internet Archive",
    url: "https://archive.org/details/tv",
    kind: "news-index",
    topicIds: topics.map((topic) => topic.id),
  },
  {
    title: "Common Crawl open web corpus",
    source: "Common Crawl",
    url: "https://commoncrawl.org/",
    kind: "archive",
    topicIds: topics.map((topic) => topic.id),
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
  return topics.find((topic) => topic.id === topicId) ?? universalTopic
}

export function getDocumentsForTopic(topicId: string) {
  if (topicId === universalTopic.id) return researchDocuments
  return researchDocuments.filter((doc) => doc.topicIds.includes(topicId))
}

export function getVideosForTopic(topicId: string) {
  if (topicId === universalTopic.id) return featuredVideos
  return featuredVideos.filter((video) => video.topicId === topicId)
}
