type TopicMatcher = {
  topicId: string
  words: string[]
}

const TOPIC_MATCHERS: TopicMatcher[] = [
  {
    topicId: "uap-disclosure",
    words: ["ufo", "uap", "alien", "retrieval", "aaro", "pentagon", "disclosure", "grusch"],
  },
  {
    topicId: "secret-programs",
    words: ["mkultra", "cia", "fbi", "psyop", "psyops", "coverup", "cover-up", "classified", "declassified", "covid", "hearing", "foia"],
  },
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
      "institution",
      "institutions",
      "donor network",
      "donor class",
      "power network",
      "powerful people",
      "politics",
      "political",
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
  },
  {
    topicId: "cryptids-paranormal",
    words: ["cryptid", "bigfoot", "sasquatch", "ghost", "paranormal", "apocalyptic", "haunted", "demon", "folklore", "pterodactyl", "skinwalker", "baba vanga"],
  },
  {
    topicId: "ai-technocracy",
    words: ["ai", "data center", "data centers", "surveillance", "technocracy", "algorithm", "machine", "synthetic", "robot", "palantir", "digital id", "transhuman"],
  },
  {
    topicId: "space-anomalies",
    words: ["bermuda", "nasa", "moon", "mars", "meteor", "space", "satellite", "solar", "ocean", "asteroid", "comet", "geomagnetic"],
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

function scoreTerms(haystack: string, words: string[], weight: number) {
  return words.reduce((score, word) => score + (termMatches(haystack, word) ? weight : 0), 0)
}

export function classifyInvertedWorldTopic(title: string, description = "") {
  const titleHaystack = normalize(title)
  const descriptionHaystack = normalize(description)
  const scored = TOPIC_MATCHERS.map((topic, index) => ({
    topicId: topic.topicId,
    score: scoreTerms(titleHaystack, topic.words, 3) + scoreTerms(descriptionHaystack, topic.words, 1),
    index,
  }))
    .filter((topic) => topic.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)

  return scored[0]?.topicId || "secret-programs"
}
