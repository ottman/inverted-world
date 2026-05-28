export type ResearchSourcePriority = "primary" | "independent" | "alternative" | "archive"

export type ResearchSourceSeed = {
  title: string
  source: string
  url: string
  priority: ResearchSourcePriority
  summary: string
  tags: string[]
}

export const researchDoctrine = [
  "Talk like a sharp independent researcher, not a corporate chatbot: direct, curious, skeptical, and readable.",
  "Treat the user as a thinking person. Answer the question first, then show the evidence map.",
  "Start from primary records when they exist: documents, court files, transcripts, raw data, official releases, full videos, archived broadcasts, and named witnesses.",
  "Actively search the independent research tradition around a topic before defaulting to mainstream coverage.",
  "Use mainstream outlets mainly to understand the official narrative, elite consensus, omissions, timing, and language repetition.",
  "Do not launder alternative-media claims into certainty. Treat them as leads until tied to records, witnesses, documents, or repeated independent corroboration.",
  "Separate what is documented, what is alleged, what is inferred, what is disputed, and what remains unknown.",
  "For hidden-power topics, track incentives, funding, conflicts of interest, intelligence ties, redactions, chain of custody, and who benefits from each narrative.",
]

export const researchSourceSeeds: ResearchSourceSeed[] = [
  {
    title: "Independent media and primary-record research doctrine",
    source: "Inverted World",
    url: "https://www.inverted.world/research",
    priority: "independent",
    summary:
      "The default Inverted World research posture: primary records first, independent researchers early, mainstream coverage as a comparator, and no claim upgraded beyond the evidence.",
    tags: [
      "truth",
      "research",
      "independent media",
      "alternative media",
      "primary records",
      "source trail",
      "official narrative",
      "hidden power",
      "conspiracy",
      "disclosure",
    ],
  },
  {
    title: "The Corbett Report 9/11 research archive",
    source: "The Corbett Report",
    url: "https://corbettreport.com/?s=9%2F11",
    priority: "independent",
    summary:
      "Independent longform research and documentaries on 9/11, intelligence history, war narratives, media framing, and the unanswered-question tradition.",
    tags: ["911", "9/11", "september 11", "corbett", "james corbett", "independent media", "false flag", "war on terror"],
  },
  {
    title: "The Corbett Report archive",
    source: "The Corbett Report",
    url: "https://corbettreport.com/",
    priority: "independent",
    summary:
      "Longform independent research archive on intelligence history, central banking, war narratives, technocracy, propaganda, health power, and institutional control.",
    tags: [
      "corbett",
      "james corbett",
      "independent media",
      "intelligence",
      "technocracy",
      "central banking",
      "propaganda",
      "war",
      "globalism",
      "source trail",
    ],
  },
  {
    title: "Infowars and Alex Jones archive",
    source: "Infowars",
    url: "https://www.infowars.com/",
    priority: "alternative",
    summary:
      "Alternative-media archive for Alex Jones coverage, caller reports, documentary claims, and counter-narrative framing. Use as a lead set, not as proof by itself.",
    tags: ["911", "9/11", "alex jones", "infowars", "alternative media", "false flag", "globalism", "deep state"],
  },
  {
    title: "Banned.video alternative media archive",
    source: "Banned.video",
    url: "https://banned.video/",
    priority: "alternative",
    summary:
      "Alternative video archive for Alex Jones, Infowars-adjacent shows, censorship disputes, and counter-narrative interviews. Use for leads and original statements, then corroborate.",
    tags: ["alex jones", "infowars", "banned video", "alternative media", "video archive", "censorship", "interviews", "globalism"],
  },
  {
    title: "Architects & Engineers for 9/11 Truth",
    source: "AE911Truth",
    url: "https://www.ae911truth.org/",
    priority: "independent",
    summary:
      "Independent engineering-focused organization arguing for renewed investigation of World Trade Center destruction claims and related technical evidence.",
    tags: ["911", "9/11", "world trade center", "wtc", "building 7", "controlled demolition", "engineering", "ae911truth"],
  },
  {
    title: "9/11 Commission Report",
    source: "National Commission on Terrorist Attacks Upon the United States",
    url: "https://www.9-11commission.gov/report/",
    priority: "primary",
    summary:
      "Official commission report. Treat it as the official narrative baseline to compare against independent, technical, and archival challenges.",
    tags: ["911", "9/11", "commission", "official story", "primary record", "government report", "war on terror"],
  },
  {
    title: "NIST World Trade Center investigation",
    source: "NIST",
    url: "https://www.nist.gov/world-trade-center-investigation",
    priority: "primary",
    summary:
      "Official technical investigation reports on the World Trade Center collapses, including the baseline technical claims that independent researchers challenge.",
    tags: ["911", "9/11", "nist", "world trade center", "wtc", "building 7", "collapse", "technical report"],
  },
  {
    title: "FBI Vault 9/11 investigation files",
    source: "FBI Vault",
    url: "https://vault.fbi.gov/9-11-attacks-investigation-and-related-materials",
    priority: "primary",
    summary:
      "Declassified FBI records and investigative files. Use for names, timelines, investigative leads, and redaction patterns.",
    tags: ["911", "9/11", "fbi", "vault", "declassified", "primary record", "investigation", "redactions"],
  },
  {
    title: "Internet Archive 9/11 Television News Archive",
    source: "Internet Archive",
    url: "https://archive.org/details/911",
    priority: "archive",
    summary:
      "Broadcast archive for same-day and aftermath coverage. Useful for tracing live claims, retractions, repeated language, and early eyewitness accounts.",
    tags: ["911", "9/11", "television archive", "broadcast", "eyewitness", "media record", "timeline"],
  },
  {
    title: "History Commons 9/11 timeline",
    source: "History Commons",
    url: "http://www.historycommons.org/project.jsp?project=911_project",
    priority: "archive",
    summary:
      "Open-source timeline project collecting claims, citations, chronology, and overlooked leads around 9/11 and the war on terror.",
    tags: ["911", "9/11", "timeline", "history commons", "chronology", "war on terror", "open source research"],
  },
  {
    title: "Timcast IRL",
    source: "Timcast",
    url: "https://www.youtube.com/@TimcastIRL",
    priority: "independent",
    summary:
      "Independent media comparator for current political framing, audience reaction, and interviews around contested news narratives.",
    tags: ["timcast", "tim pool", "independent media", "youtube", "breaking news", "interviews"],
  },
  {
    title: "Tim Pool archive",
    source: "Timcast",
    url: "https://timcast.com/",
    priority: "independent",
    summary:
      "Independent media archive for Tim Pool and Timcast coverage, interviews, political analysis, media criticism, and breaking-news framing.",
    tags: ["timcast", "tim pool", "independent media", "media criticism", "breaking news", "politics", "interviews"],
  },
  {
    title: "Tales From the Inverted World",
    source: "Inverted World",
    url: "https://www.youtube.com/@TalesfromtheInvertedWorld",
    priority: "independent",
    summary:
      "The Inverted World show archive. Use it to connect research questions back to Shane Cashman's episodes, interviews, and audience-facing story threads.",
    tags: ["inverted world", "tales from the inverted world", "shane cashman", "timcast", "youtube", "independent media"],
  },
  {
    title: "The Last American Vagabond",
    source: "The Last American Vagabond",
    url: "https://www.thelastamericanvagabond.com/",
    priority: "independent",
    summary:
      "Independent media archive for surveillance, war, biosecurity, censorship, foreign policy, and institutional power research leads.",
    tags: ["independent media", "surveillance", "war", "censorship", "biosecurity", "foreign policy", "deep state"],
  },
  {
    title: "Unlimited Hangout",
    source: "Unlimited Hangout",
    url: "https://unlimitedhangout.com/",
    priority: "independent",
    summary:
      "Independent investigative archive focused on intelligence networks, finance, elite power, surveillance, organized crime, and public-private governance.",
    tags: ["independent media", "whitney webb", "intelligence", "finance", "surveillance", "elite networks", "organized crime"],
  },
  {
    title: "The HighWire",
    source: "The HighWire",
    url: "https://thehighwire.com/",
    priority: "independent",
    summary:
      "Independent media archive for health freedom, regulatory capture, pharmaceutical power, public-health policy, and censorship disputes.",
    tags: ["independent media", "health", "pharma", "regulatory capture", "censorship", "public health", "vaccines"],
  },
  {
    title: "Public on Substack",
    source: "Public",
    url: "https://www.public.news/",
    priority: "independent",
    summary:
      "Independent reporting archive for censorship, institutional power, social breakdown, ideology, and government-media technology coordination.",
    tags: ["independent media", "censorship", "institutional power", "social media", "government", "technology", "michael shellenberger"],
  },
  {
    title: "Matt Taibbi's Racket News",
    source: "Racket News",
    url: "https://www.racket.news/",
    priority: "independent",
    summary:
      "Independent reporting and media criticism focused on censorship, financial power, intelligence-adjacent politics, and establishment narrative control.",
    tags: ["independent media", "taibbi", "racket news", "censorship", "media criticism", "finance", "intelligence"],
  },
  {
    title: "Glenn Greenwald's System Update",
    source: "System Update",
    url: "https://rumble.com/c/GGreenwald",
    priority: "independent",
    summary:
      "Independent video archive and analysis on civil liberties, intelligence agencies, war, censorship, political prosecutions, and media power.",
    tags: ["independent media", "greenwald", "civil liberties", "intelligence", "war", "censorship", "rumble"],
  },
  {
    title: "Jimmy Dore Show archive",
    source: "The Jimmy Dore Show",
    url: "https://rumble.com/c/TheJimmyDoreShow",
    priority: "independent",
    summary:
      "Independent anti-establishment video archive covering war, pharma, censorship, labor, media failures, and political corruption.",
    tags: ["independent media", "jimmy dore", "war", "pharma", "censorship", "corruption", "rumble"],
  },
  {
    title: "Dark Journalist archive",
    source: "Dark Journalist",
    url: "https://darkjournalist.com/",
    priority: "alternative",
    summary:
      "Alternative research archive focused on UFO secrecy, breakaway-civilization claims, intelligence history, esoteric politics, and deep-state networks.",
    tags: ["ufo", "uap", "alternative media", "dark journalist", "intelligence", "deep state", "esoteric", "breakaway civilization"],
  },
  {
    title: "The Black Vault",
    source: "The Black Vault",
    url: "https://www.theblackvault.com/documentarchive/",
    priority: "archive",
    summary:
      "FOIA document archive for UFO/UAP, intelligence records, military files, government secrecy, and declassified-document research.",
    tags: ["foia", "documents", "ufo", "uap", "declassified", "archive", "government records", "john greenewald"],
  },
  {
    title: "MuckRock FOIA archive",
    source: "MuckRock",
    url: "https://www.muckrock.com/",
    priority: "archive",
    summary:
      "FOIA request and document archive for building primary-record trails around government agencies, contractors, surveillance, policing, and public records.",
    tags: ["foia", "documents", "primary records", "public records", "surveillance", "government", "archive"],
  },
]
