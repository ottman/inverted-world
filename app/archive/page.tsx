import { ArchiveOnlyPage, type VideoRelatedStory } from "@/components/archive-only-page"
import { getDeepArchive } from "@/lib/deep-archive"
import { fetchRecursivClaimDossiers, type ClaimDossier, type ClaimSourceLink } from "@/lib/recursiv/content"
import { maybeStartNewsRefresh } from "@/lib/recursiv/news-refresh"
import { isExternalUrl, isGoogleNewsUrl, looksLikeArticleUrl, sourceLabel } from "@/lib/worldwire"
import { getYouTubeLiveStatus } from "@/lib/youtube-live"

export const dynamic = "force-dynamic"
export const revalidate = 300

function videoKey(video: { videoId?: string; href?: string }) {
  return video.videoId || video.href || ""
}

function sourceStoryFromDossier(dossier: ClaimDossier, source: ClaimSourceLink): VideoRelatedStory | null {
  if (!isExternalUrl(source.url) || isGoogleNewsUrl(source.url) || !looksLikeArticleUrl(source.url)) return null
  return {
    title: source.title || dossier.title,
    href: source.url,
    source: sourceLabel(source.outlet, source.url),
    publishedAt: source.publishedAt || dossier.publishedAt,
    topicId: dossier.topicId,
    dossierHref: `/news/${dossier.slug}`,
    dossierTitle: dossier.title,
    relatedVideoKeys: dossier.relatedVideos.map(videoKey).filter(Boolean),
  }
}

function relatedStoriesFromDossiers(dossiers: ClaimDossier[]): VideoRelatedStory[] {
  const seen = new Set<string>()
  const stories: VideoRelatedStory[] = []

  for (const dossier of dossiers) {
    const sourceStories = dossier.sourceLinks
      .map((source) => sourceStoryFromDossier(dossier, source))
      .filter((item): item is VideoRelatedStory => Boolean(item))
    const dossierFallback: VideoRelatedStory = {
      title: dossier.title,
      href: `/news/${dossier.slug}`,
      source: "Inverted World",
      publishedAt: dossier.publishedAt,
      topicId: dossier.topicId,
      dossierHref: `/news/${dossier.slug}`,
      dossierTitle: dossier.title,
      relatedVideoKeys: dossier.relatedVideos.map(videoKey).filter(Boolean),
    }

    for (const story of sourceStories.length ? sourceStories : [dossierFallback]) {
      const key = `${story.href.replace(/\/$/, "")}:${story.title.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      stories.push(story)
    }
  }

  return stories.slice(0, 120)
}

export default async function ArchivePage() {
  const refreshKickoff = maybeStartNewsRefresh("archive-home").catch(() => null)
  const [initialArchive, liveStatus, dossiers] = await Promise.all([
    getDeepArchive({ limit: 1000, maxLimit: 1000, allowProviderFallbacks: false }),
    getYouTubeLiveStatus({ allowProviderFallbacks: false }).catch(() => null),
    fetchRecursivClaimDossiers({ limit: 50 }).catch(() => []),
  ])
  void refreshKickoff

  return (
    <ArchiveOnlyPage
      initialArchive={{
        ...initialArchive,
        warnings: [],
      }}
      initialRelatedStories={relatedStoriesFromDossiers(dossiers || [])}
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
