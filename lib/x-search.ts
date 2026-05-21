import type { ContentTopic } from "@/data/inverted-world"

const topicXQueries: Record<string, string> = {
  "uap-disclosure": '(UAP OR UFO OR AARO OR "UFO files" OR disclosure)',
  "secret-programs": '(MKULTRA OR CIA OR FOIA OR declassified OR "secret program")',
  "epstein-networks": '("Jeffrey Epstein" OR Epstein OR Maxwell OR "sealed files")',
  "cryptids-paranormal": '(Bigfoot OR cryptid OR paranormal OR "high strangeness" OR haunting)',
  "ai-technocracy": '("AI surveillance" OR technocracy OR Palantir OR "data centers" OR "digital ID")',
  "space-anomalies": '(NASA OR "space anomaly" OR meteor OR "solar storm" OR Mars)',
}

export function getTopicXQuery(topic: ContentTopic) {
  return topicXQueries[topic.id] || topic.query.replaceAll('"', "")
}

export function getTopicXSearchUrl(topic: ContentTopic) {
  const query = `${getTopicXQuery(topic)} min_faves:100 -filter:replies`
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=top`
}
