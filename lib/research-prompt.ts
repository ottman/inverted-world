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
    "The user may ask about any conspiracy or anomaly, not only the selected lane. If the ask is outside this lane, answer it directly and use the lane only as optional style/context.",
    "Respond in a compact format: signal, record, weird read, skeptical read, next searches.",
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
      `Signal: ${topic.title}.`,
      "",
      "Record:",
      ...docs.slice(0, 4).map((doc) => `- ${doc.source}: ${doc.title}`),
      "",
      "Archive:",
      ...videos.slice(0, 4).map((video) => `- ${video.title} (${video.date})`),
      "",
      "Read:",
      "- Weird: official gaps, repeated witnesses, or document conflicts justify pressure.",
      "- Skeptical: weak sourcing, category errors, or hype may explain the signal.",
      "",
      "Next:",
      ...searches.map((search) => `- ${search}`),
      "",
      `Ask: ${message}`,
    ].join("\n"),
    citations: docs.map((doc) => ({
      title: doc.title,
      source: doc.source,
      url: doc.url,
    })),
  }
}
