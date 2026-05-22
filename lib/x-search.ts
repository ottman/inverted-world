import type { ContentTopic } from "@/data/inverted-world"

const topicXQueries: Record<string, string[]> = {
  "uap-disclosure": [
    '(UAP OR UFO OR AARO OR "UFO files" OR "UAP disclosure")',
    '("UFO hearing" OR "UAP hearing" OR Grusch OR Elizondo OR "Ryan Graves")',
    '("drone incursions" OR "mystery drones" OR "Pentagon UAP" OR "NASA UAP")',
    '("orb video" OR "crash retrieval" OR "non-human intelligence")',
  ],
  "secret-programs": [
    '(MKULTRA OR CIA OR FOIA OR declassified OR "secret program")',
    '("FBI Vault" OR "CIA files" OR "black budget" OR "classified program")',
    '(psyop OR psyops OR coverup OR "lab leak" OR "deep state")',
    '(Snowden OR Assange OR whistleblower OR "intelligence community")',
  ],
  "epstein-networks": [
    '("Jeffrey Epstein" OR Epstein OR Maxwell OR "Epstein files" OR "client list")',
    '("blackmail network" OR "elite network" OR "elite access" OR "institutional corruption")',
    '("donor class" OR "dark money" OR "lobbying network" OR "power network" OR "elite capture")',
    '("court records" OR "sealed documents" OR "flight logs" OR "unsealed documents")',
    '(Giuffre OR "Prince Andrew" OR "JPMorgan Epstein" OR "Epstein island" OR "Zorro Ranch")',
    '("WEF" OR Davos OR Bilderberg OR BlackRock OR Vanguard OR "World Economic Forum")',
    '("Diddy" OR "Les Wexner" OR "Bill Clinton" OR "Ghislaine Maxwell" OR Mossad)',
  ],
  "cryptids-paranormal": [
    '(Bigfoot OR Sasquatch OR cryptid OR Mothman OR Dogman)',
    '("ghost sighting" OR "ghost video" OR poltergeist OR "paranormal investigation")',
    '("high strangeness" OR Skinwalker OR "missing 411" OR "remote viewing")',
    '("near death experience" OR "consciousness anomaly" OR "strange lights")',
  ],
  "ai-technocracy": [
    '("AI surveillance" OR technocracy OR Palantir OR "digital ID")',
    '("facial recognition" OR "license plate reader" OR "predictive policing")',
    '("AI data center" OR "data centers" OR "power grid" OR "energy demand")',
    '(deepfake OR "synthetic media" OR "autonomous weapons" OR "AI governance")',
  ],
  "space-anomalies": [
    '((NASA OR NOAA OR ESA) ("space anomaly" OR anomaly OR meteor OR asteroid OR "solar storm" OR "geomagnetic storm"))',
    '("Mars anomaly" OR "moon anomaly" OR "lost satellite" OR "interstellar object")',
    '("NOAA SWPC" OR "space weather" OR "geomagnetic storm")',
    '("Bermuda Triangle" OR "ocean anomaly" OR comet OR bolide)',
  ],
}

export function getTopicXQueries(topic: ContentTopic) {
  return topicXQueries[topic.id] || [topic.query.replaceAll('"', "")]
}

export function getTopicXQuery(topic: ContentTopic) {
  return getTopicXQueries(topic)[0]
}

export function getTopicXSearchUrl(topic: ContentTopic) {
  const query = `${getTopicXQuery(topic)} min_faves:1000 min_retweets:100 -filter:replies`
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=top`
}
