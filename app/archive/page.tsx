import { ArchiveOnlyPage } from "@/components/archive-only-page"
import { getDeepArchive } from "@/lib/deep-archive"
import { fetchLiveArticlesByTopic } from "@/lib/live-articles"
import { maybeStartNewsRefresh } from "@/lib/recursiv/news-refresh"
import { fetchViralXPostsByTopic } from "@/lib/x-posts"
import { getYouTubeLiveStatus } from "@/lib/youtube-live"

export const dynamic = "force-dynamic"
export const revalidate = 300

export default async function ArchivePage() {
  const refreshKickoff = maybeStartNewsRefresh("archive-home").catch(() => null)
  const [initialArchive, initialTopicFeeds, initialTopicXPosts, liveStatus] = await Promise.all([
    getDeepArchive({ limit: 1000, maxLimit: 1000, allowProviderFallbacks: false }),
    fetchLiveArticlesByTopic({ allowProviderFallbacks: false, limitPerTopic: 12 }).catch(() => ({})),
    fetchViralXPostsByTopic({ allowProviderFallbacks: false, limitPerTopic: 18 }).catch(() => ({})),
    getYouTubeLiveStatus({ allowProviderFallbacks: false }).catch(() => null),
  ])
  void refreshKickoff

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
