import { ArchiveOnlyPage } from "@/components/archive-only-page"
import { topics } from "@/data/inverted-world"
import { getDeepArchive } from "@/lib/deep-archive"
import { fetchLiveArticlesForTopic } from "@/lib/live-articles"
import { fetchViralXPostsForTopic } from "@/lib/x-posts"
import { getYouTubeLiveStatus } from "@/lib/youtube-live"

export const dynamic = "force-dynamic"
export const revalidate = 300

export default async function ArchivePage() {
  const [initialArchive, topicFeeds, topicXPosts, liveStatus] = await Promise.all([
    getDeepArchive({ limit: 1000, maxLimit: 1000 }),
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
    getYouTubeLiveStatus().catch(() => null),
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
      initialLiveVideo={
        liveStatus?.isLive && liveStatus.videoId
          ? {
              title: liveStatus.title || "Inverted World Live",
              date: "live",
              href: liveStatus.url || `https://www.youtube.com/watch?v=${liveStatus.videoId}`,
              topicId: "uap-disclosure",
              source: "YouTube",
              videoId: liveStatus.videoId,
              embedUrl: `https://www.youtube.com/embed/${liveStatus.videoId}?rel=0&autoplay=1`,
              thumbnail: `https://i.ytimg.com/vi/${liveStatus.videoId}/hqdefault.jpg`,
              kind: "episode",
            }
          : undefined
      }
    />
  )
}
