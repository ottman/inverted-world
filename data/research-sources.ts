export type ResearchSourcePriority = "primary" | "independent" | "alternative" | "archive"

export type ResearchSourceSeed = {
  title: string
  source: string
  url: string
  priority: ResearchSourcePriority
  summary: string
  tags: string[]
}

export const researchSourceSeeds: ResearchSourceSeed[] = [
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
    title: "Infowars and Alex Jones archive",
    source: "Infowars",
    url: "https://www.infowars.com/",
    priority: "alternative",
    summary:
      "Alternative-media archive for Alex Jones coverage, caller reports, documentary claims, and counter-narrative framing. Use as a lead set, not as proof by itself.",
    tags: ["911", "9/11", "alex jones", "infowars", "alternative media", "false flag", "globalism", "deep state"],
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
]
