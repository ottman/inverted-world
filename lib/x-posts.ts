import { topics } from "@/data/inverted-world"
import { getTopicXQuery } from "@/lib/x-search"

export type ViralXPost = {
  id: string
  url: string
  text: string
  authorName?: string
  username?: string
  createdAt?: string
  score?: number
  metrics?: {
    likes?: number
    reposts?: number
    replies?: number
    quotes?: number
  }
}

const X_TIMEOUT_MS = 6500

function scorePost(metrics?: {
  like_count?: number
  retweet_count?: number
  reply_count?: number
  quote_count?: number
}) {
  if (!metrics) return 0
  return (
    (metrics.like_count || 0) +
    (metrics.retweet_count || 0) * 2 +
    (metrics.quote_count || 0) * 2 +
    (metrics.reply_count || 0) * 0.5
  )
}

export async function fetchViralXPostsForTopic(topicId: string) {
  const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || process.env.TWITTER_API_BEARER_TOKEN
  if (!token) return [] satisfies ViralXPost[]

  const topic = topics.find((item) => item.id === topicId)
  if (!topic) return [] satisfies ViralXPost[]

  const url = new URL("https://api.twitter.com/2/tweets/search/recent")
  url.searchParams.set("query", `${getTopicXQuery(topic)} lang:en -is:retweet -is:reply`)
  url.searchParams.set("max_results", "25")
  url.searchParams.set("tweet.fields", "created_at,public_metrics")
  url.searchParams.set("expansions", "author_id")
  url.searchParams.set("user.fields", "name,username")

  const response = await fetch(url, {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(X_TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": "InvertedWorldXSignals/1.0",
    },
  })

  if (!response.ok) return [] satisfies ViralXPost[]

  const data = (await response.json()) as {
    data?: Array<{
      id: string
      text: string
      author_id?: string
      created_at?: string
      public_metrics?: {
        like_count?: number
        retweet_count?: number
        reply_count?: number
        quote_count?: number
      }
    }>
    includes?: {
      users?: Array<{
        id: string
        name?: string
        username?: string
      }>
    }
  }

  const users = new Map((data.includes?.users || []).map((user) => [user.id, user]))

  return (data.data || [])
    .map((post) => {
      const user = post.author_id ? users.get(post.author_id) : undefined
      const username = user?.username
      const score = scorePost(post.public_metrics)

      return {
        id: post.id,
        url: `https://x.com/${username || "i"}/status/${post.id}`,
        text: post.text,
        authorName: user?.name,
        username,
        createdAt: post.created_at,
        score,
        metrics: {
          likes: post.public_metrics?.like_count,
          reposts: post.public_metrics?.retweet_count,
          replies: post.public_metrics?.reply_count,
          quotes: post.public_metrics?.quote_count,
        },
      } satisfies ViralXPost
    })
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, 3)
}
