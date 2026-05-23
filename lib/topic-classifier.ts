type TopicMatcher = {
  topicId: string
  words: string[]
  weakWords?: string[]
  priority: number
}

export type InvertedWorldTopicClassification = {
  topicId: string
  matched: boolean
  score: number
  matchedTerms: string[]
}

const TOPIC_MATCHERS: TopicMatcher[] = [
  {
    topicId: "epstein-networks",
    words: [
      "epstein",
      "maxwell",
      "ghislaine",
      "zorro ranch",
      "wexner",
      "les wexner",
      "prince andrew",
      "giuffre",
      "jpmorgan",
      "client list",
      "flight log",
      "flight logs",
      "sealed names",
      "sealed documents",
      "co-conspirator",
      "co-conspirators",
      "pedophile network",
      "blackmail",
      "powerful families",
      "blackmail network",
      "elite access",
      "elite network",
      "elite capture",
      "institutional ties",
      "institutional corruption",
      "donor network",
      "donor class",
      "power network",
      "powerful people",
      "lobbyist",
      "lobbying",
      "davos",
      "wef",
      "world economic forum",
      "bilderberg",
      "blackrock",
      "vanguard",
      "diddy",
      "mossad",
      "rothschild",
      "royal",
    ],
    weakWords: ["institution", "institutions", "politics", "political", "sealed", "court"],
    priority: 0,
  },
  {
    topicId: "uap-disclosure",
    words: ["ufo", "uap", "alien", "retrieval", "aaro", "pentagon", "disclosure", "grusch"],
    weakWords: ["hearing", "congressional hearing", "whistleblower"],
    priority: 1,
  },
  {
    topicId: "cryptids-paranormal",
    words: ["cryptid", "bigfoot", "sasquatch", "ghost", "paranormal", "apocalyptic", "haunted", "demon", "folklore", "pterodactyl", "skinwalker", "baba vanga"],
    priority: 3,
  },
  {
    topicId: "ai-technocracy",
    words: ["ai", "data center", "data centers", "surveillance", "technocracy", "algorithm", "machine", "synthetic", "robot", "palantir", "digital id", "transhuman"],
    priority: 2,
  },
  {
    topicId: "space-anomalies",
    words: ["bermuda", "nasa", "moon", "mars", "meteor", "space", "satellite", "solar", "asteroid", "comet", "geomagnetic"],
    weakWords: ["ocean", "atmosphere"],
    priority: 4,
  },
  {
    topicId: "secret-programs",
    words: ["mkultra", "cia", "fbi", "psyop", "psyops", "coverup", "cover-up", "classified", "declassified", "covid", "foia"],
    weakWords: ["hearing", "records", "documents", "files"],
    priority: 5,
  },
]

function normalize(value = "") {
  return value.toLowerCase()
}

function termMatches(haystack: string, term: string) {
  const normalizedTerm = normalize(term)
  if (!normalizedTerm) return false

  if (/^[a-z0-9]+$/.test(normalizedTerm)) {
    return new RegExp(`\\b${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack)
  }

  return haystack.includes(normalizedTerm)
}

function matchedTerms(haystack: string, words: string[]) {
  return words.filter((word) => termMatches(haystack, word))
}

function scoreTerms(haystack: string, words: string[], weight: number) {
  return matchedTerms(haystack, words).length * weight
}

export function classifyInvertedWorldTopicMatch(title: string, description = ""): InvertedWorldTopicClassification {
  const titleHaystack = normalize(title)
  const descriptionHaystack = normalize(description)
  const scored = TOPIC_MATCHERS.map((topic) => {
    const titleTerms = matchedTerms(titleHaystack, topic.words)
    const descriptionTerms = matchedTerms(descriptionHaystack, topic.words)
    const weakTitleTerms = matchedTerms(titleHaystack, topic.weakWords || [])
    const weakDescriptionTerms = matchedTerms(descriptionHaystack, topic.weakWords || [])
    return {
      topicId: topic.topicId,
      score:
        scoreTerms(titleHaystack, topic.words, 3) +
        scoreTerms(descriptionHaystack, topic.words, 1) +
        scoreTerms(titleHaystack, topic.weakWords || [], 1) +
        scoreTerms(descriptionHaystack, topic.weakWords || [], 0.25),
      matchedTerms: [...titleTerms, ...descriptionTerms, ...weakTitleTerms, ...weakDescriptionTerms],
      priority: topic.priority,
    }
  })
    .filter((topic) => topic.score > 0)
    .sort((left, right) => right.score - left.score || left.priority - right.priority)

  const best = scored[0]
  if (!best) {
    return {
      topicId: "secret-programs",
      matched: false,
      score: 0,
      matchedTerms: [],
    }
  }

  return {
    topicId: best.topicId,
    matched: true,
    score: best.score,
    matchedTerms: [...new Set(best.matchedTerms)],
  }
}

export function classifyInvertedWorldTopic(title: string, description = "") {
  return classifyInvertedWorldTopicMatch(title, description).topicId
}
