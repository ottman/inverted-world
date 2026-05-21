import {
  channelProfile,
  getDocumentsForTopic,
  getTopic,
  researchDocuments,
  topics,
  universalTopic,
  type ChannelVideo,
  type ContentTopic,
  type ResearchDocument,
} from "@/data/inverted-world"

export type DossierReference = {
  title: string
  source: string
  url: string
  kind: string
}

export type VideoDossier = {
  video: ChannelVideo
  topic: ContentTopic
  references: DossierReference[]
  title: string
  dek: string
  article: Array<{
    heading: string
    body: string
  }>
  searchQueries: string[]
}

const topicSignals: Array<{ topicId: string; terms: string[] }> = [
  {
    topicId: "epstein-networks",
    terms: ["epstein", "maxwell", "island", "sealed", "docket", "elite", "names", "note"],
  },
  {
    topicId: "uap-disclosure",
    terms: ["ufo", "uap", "alien", "aaro", "retrieval", "beings", "extraterrestrial", "disclosure"],
  },
  {
    topicId: "secret-programs",
    terms: ["mkultra", "cia", "psyop", "psyops", "coverup", "cover-up", "covid", "classified", "deep state"],
  },
  {
    topicId: "ai-technocracy",
    terms: ["ai", "palantir", "surveillance", "data center", "tracking", "license plate", "technocracy", "laser"],
  },
  {
    topicId: "space-anomalies",
    terms: ["bermuda", "nasa", "mars", "moon", "space", "meteor", "solar", "satellite", "ancient"],
  },
  {
    topicId: "cryptids-paranormal",
    terms: ["sasquatch", "bigfoot", "cryptid", "paranormal", "ghost", "baba", "remote viewing", "ark"],
  },
]

function inferTopicId(video: ChannelVideo) {
  if (video.topicId && video.topicId !== universalTopic.id) return video.topicId

  const haystack = video.title.toLowerCase()
  const match = topicSignals.find((signal) => signal.terms.some((term) => haystack.includes(term)))
  return match?.topicId ?? universalTopic.id
}

function uniqueReferences(references: DossierReference[]) {
  const seen = new Set<string>()
  return references.filter((reference) => {
    if (seen.has(reference.url)) return false
    seen.add(reference.url)
    return true
  })
}

function documentToReference(document: ResearchDocument): DossierReference {
  return {
    title: document.title,
    source: document.source,
    url: document.url,
    kind: document.kind,
  }
}

function referencesForVideo(video: ChannelVideo, topic: ContentTopic) {
  const topicDocuments = getDocumentsForTopic(topic.id)
  const documents = topicDocuments.length ? topicDocuments : researchDocuments
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${video.title} ${topic.query}`)}`
  const newsUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(video.title)}&mode=artlist&format=html`

  return uniqueReferences([
    {
      title: video.title,
      source: channelProfile.name,
      url: video.href,
      kind: "source-video",
    },
    ...documents.slice(0, 7).map(documentToReference),
    {
      title: `Cross-outlet coverage search for ${video.title}`,
      source: "GDELT",
      url: newsUrl,
      kind: "news-index",
    },
    {
      title: `Open web search for ${video.title}`,
      source: "Google",
      url: searchUrl,
      kind: "web-index",
    },
  ])
}

function compactDescription(video: ChannelVideo) {
  const clean = video.description?.replace(/\s+/g, " ").trim()
  if (!clean) return ""
  return clean.length > 420 ? `${clean.slice(0, 417)}...` : clean
}

function videoAngle(video: ChannelVideo, topic: ContentTopic) {
  const title = video.title
  const normalized = title.toLowerCase()
  const isShort = normalized.includes("#shorts") || video.kind === "short"

  if (normalized.includes("trump") && (normalized.includes("ufo") || normalized.includes("retrieval"))) {
    return {
      subject: "a claim that presidential-level briefings touched UFO retrieval programs",
      centralQuestion:
        "If a retrieval program was real enough to brief a president, where would the budget, contractor, congressional, or classification trail show up?",
      weirdRead:
        "The weird read is that official language around UAP may be narrower than the underlying programs, leaving retrieval, exploitation, or contractor custody outside the public answer.",
      skepticRead:
        "The skeptical read is that political names can inflate a secondhand claim; the story needs a document trail beyond a dramatic briefing headline.",
      evidenceTargets: ["AARO statements", "congressional testimony", "appropriations language", "contractor records"],
    }
  }

  if (normalized.includes("bermuda")) {
    return {
      subject: "the Bermuda Triangle as a collision point between folklore, maritime risk, weather, navigation, and anomaly culture",
      centralQuestion:
        "Does the mystery require a hidden force, or can incident clustering, weather, traffic density, and retold media accounts explain most of the signal?",
      weirdRead:
        "The weird read is that the Triangle persists because some cases have unresolved timing, communication, or wreckage questions that never fully collapse into ordinary explanations.",
      skepticRead:
        "The skeptical read is that a famous boundary drawn after the fact makes normal ocean risk look statistically uncanny.",
      evidenceTargets: ["NOAA ocean records", "Coast Guard incident history", "aviation reports", "archived newspaper accounts"],
    }
  }

  if (normalized.includes("covid") || normalized.includes("coverup")) {
    return {
      subject: "COVID origin, response, and institutional-trust claims framed through documents rather than vibes",
      centralQuestion:
        "Which parts of the alleged coverup are documented policy reversals, which are unresolved origin questions, and which are unsupported narrative compression?",
      weirdRead:
        "The weird read is that funding chains, lab oversight, platform moderation, and public-health messaging may reveal coordination that was not obvious in real time.",
      skepticRead:
        "The skeptical read is that crisis uncertainty, bureaucratic self-protection, and changing evidence can look like a unified plot after the fact.",
      evidenceTargets: ["NIH records", "congressional reports", "FOIA releases", "peer-reviewed origin literature"],
    }
  }

  if (normalized.includes("epstein")) {
    return {
      subject: "Epstein network claims split between court records, institutional access, sealed gaps, and rumor",
      centralQuestion:
        "What is actually in the docket, what is alleged by witnesses or media, and what remains sealed or structurally protected?",
      weirdRead:
        "The weird read is that the network matters less as one man's crimes and more as a map of elite access, institutional silence, and protected logistics.",
      skepticRead:
        "The skeptical read is that proximity, money, and social access do not automatically prove participation in criminal conduct.",
      evidenceTargets: ["court filings", "deposition exhibits", "DOJ releases", "flight-log and corporate-record context"],
    }
  }

  if (normalized.includes("mkultra") || normalized.includes("cia") || normalized.includes("remote viewing")) {
    return {
      subject: "declassified intelligence programs and the modern temptation to extend them past the documents",
      centralQuestion:
        "Where does the proven archive end, and where do continuity claims begin relying on inference?",
      weirdRead:
        "The weird read is that old programs prove the state explored stranger territory than official culture likes to admit, so present-day dismissals deserve pressure.",
      skepticRead:
        "The skeptical read is that a real historical program does not prove every modern claim that borrows its aura.",
      evidenceTargets: ["CIA Reading Room", "National Security Archive", "FOIA logs", "congressional investigations"],
    }
  }

  if (normalized.includes("ai") || normalized.includes("data center") || normalized.includes("surveillance") || normalized.includes("tracking")) {
    return {
      subject: "AI infrastructure and surveillance power moving from speculation into procurement, policy, and physical buildout",
      centralQuestion:
        "Which control systems are actually being deployed, who governs them, and where does public accountability disappear?",
      weirdRead:
        "The weird read is that the machinery of technocracy is not a future event; it is arriving through boring procurement, data centers, cameras, and model-governance language.",
      skepticRead:
        "The skeptical read is that not every data center or AI policy document is a social-control blueprint; many are capacity, compliance, or security work.",
      evidenceTargets: ["NIST AI documents", "Federal Register notices", "CISA guidance", "municipal surveillance contracts"],
    }
  }

  if (normalized.includes("sasquatch") || normalized.includes("baba") || normalized.includes("paranormal") || normalized.includes("ark")) {
    return {
      subject: "paranormal and fringe-history claims where witness culture, folklore, faith, and document trails overlap",
      centralQuestion:
        "What part of the story is a witness claim, what part is a historical record, and what part is mythic interpretation?",
      weirdRead:
        "The weird read is that persistent stories can preserve real anomalies, suppressed history, or misread evidence that deserves patient investigation.",
      skepticRead:
        "The skeptical read is that folklore, prediction markets, and religious pattern-matching can turn ambiguity into false certainty.",
      evidenceTargets: ["local archives", "Library of Congress folklore collections", "field reports", "primary historical texts"],
    }
  }

  return {
    subject: `${topic.title.toLowerCase()} through the specific media hook "${title}"`,
    centralQuestion:
      "What has to be true in the record for this claim to hold, and what ordinary explanation would create the same public signal?",
    weirdRead: `The weird read follows the unresolved edge: ${topic.stance}`,
    skepticRead:
      "The skeptical read is that a title can compress too much. The claim needs dates, named records, and falsifiable source paths before it earns belief.",
    evidenceTargets: topic.documents,
  }
}

export function buildVideoDossier(video: ChannelVideo): VideoDossier {
  const topic = getTopic(inferTopicId(video))
  const references = referencesForVideo(video, topic)
  const published = video.date || "unknown date"
  const angle = videoAngle(video, topic)
  const description = compactDescription(video)
  const title = `${video.title} | Inverted World`
  const dek = `Synopsis and research links for ${angle.subject}, grounded in the episode, primary-source lanes, cross-outlet coverage, and the strongest skeptical counterread.`
  const primaryRefs = references.slice(1, 4).map((reference) => reference.source).join(", ")
  const querySeed = topic.query.replaceAll('"', "")

  return {
    video,
    topic,
    references,
    title,
    dek,
    searchQueries: [
      `${video.title} site:.gov`,
      `${video.title} filetype:pdf`,
      `${video.title} court records OR docket`,
      `${video.title} GDELT media coverage`,
      `${querySeed} ${video.title}`,
    ],
    article: [
      {
        heading: "The claim on the table",
        body:
          `"${video.title}" is not just a headline in the archive. It is a test case for ${angle.subject}. The central question is: ${angle.centralQuestion}${description ? ` The episode metadata adds this working context: ${description}` : ""}`,
      },
      {
        heading: "The evidence trail to pull first",
        body:
          `Start with the original upload from ${published}, then move outward into ${primaryRefs || "government and archive records"}. The first evidence targets are ${angle.evidenceTargets.join(", ")}. The goal is to build a chain from episode claim to document, from document to institution, and from institution to contradictions, omissions, or corroboration.`,
      },
      {
        heading: "The skeptical read",
        body: `${angle.skepticRead} A serious skeptical pass should strip the story down to the smallest documented claim, then ask what evidence would change the conclusion.`,
      },
      {
        heading: "The strange read",
        body: `${angle.weirdRead} The strange read does not mean "believe it." It means the unresolved portions deserve source pressure: redactions, missing records, narrow denials, sealed filings, broken timelines, or language that changes between agencies.`,
      },
      {
        heading: "Both-sides research brief",
        body:
          `The pro-case should collect the strongest primary source, the most specific witness or media claim, and the clearest unexplained gap. The counter-case should collect the best mundane explanation, the weakest link in the claim chain, and any incentive that could turn uncertainty into hype. A publishable article should show both side by side before making a call.`,
      },
      {
        heading: "What to research next",
        body:
          `Search the exact title, then run "${querySeed}" through government, court, science, and broadcast indexes. Save one primary record, one mainstream counterread, one hostile counterread, one archival lead, and one unanswered question.`,
      },
    ],
  }
}

export function videoDossierJsonLd(dossier: VideoDossier, url: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "VideoObject",
        name: dossier.video.title,
        description: dossier.dek,
        uploadDate: dossier.video.date || undefined,
        thumbnailUrl: dossier.video.thumbnail ? [dossier.video.thumbnail] : undefined,
        embedUrl: dossier.video.embedUrl,
        contentUrl: dossier.video.href,
      },
      {
        "@type": "Article",
        headline: dossier.title,
        description: dossier.dek,
        datePublished: dossier.video.date || undefined,
        dateModified: new Date().toISOString(),
        mainEntityOfPage: url,
        about: [dossier.topic.title, dossier.video.title],
        citation: dossier.references.map((reference) => reference.url),
        publisher: {
          "@type": "Organization",
          name: "Inverted World",
          url: "https://invertedworld.on.recursiv.io",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Archive",
            item: "https://invertedworld.on.recursiv.io/archive",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: dossier.video.title,
            item: url,
          },
        ],
      },
    ],
  }
}

export function topicIdsForSitemap() {
  return topics.map((topic) => topic.id)
}
