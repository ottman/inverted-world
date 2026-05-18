import {
  channelProfile,
  getDocumentsForTopic,
  getTopic,
  getVideosForTopic,
  type ContentTopic,
} from "@/data/inverted-world"

export const aiEditorialPolicy = [
  "Curious, adversarial, and humble: follow anomalies without pretending uncertainty is proof.",
  "Separate confirmed records, credible reporting, witness claims, analysis, speculation, and unknowns.",
  "Prefer primary documents, court records, agency records, raw datasets, and archived original media.",
  "Compare coverage across outlets before drawing a narrative conclusion.",
  "Never present a harmful allegation about a private person as fact without primary-source support.",
  "Make the strongest skeptical reading and the strongest weird reading visible side by side.",
]

export function buildResearchPrompt(message: string, topicId?: string) {
  const topic = getTopic(topicId)
  const videos = getVideosForTopic(topic.id)
  const docs = getDocumentsForTopic(topic.id)

  return [
    `You are the research intelligence layer for ${channelProfile.name}.`,
    "Voice: critical-thinking, document-grounded, open to anomalies, and willing to say we do not know.",
    `Topic lane: ${topic.title}.`,
    `Topic signal: ${topic.signal}.`,
    `Topic stance: ${topic.stance}.`,
    "Editorial rules:",
    ...aiEditorialPolicy.map((rule) => `- ${rule}`),
    "Relevant channel items:",
    ...videos.map((video) => `- ${video.title} (${video.date})`),
    "Primary-source lanes:",
    ...docs.map((doc) => `- ${doc.source}: ${doc.title} (${doc.url})`),
    "Respond with: thesis, confirmed record, competing interpretations, missing documents, suggested next searches, and media angles.",
    `User request: ${message}`,
  ].join("\n")
}

export function buildLocalResearchResponse(message: string, topic: ContentTopic) {
  const docs = getDocumentsForTopic(topic.id)
  const videos = getVideosForTopic(topic.id)
  const searches = [
    `${topic.query} site:.gov`,
    `${topic.query} filetype:pdf`,
    `${topic.query} court records OR docket`,
    `${topic.query} GDELT media coverage`,
  ]

  return {
    mode: "local-research-scaffold",
    answer: [
      `Research lane: ${topic.title}. The strongest starting hypothesis is not that the strangest claim is true; it is that this topic has a record trail worth mapping before anyone decides what they believe.`,
      "",
      "Confirmed record to build from:",
      ...docs.slice(0, 4).map((doc) => `- ${doc.source}: ${doc.title}`),
      "",
      "Channel context to connect:",
      ...videos.slice(0, 4).map((video) => `- ${video.title} (${video.date})`),
      "",
      "Critical split:",
      "- Skeptical read: explainable events, sensational framing, weak sourcing, or category errors may be driving the mystery.",
      "- Weird read: official gaps, repeated witnesses, historical precedent, or document conflicts may justify deeper investigation.",
      "",
      "Next searches:",
      ...searches.map((search) => `- ${search}`),
      "",
      `User angle: ${message}`,
    ].join("\n"),
    citations: docs.map((doc) => ({
      title: doc.title,
      source: doc.source,
      url: doc.url,
    })),
  }
}
