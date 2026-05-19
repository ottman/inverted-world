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

export function buildVideoDossier(video: ChannelVideo): VideoDossier {
  const topic = getTopic(inferTopicId(video))
  const references = referencesForVideo(video, topic)
  const published = video.date || "unknown date"
  const title = `${video.title} | Inverted World dossier`
  const dek = `AI-generated research brief for "${video.title}", grounded in the episode, public records, government documents, archive indexes, and skeptical counterreads.`
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
        heading: "What this episode is really about",
        body:
          `${video.title} sits in the ${topic.title.toLowerCase()} lane of the Inverted World archive. The useful way into it is not to decide instantly whether the claim is true or false. The useful way is to identify what would have to exist in the record if the story is real, what would look similar if the story is noise, and which institutions have documents worth pulling first.`,
      },
      {
        heading: "The evidence trail",
        body:
          `Start with the original upload from ${published}, then move outward into primary records. For this topic, the first source lane is ${primaryRefs || "government and archive records"}. The goal is to build a chain from media claim to document, from document to agency or court context, and from there to conflicts, omissions, or corroboration.`,
      },
      {
        heading: "The skeptical read",
        body:
          `A strong skeptical read treats the episode as a lead, not proof. Old documents can be reframed as new, agencies can use ambiguous language, witnesses can be sincere and wrong, and social-media heat can make disconnected facts look coordinated. The skeptical pass should reduce the claim to the smallest documented version that still survives contact with the record.`,
      },
      {
        heading: "The strange read",
        body:
          `The strange read keeps the door open. ${topic.stance} If the official trail is incomplete, the missing piece is itself a research object: redactions, vanished links, sealed filings, contractor boundaries, broken timelines, or a sudden change in institutional language.`,
      },
      {
        heading: "What to research next",
        body:
          `The next move is to search for the exact title, then run the topic query against government, court, science, and broadcast indexes. Save the best primary document, the best mainstream counterread, and the strongest weird read. A useful dossier should make all three visible at once.`,
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
