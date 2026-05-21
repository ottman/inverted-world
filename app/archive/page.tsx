import { ArchiveOnlyPage } from "@/components/archive-only-page"
import { topics } from "@/data/inverted-world"
import { getDeepArchive } from "@/lib/deep-archive"
import { fetchLiveArticlesForTopic } from "@/lib/live-articles"
import { fetchViralXPostsForTopic } from "@/lib/x-posts"

export const dynamic = "force-dynamic"
export const revalidate = 3600

export default async function ArchivePage() {
  const [initialArchive, topicFeeds, topicXPosts] = await Promise.all([
    getDeepArchive({ limit: 500, maxLimit: 500 }),
    Promise.allSettled(
      topics.map(async (topic) => ({
        topicId: topic.id,
        articles: await fetchLiveArticlesForTopic(topic.id, topic.query.replaceAll('"', "")),
      })),
    ),
    Promise.allSettled(
      topics.map(async (topic) => ({
        topicId: topic.id,
        posts: await fetchViralXPostsForTopic(topic.id),
      })),
    ),
  ])

  const initialTopicFeeds = Object.fromEntries(
    topicFeeds.map((result, index) => [
      topics[index].id,
      result.status === "fulfilled" ? result.value.articles : [],
    ]),
  )
  const initialTopicXPosts = Object.fromEntries(
    topicXPosts.map((result, index) => [
      topics[index].id,
      result.status === "fulfilled" ? result.value.posts : [],
    ]),
  )

  return (
    <ArchiveOnlyPage
      initialArchive={{
        ...initialArchive,
        warnings: [],
      }}
      initialTopicFeeds={initialTopicFeeds}
      initialTopicXPosts={initialTopicXPosts}
    />
  )
}
