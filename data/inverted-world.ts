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
  source: "YouTube"
  videoId?: string
  embedUrl?: string
  thumbnail?: string
  description?: string
  transcript?: string
  kind?: "episode" | "short"
}

export type ResearchDocument = {
  title: string
  source: string
  url: string
  kind: "government" | "science" | "archive" | "legal" | "news-index"
  topicIds: string[]
}

export type MediaLibraryItem = {
  id: string
  title: string
  source: string
  url: string
  kind: "video" | "document" | "image" | "audio" | "archive"
  viewer: "youtube" | "pdf" | "video" | "image" | "audio" | "link"
  topicIds: string[]
  summary: string
  publishedAt?: string
  embedUrl?: string
  thumbnailUrl?: string
  fileType?: string
  agency?: string
  collection?: string
  extraction?: {
    status: "indexed" | "extracted" | "needs-ocr"
    brief: string
    highlights: string[]
    sourceChain: Array<{
      label: string
      value: string
      url?: string
    }>
    researchQuestions: string[]
  }
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
  operatingLine:
    "An evidence-first research room for the strange, unexplained, classified, misreported, and not-yet-understood.",
  archiveCountLabel: "Full Tales From the Inverted World YouTube uploads playlist",
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
    signal: "Court records, elite access networks, blackmail claims, donor power, institutional capture",
    query:
      '"Jeffrey Epstein" OR Maxwell OR "client list" OR "blackmail network" OR "elite network" OR "institutional corruption" OR "donor class" OR WEF OR Davos court records documents',
    stance: "Use court filings and primary records before narratives. Flag allegations, sealed gaps, and confirmed facts separately.",
    documents: ["CourtListener", "DOJ releases", "Federal court dockets", "SEC and nonprofit filings"],
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
    topicId: "epstein-networks",
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
    title: "The Note Epstein Left Behind #shorts",
    date: "2026-05-08",
    href: "https://www.youtube.com/shorts/-5b5DSUTAZg",
    topicId: "epstein-networks",
    source: "YouTube",
    videoId: "-5b5DSUTAZg",
    embedUrl: "https://www.youtube.com/embed/-5b5DSUTAZg?rel=0",
    thumbnail: "https://i.ytimg.com/vi/-5b5DSUTAZg/hqdefault.jpg",
    kind: "short",
  },
  {
    title: "Zorro Ranch Murders and Clavicular Absconds to Epstein Island | Ep. 211",
    date: "2026-04-29",
    href: "https://www.youtube.com/watch?v=p-mB7J32RzI",
    topicId: "epstein-networks",
    source: "YouTube",
    videoId: "p-mB7J32RzI",
    embedUrl: "https://www.youtube.com/embed/p-mB7J32RzI?rel=0",
    thumbnail: "https://i.ytimg.com/vi/p-mB7J32RzI/hqdefault.jpg",
    kind: "episode",
  },
  {
    title: "Evil Worms Its Way into EVERY Institution #shorts",
    date: "2026-04-16",
    href: "https://www.youtube.com/shorts/7ONgJMfIeT0",
    topicId: "epstein-networks",
    source: "YouTube",
    videoId: "7ONgJMfIeT0",
    embedUrl: "https://www.youtube.com/embed/7ONgJMfIeT0?rel=0",
    thumbnail: "https://i.ytimg.com/vi/7ONgJMfIeT0/hqdefault.jpg",
    kind: "short",
  },
  {
    title: "Are We Still Talking About Jeffrey Epstein? #shorts",
    date: "2026-04-03",
    href: "https://www.youtube.com/shorts/YRj1xgYHG9A",
    topicId: "epstein-networks",
    source: "YouTube",
    videoId: "YRj1xgYHG9A",
    embedUrl: "https://www.youtube.com/embed/YRj1xgYHG9A?rel=0",
    thumbnail: "https://i.ytimg.com/vi/YRj1xgYHG9A/hqdefault.jpg",
    kind: "short",
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
]

export const researchDocuments: ResearchDocument[] = [
  {
    title: "PURSUE Release 02 senior U.S. intelligence officer UAP narrative",
    source: "Department of War / ODNI",
    url: "https://www.war.gov/medialink/ufo/052226/release_02/documents/ODNI-UAP-D001_USPER_Narrative_Senior_USIC.pdf",
    kind: "government",
    topicIds: ["uap-disclosure", "secret-programs"],
  },
  {
    title: "PURSUE Release 02 UAP media and documents",
    source: "Department of War",
    url: "https://www.war.gov/UFO/?releaseDate=Release+02",
    kind: "government",
    topicIds: ["uap-disclosure", "secret-programs"],
  },
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

export const curatedMediaItems: MediaLibraryItem[] = [
  {
    id: "war-uap-release-02-senior-usic-narrative",
    title: "Senior U.S. intelligence officer UAP narrative",
    source: "Department of War / ODNI",
    url: "https://www.war.gov/medialink/ufo/052226/release_02/documents/ODNI-UAP-D001_USPER_Narrative_Senior_USIC.pdf",
    kind: "document",
    viewer: "pdf",
    topicIds: ["uap-disclosure", "secret-programs"],
    summary:
      "A primary-source UAP release document from the official Release 02 media package, ready to read inline beside related Inverted World coverage.",
    publishedAt: "2026-05-22",
    fileType: "PDF",
    agency: "ODNI",
    collection: "PURSUE Release 02",
    extraction: {
      status: "indexed",
      brief:
        "Official UAP release document from the second PURSUE tranche. Treat it as a primary-source anchor: read the original file first, then connect any claims to the release hub, ODNI attribution, dates, and related Tales coverage.",
      highlights: [
        "Release 02 was published on May 22, 2026 as part of PURSUE, the government-wide UAP release effort.",
        "The item is attributed to Department of War / ODNI and sits in the official Release 02 document package.",
        "The filename marks it as an ODNI UAP document tied to a senior U.S. intelligence community narrative.",
        "Use this document to separate what the source record says from secondhand social-media claims about the release.",
      ],
      sourceChain: [
        {
          label: "Release hub",
          value: "Department of War PURSUE Release 02",
          url: "https://www.war.gov/UFO/?releaseDate=Release+02",
        },
        {
          label: "Agency attribution",
          value: "Department of War / ODNI",
        },
        {
          label: "Source file",
          value: "ODNI-UAP-D001_USPER_Narrative_Senior_USIC.pdf",
          url: "https://www.war.gov/medialink/ufo/052226/release_02/documents/ODNI-UAP-D001_USPER_Narrative_Senior_USIC.pdf",
        },
      ],
      researchQuestions: [
        "What specific assertions in the narrative are direct witness testimony, official finding, or redacted context?",
        "Which earlier UAP files or congressional records does this narrative corroborate or contradict?",
        "What parts of the story can be checked against related videos, images, and release metadata?",
      ],
    },
  },
  {
    id: "war-uap-release-02-index",
    title: "Release 02 UAP media package",
    source: "Department of War",
    url: "https://www.war.gov/UFO/?releaseDate=Release+02",
    kind: "archive",
    viewer: "link",
    topicIds: ["uap-disclosure", "secret-programs"],
    summary:
      "The official release hub for UAP videos, images, and documents. The media library uses this as a source for new primary material.",
    publishedAt: "2026-05-22",
    fileType: "Release hub",
    agency: "Department of War",
    collection: "PURSUE",
    extraction: {
      status: "indexed",
      brief:
        "Official release index for the second PURSUE tranche. This is the source shelf for documents, videos, images, release metadata, and future additions tied to the May 22, 2026 UAP release.",
      highlights: [
        "Release 02 is the second public tranche under the PURSUE UAP file release program.",
        "The hub separates document and video downloads, which makes it the best source for expanding the media library.",
        "The release page says additional UAP files will continue to be published on a rolling basis.",
      ],
      sourceChain: [
        {
          label: "Primary index",
          value: "WAR.GOV/UFO Release 02",
          url: "https://www.war.gov/UFO/?releaseDate=Release+02",
        },
        {
          label: "Collection",
          value: "Presidential Unsealing and Reporting System for UAP Encounters",
        },
      ],
      researchQuestions: [
        "Which Release 02 videos have corresponding documents, dates, locations, or agency owners?",
        "Which records should become standalone media pages with transcripts and source briefs?",
        "What changed between Release 01 and Release 02 in agencies, geography, and document type?",
      ],
    },
  },
  {
    id: "war-uap-release-02-documents-shelf",
    title: "Release 02 official document shelf",
    source: "Department of War",
    url: "https://www.war.gov/UFO/?releaseDate=Release+02&type=.pdf",
    kind: "archive",
    viewer: "link",
    topicIds: ["uap-disclosure", "secret-programs"],
    summary:
      "A filtered official view of the May 22, 2026 Release 02 PDFs, including ODNI, CIA, NASA, Department of War, and related historical UAP records.",
    publishedAt: "2026-05-22",
    fileType: "Document shelf",
    agency: "Department of War",
    collection: "PURSUE Release 02",
    extraction: {
      status: "indexed",
      brief:
        "Official Release 02 document shelf. Use this as the first stop for PDF records before quoting screenshots, summaries, or social-media interpretations of the new tranche.",
      highlights: [
        "The official page labels Release 02 as cleared for release on May 22, 2026.",
        "The page advertises a Release 02 document download package and a browsable record database.",
        "Documents should be treated as primary records; claims about them should cite the exact record title and agency.",
      ],
      sourceChain: [
        {
          label: "Filtered records",
          value: "Release 02 PDFs",
          url: "https://www.war.gov/UFO/?releaseDate=Release+02&type=.pdf",
        },
        {
          label: "Primary index",
          value: "WAR.GOV/UFO",
          url: "https://www.war.gov/UFO/?releaseDate=Release+02",
        },
      ],
      researchQuestions: [
        "Which PDFs have matching videos, images, or audio records in Release 02?",
        "Which agencies appear for the first time in this tranche?",
        "What exact passages deserve a sourced article instead of a generic claim page?",
      ],
    },
  },
  {
    id: "war-uap-release-02-video-shelf",
    title: "Release 02 official video shelf",
    source: "Department of War",
    url: "https://www.war.gov/UFO/?releaseDate=Release+02&type=.vid",
    kind: "archive",
    viewer: "link",
    topicIds: ["uap-disclosure", "secret-programs", "space-anomalies"],
    summary:
      "A filtered official view of Release 02 video records. This is the source shelf for the highest-value UAP clips before the media pipeline mirrors individual files.",
    publishedAt: "2026-05-22",
    fileType: "Video shelf",
    agency: "Department of War",
    collection: "PURSUE Release 02",
    extraction: {
      status: "indexed",
      brief:
        "Official Release 02 video shelf. The page advertises a multi-gigabyte Release 02 video package and record-level video entries; each clip should be paired with incident metadata before editorializing.",
      highlights: [
        "The official page separates Release 02 video records from PDF and image records.",
        "Video items should be reviewed beside incident date, location, agency, and any companion documents.",
        "Standalone video pages should avoid overstating identity or intent when the official record remains unresolved.",
      ],
      sourceChain: [
        {
          label: "Filtered records",
          value: "Release 02 videos",
          url: "https://www.war.gov/UFO/?releaseDate=Release+02&type=.vid",
        },
        {
          label: "Collection",
          value: "PURSUE Release 02",
        },
      ],
      researchQuestions: [
        "Which clips show sensor behavior worth frame-by-frame analysis?",
        "Which videos have companion PDFs or still images in the same incident set?",
        "What alternative explanations should be tested before writing a headline?",
      ],
    },
  },
  {
    id: "war-uap-release-02-image-shelf",
    title: "Release 02 official image shelf",
    source: "Department of War",
    url: "https://www.war.gov/UFO/?releaseDate=Release+02&type=.img",
    kind: "archive",
    viewer: "link",
    topicIds: ["uap-disclosure", "space-anomalies"],
    summary:
      "A filtered official view of Release 02 image records for frame grabs, stills, and companion visual evidence.",
    publishedAt: "2026-05-22",
    fileType: "Image shelf",
    agency: "Department of War",
    collection: "PURSUE Release 02",
    extraction: {
      status: "indexed",
      brief:
        "Official Release 02 image shelf. Use it to find still frames and companion visuals before relying on screenshots circulating without source context.",
      highlights: [
        "The image filter keeps still visuals separate from PDFs, audio, and video records.",
        "Image records should be paired with incident metadata and companion documents before publication.",
        "Still frames can become story thumbnails only when the source chain remains visible.",
      ],
      sourceChain: [
        {
          label: "Filtered records",
          value: "Release 02 images",
          url: "https://www.war.gov/UFO/?releaseDate=Release+02&type=.img",
        },
        {
          label: "Collection",
          value: "PURSUE Release 02",
        },
      ],
      researchQuestions: [
        "Which stills correspond to a video, sensor record, or written narrative?",
        "What context is lost when the image is separated from the official record page?",
        "Which images are strong enough to anchor a visual explainer?",
      ],
    },
  },
  {
    id: "war-uap-release-02-audio-shelf",
    title: "Release 02 official audio shelf",
    source: "Department of War",
    url: "https://www.war.gov/UFO/?releaseDate=Release+02&type=.aud",
    kind: "archive",
    viewer: "link",
    topicIds: ["uap-disclosure", "secret-programs"],
    summary:
      "A filtered official view of Release 02 audio records for debriefings, mission audio, and companion evidence.",
    publishedAt: "2026-05-22",
    fileType: "Audio shelf",
    agency: "Department of War",
    collection: "PURSUE Release 02",
    extraction: {
      status: "indexed",
      brief:
        "Official Release 02 audio shelf. Audio records should be reviewed as source media, not just as background material for written claims.",
      highlights: [
        "The official release separates audio records from document, video, and image lanes.",
        "Audio can carry timing, witness language, and debriefing details that screenshots miss.",
        "Any transcript should be tied back to the original audio file or record page.",
      ],
      sourceChain: [
        {
          label: "Filtered records",
          value: "Release 02 audio",
          url: "https://www.war.gov/UFO/?releaseDate=Release+02&type=.aud",
        },
        {
          label: "Collection",
          value: "PURSUE Release 02",
        },
      ],
      researchQuestions: [
        "Which audio records need transcript extraction first?",
        "Which document or video record describes the same incident?",
        "What details are heard in the audio but absent from the written summary?",
      ],
    },
  },
  {
    id: "war-uap-release-01-index",
    title: "Release 01 UAP media package",
    source: "Department of War",
    url: "https://www.war.gov/UFO/?releaseDate=Release+01",
    kind: "archive",
    viewer: "link",
    topicIds: ["uap-disclosure", "secret-programs", "space-anomalies"],
    summary:
      "The first PURSUE release hub, useful for comparing the first tranche against Release 02 records and media.",
    publishedAt: "2026-05-08",
    fileType: "Release hub",
    agency: "Department of War",
    collection: "PURSUE Release 01",
    extraction: {
      status: "indexed",
      brief:
        "Official Release 01 index for the first PURSUE tranche. It is the baseline collection for tracking what changed when Release 02 expanded the public UAP file set.",
      highlights: [
        "Release 01 gives the site a before-and-after comparison point for new records.",
        "The most useful articles should compare titles, agencies, dates, and media types across releases.",
        "The release hub keeps the original government source visible beside the Inverted World archive.",
      ],
      sourceChain: [
        {
          label: "Primary index",
          value: "WAR.GOV/UFO Release 01",
          url: "https://www.war.gov/UFO/?releaseDate=Release+01",
        },
        {
          label: "Collection",
          value: "PURSUE Release 01",
        },
      ],
      researchQuestions: [
        "Which Release 01 records were updated, contradicted, or expanded by Release 02?",
        "Which files have direct media worth turning into standalone pages?",
        "Which early records generated the most news and X velocity?",
      ],
    },
  },
  {
    id: "aaro-historical-record-report-vol-1",
    title: "AARO historical record report, Volume I",
    source: "AARO",
    url: "https://www.aaro.mil/Portals/136/PDFs/AARO_Historical_Record_Report_Vol_1_2024.pdf",
    kind: "document",
    viewer: "pdf",
    topicIds: ["uap-disclosure", "secret-programs"],
    summary:
      "AARO's official historical record report on U.S. government UAP involvement, including past programs, interviewee claims, and official findings.",
    publishedAt: "2024-02-01",
    fileType: "PDF",
    agency: "AARO",
    collection: "Historical Record Report",
    extraction: {
      status: "indexed",
      brief:
        "Official AARO report for checking UAP program history, named government efforts, and the office's assessment of hidden-program allegations.",
      highlights: [
        "The report organizes U.S. government UAP investigations from 1945 forward.",
        "It separates historical programs, interviewee claims, and named sensitive-program reviews.",
        "It is a necessary counter-source beside whistleblower testimony, release packages, and independent media coverage.",
      ],
      sourceChain: [
        {
          label: "Source file",
          value: "AARO Historical Record Report Volume I",
          url: "https://www.aaro.mil/Portals/136/PDFs/AARO_Historical_Record_Report_Vol_1_2024.pdf",
        },
        {
          label: "Agency",
          value: "All-domain Anomaly Resolution Office",
          url: "https://www.aaro.mil/UAP-Records/",
        },
      ],
      researchQuestions: [
        "Which AARO findings are directly contradicted by later releases or testimony?",
        "Which historical programs deserve their own source chain pages?",
        "Where does the report rely on classified review that readers cannot independently inspect?",
      ],
    },
  },
  {
    id: "nasa-uap-independent-study-report",
    title: "NASA UAP Independent Study Team final report",
    source: "NASA",
    url: "https://science.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report.pdf",
    kind: "document",
    viewer: "pdf",
    topicIds: ["uap-disclosure", "space-anomalies", "ai-technocracy"],
    summary:
      "NASA's final independent study report on UAP data, sensor limits, public reporting, AI analysis, and scientific standards.",
    publishedAt: "2023-09-14",
    fileType: "PDF",
    agency: "NASA",
    collection: "UAP Independent Study",
    extraction: {
      status: "indexed",
      brief:
        "NASA's UAP report is the scientific-method anchor for the library: it frames UAP as a data-quality problem and lays out how future observations should be collected and analyzed.",
      highlights: [
        "NASA treats UAP study as a problem of calibrated data, sensor metadata, and repeatable analysis.",
        "The report discusses the role of AI and machine learning only when the underlying data is well characterized.",
        "It connects civilian reporting, aviation safety systems, and whole-of-government coordination with AARO.",
      ],
      sourceChain: [
        {
          label: "Source file",
          value: "NASA UAP final report",
          url: "https://science.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report.pdf",
        },
        {
          label: "NASA hub",
          value: "UAP Independent Study",
          url: "https://science.nasa.gov/uap/",
        },
      ],
      researchQuestions: [
        "Which Inverted World stories are data-quality stories rather than belief stories?",
        "Which reports contain sensor metadata strong enough for real analysis?",
        "How should the site separate UAP observations from claims about origin or intent?",
      ],
    },
  },
  {
    id: "nasa-uap-independent-study-briefing",
    title: "NASA UAP Independent Study media briefing",
    source: "NASA",
    url: "https://www.youtube.com/watch?v=eoY2sGo7ZiY",
    kind: "video",
    viewer: "youtube",
    topicIds: ["uap-disclosure", "space-anomalies"],
    summary:
      "NASA's public briefing video for the UAP Independent Study Team report, useful for pairing the PDF with what officials said on camera.",
    publishedAt: "2023-09-14",
    embedUrl: "https://www.youtube.com/embed/eoY2sGo7ZiY?rel=0",
    thumbnailUrl: "https://i.ytimg.com/vi/eoY2sGo7ZiY/hqdefault.jpg",
    fileType: "YouTube",
    agency: "NASA",
    collection: "UAP Independent Study",
    extraction: {
      status: "indexed",
      brief:
        "Official NASA briefing video attached to the UAP report. It belongs beside the PDF so viewers can compare written recommendations with the public explanation.",
      highlights: [
        "The video is the official public media companion to the final NASA report.",
        "It should be clipped around questions on data quality, stigma, reporting systems, and AI analysis.",
        "The briefing helps convert a dense report into watchable source media without losing the primary document.",
      ],
      sourceChain: [
        {
          label: "Video",
          value: "NASA media briefing",
          url: "https://www.youtube.com/watch?v=eoY2sGo7ZiY",
        },
        {
          label: "Companion PDF",
          value: "NASA UAP final report",
          url: "https://science.nasa.gov/wp-content/uploads/2023/09/uap-independent-study-team-final-report.pdf",
        },
      ],
      researchQuestions: [
        "Which public answers clarified or narrowed the written report?",
        "Which moments should become short clips for the media library?",
        "Which claims online omit the scientific caveats in the briefing?",
      ],
    },
  },
  {
    id: "fbi-jeffrey-epstein-part-01",
    title: "FBI Vault Jeffrey Epstein file, Part 01",
    source: "FBI Vault",
    url: "https://vault.fbi.gov/jeffrey-epstein/Jeffrey%20Epstein%20Part%2001/at_download/file",
    kind: "document",
    viewer: "pdf",
    topicIds: ["epstein-networks", "secret-programs"],
    summary:
      "The first FBI Vault PDF in the Jeffrey Epstein file set, rendered as source material for Power Web reporting.",
    fileType: "PDF",
    agency: "FBI",
    collection: "Jeffrey Epstein Vault",
    extraction: {
      status: "indexed",
      brief:
        "Official FBI Vault PDF for Epstein file review. It should be used as a record source, with allegations and identities handled only when the document itself supports them.",
      highlights: [
        "The FBI Vault page lists this as Part 01 of the Epstein file set.",
        "The file is a primary-source document, not a finished narrative by itself.",
        "Power Web coverage should cite exact pages and avoid laundering unsupported social claims through the existence of a file.",
      ],
      sourceChain: [
        {
          label: "Vault page",
          value: "Jeffrey Epstein Part 01",
          url: "https://vault.fbi.gov/jeffrey-epstein/Jeffrey%20Epstein%20Part%2001/view",
        },
        {
          label: "Source file",
          value: "Download PDF",
          url: "https://vault.fbi.gov/jeffrey-epstein/Jeffrey%20Epstein%20Part%2001/at_download/file",
        },
      ],
      researchQuestions: [
        "Which pages contain confirmed records rather than redacted context?",
        "Which names, dates, and locations can be checked against court records?",
        "Which parts of the file need careful legal framing before becoming a story?",
      ],
    },
  },
  {
    id: "war-uap-pr072-kazakhstan-airport-video",
    title: "PR072 Kazakhstan airport UAP video record",
    source: "Department of War",
    url: "https://www.war.gov/UFO/?type=.vid&releaseDate=Release+02#DOW-UAP-PR072-ADMINISTRATIVE-REVISION-IIR-1777-J0032-22-Kazakhstan-UAP-in-the-vicinity-of-Karaganda-International-Airport",
    kind: "video",
    viewer: "link",
    topicIds: ["uap-disclosure", "space-anomalies"],
    summary:
      "Record-level official link for a Release 02 video entry describing UAP activity near Karaganda International Airport in Kazakhstan.",
    publishedAt: "2026-05-22",
    fileType: "Official video record",
    agency: "Department of War",
    collection: "PURSUE Release 02",
    extraction: {
      status: "indexed",
      brief:
        "Release 02 video record anchor for the Kazakhstan airport case. Treat the title as a lead into the official modal, not as proof of what the object was.",
      highlights: [
        "The record is part of the official Release 02 video filter.",
        "The title points to Karaganda International Airport in Kazakhstan.",
        "The useful reporting question is what metadata, sensor context, and companion documents are attached to the record.",
      ],
      sourceChain: [
        {
          label: "Record anchor",
          value: "DOW-UAP-PR072",
          url: "https://www.war.gov/UFO/?type=.vid&releaseDate=Release+02#DOW-UAP-PR072-ADMINISTRATIVE-REVISION-IIR-1777-J0032-22-Kazakhstan-UAP-in-the-vicinity-of-Karaganda-International-Airport",
        },
        {
          label: "Release",
          value: "PURSUE Release 02",
        },
      ],
      researchQuestions: [
        "What date, platform, agency, and redactions are shown in the official record modal?",
        "Is there a PDF, still image, or audio companion record for the same incident?",
        "What mundane aviation, sensor, or atmospheric explanations need to be checked?",
      ],
    },
  },
  {
    id: "war-uap-pr052-uso-formation-video",
    title: "PR052 UAP/USO formation mission video record",
    source: "Department of War",
    url: "https://www.war.gov/UFO/?type=.vid&releaseDate=Release+02#DOW-UAP-PR052-UAP-USO-Formation-CALLSIGN-Mission",
    kind: "video",
    viewer: "link",
    topicIds: ["uap-disclosure", "space-anomalies"],
    summary:
      "Record-level official link for a Release 02 video entry labeled as a UAP/USO formation mission.",
    publishedAt: "2026-05-22",
    fileType: "Official video record",
    agency: "Department of War",
    collection: "PURSUE Release 02",
    extraction: {
      status: "indexed",
      brief:
        "Release 02 video record anchor for a UAP/USO formation mission. It is high-value media, but the article flow should separate visual description from identification.",
      highlights: [
        "The official title labels the record as UAP/USO formation footage.",
        "The record is part of the Release 02 video shelf, not an independent social upload.",
        "Formation language should be checked against the video, metadata, and any companion record.",
      ],
      sourceChain: [
        {
          label: "Record anchor",
          value: "DOW-UAP-PR052",
          url: "https://www.war.gov/UFO/?type=.vid&releaseDate=Release+02#DOW-UAP-PR052-UAP-USO-Formation-CALLSIGN-Mission",
        },
      ],
      researchQuestions: [
        "What exactly is visible frame by frame, and what is inferred from the label?",
        "Does the official record include location, platform, or sensor details?",
        "What would a skeptical source need to rule out before calling it anomalous?",
      ],
    },
  },
  {
    id: "war-uap-pr086-dec-2019-east-coast-video",
    title: "PR086 December 2019 East Coast UAP video record",
    source: "Department of War",
    url: "https://www.war.gov/UFO/?type=.vid&releaseDate=Release+02#DOW-UAP-PR086-UAP-from-Dec-2019-East-Coast",
    kind: "video",
    viewer: "link",
    topicIds: ["uap-disclosure", "space-anomalies"],
    summary:
      "Record-level official link for a Release 02 video entry tied to an East Coast UAP event in December 2019.",
    publishedAt: "2026-05-22",
    fileType: "Official video record",
    agency: "Department of War",
    collection: "PURSUE Release 02",
    extraction: {
      status: "indexed",
      brief:
        "Release 02 video record anchor for the December 2019 East Coast case. The title makes it ideal for a short sourced clip brief once the file is mirrored or reliably embeddable.",
      highlights: [
        "The official anchor identifies the record as an East Coast UAP video from December 2019.",
        "It should be connected to any companion incident report before writing a standalone story.",
        "This is a primary-source video lead, not a social repost.",
      ],
      sourceChain: [
        {
          label: "Record anchor",
          value: "DOW-UAP-PR086",
          url: "https://www.war.gov/UFO/?type=.vid&releaseDate=Release+02#DOW-UAP-PR086-UAP-from-Dec-2019-East-Coast",
        },
      ],
      researchQuestions: [
        "What platform, sensor, and location fields are visible in the official modal?",
        "Does the East Coast record overlap with previously public Navy or AARO material?",
        "What clips or still frames should become thumbnails for the story?",
      ],
    },
  },
  {
    id: "war-uap-pr095-gulf-arabia-dual-uap-video",
    title: "PR095 Gulf of Arabia dual UAP video record",
    source: "Department of War",
    url: "https://www.war.gov/UFO/?type=.vid&releaseDate=Release+02#DOW-UAP-PR095-May-05-2020-Gulf-of-Arabia-CALLSIGN-Platform-Dual-UAP",
    kind: "video",
    viewer: "link",
    topicIds: ["uap-disclosure", "space-anomalies"],
    summary:
      "Record-level official link for a Release 02 video entry labeled as a May 5, 2020 Gulf of Arabia dual-UAP case.",
    publishedAt: "2026-05-22",
    fileType: "Official video record",
    agency: "Department of War",
    collection: "PURSUE Release 02",
    extraction: {
      status: "indexed",
      brief:
        "Release 02 video record anchor for a Gulf of Arabia dual-UAP case. The important workflow is to pair the clip with its incident metadata and then test whether two-object framing is supported by the footage.",
      highlights: [
        "The official anchor names a May 5, 2020 Gulf of Arabia event.",
        "The title labels the record as a dual-UAP case.",
        "The record should be cross-checked against companion mission reports or stills before being promoted as a major story.",
      ],
      sourceChain: [
        {
          label: "Record anchor",
          value: "DOW-UAP-PR095",
          url: "https://www.war.gov/UFO/?type=.vid&releaseDate=Release+02#DOW-UAP-PR095-May-05-2020-Gulf-of-Arabia-CALLSIGN-Platform-Dual-UAP",
        },
      ],
      researchQuestions: [
        "Does the official video show two distinct objects, a sensor artifact, or a platform-relative effect?",
        "Which geographic and mission details can be cited without guessing?",
        "What counterread should accompany any viral headline?",
      ],
    },
  },
  {
    id: "nsa-mkultra-gottlieb-testimony",
    title: "CIA MKULTRA chief testimony, 50 years later",
    source: "National Security Archive",
    url: "https://nsarchive.gwu.edu/briefing-book/intelligence/2025-09-04/top-secret-testimony-cias-mkultra-chief-50-years-later",
    kind: "document",
    viewer: "link",
    topicIds: ["secret-programs"],
    summary:
      "A clean primary-source landing point for the Gottlieb testimony story, connecting declassified records with current Inverted World coverage.",
    publishedAt: "2025-09-04",
    fileType: "Archive briefing",
    agency: "National Security Archive",
    collection: "MKULTRA",
    extraction: {
      status: "indexed",
      brief:
        "Primary archive landing page for the MKULTRA testimony story. It should be paired with a plain-language news brief, the document trail, and clear labeling of historical fact versus modern inference.",
      highlights: [
        "The story is a source-backed archive item, not a speculative claim by itself.",
        "It belongs in Declassified coverage because the value is the document trail and historical context.",
        "Use this as the canonical source page when generating related article summaries.",
      ],
      sourceChain: [
        {
          label: "Archive source",
          value: "National Security Archive",
          url: "https://nsarchive.gwu.edu/briefing-book/intelligence/2025-09-04/top-secret-testimony-cias-mkultra-chief-50-years-later",
        },
        {
          label: "Coverage lane",
          value: "Declassified",
        },
      ],
      researchQuestions: [
        "What did the testimony establish as fact, and what remains unresolved?",
        "Which CIA Reading Room records should be linked beside the article?",
        "How should the headline distinguish archival publication from a new allegation?",
      ],
    },
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
