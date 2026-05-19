import {
  channelProfile,
  featuredVideos,
  getDocumentsForTopic,
  getTopic,
  getVideosForTopic,
  researchDocuments,
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
  const universal = !topicId || topic.id === "all"
  const videos = universal ? featuredVideos.filter((video) => video.source === "YouTube").slice(0, 14) : getVideosForTopic(topic.id)
  const docs = universal ? researchDocuments.slice(0, 18) : getDocumentsForTopic(topic.id)

  return [
    `You are the research intelligence layer for ${channelProfile.name}.`,
    "Voice: critical-thinking, document-grounded, open to anomalies, and willing to say we do not know.",
    universal
      ? "Default mode: open-field truth desk. The user can ask about any conspiracy, paranormal claim, strange pattern, occult history, hidden network, UAP story, or philosophical question about reality."
      : `Topic lane: ${topic.title}.`,
    `Signal: ${topic.signal}.`,
    `Stance: ${topic.stance}.`,
    "Editorial rules:",
    ...aiEditorialPolicy.map((rule) => `- ${rule}`),
    "Relevant channel items:",
    ...videos.map((video) => `- ${video.title} (${video.date})`),
    "Primary-source lanes:",
    ...docs.map((doc) => `- ${doc.source}: ${doc.title} (${doc.url})`),
    "The user may ask about anything. Answer directly first, then attach receipts, caveats, contradictions, and searches.",
    "Respond in a compact but useful format: signal, record, weird read, skeptical read, what to verify next.",
    `User request: ${message}`,
  ].join("\n")
}

export function buildLocalResearchResponse(message: string, topic: ContentTopic) {
  const terms = message
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)
  const score = (value: string) => terms.reduce((total, term) => total + (value.toLowerCase().includes(term) ? 1 : 0), 0)
  const docs = [...getDocumentsForTopic(topic.id)].sort(
    (a, b) => score(`${b.title} ${b.source} ${b.topicIds.join(" ")}`) - score(`${a.title} ${a.source} ${a.topicIds.join(" ")}`),
  )
  const videos = [...getVideosForTopic(topic.id)].sort(
    (a, b) => score(`${b.title} ${b.topicId}`) - score(`${a.title} ${a.topicId}`),
  )
  const searches = [
    `"${message}" site:.gov`,
    `"${message}" filetype:pdf`,
    `"${message}" court records OR docket`,
    `"${message}" GDELT media coverage`,
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
