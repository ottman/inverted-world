import type { Metadata } from "next"
import { ArrowLeft, ArrowUpRight, Play } from "lucide-react"
import { archiveSurface, InvertedPageShell, type BreakingItem } from "@/components/inverted-page-shell"
import { getArchiveVideo, getRecommendedArchiveVideos } from "@/lib/deep-archive"
import { buildVideoDossier, videoDossierJsonLd } from "@/lib/video-dossier"
import { fetchLiveArticlesForTopic } from "@/lib/live-articles"
import { fetchViralXPostsForTopic } from "@/lib/x-posts"
import { getYouTubeTranscript, transcriptExcerpt, transcriptFromText, type YouTubeTranscript } from "@/lib/youtube-transcript"
import { cn } from "@/lib/utils"
import type { ChannelVideo, ContentTopic } from "@/data/inverted-world"

type PageProps = {
  params: Promise<{
    videoId: string
  }>
}

export const dynamic = "force-dynamic"
export const revalidate = 900

function compactVideoDescription(video: ChannelVideo) {
  const clean = video.description?.replace(/\s+/g, " ").trim()
  if (!clean) return ""
  return clean.length > 760 ? `${clean.slice(0, 757)}...` : clean
}

function buildSynopsis(video: ChannelVideo, topic: ContentTopic) {
  const description = compactVideoDescription(video)
  const format = video.kind === "short" ? "short" : "episode"
  const lead =
    description ||
    `This ${format} belongs to the ${topic.title} lane: ${topic.signal.toLowerCase()}. It is best used as a starting point for the claim, not the last word on the claim.`

  return [
    lead,
    `Research path: watch the source, then compare official records, skeptical coverage, archive material, and current reporting around ${topic.title.toLowerCase()}.`,
  ]
}

function articleToBreakingItems(
  articles: Awaited<ReturnType<typeof fetchLiveArticlesForTopic>>,
): BreakingItem[] {
  return articles.slice(0, 12).map((article) => ({
    title: article.title,
    href: article.sourceUrl,
    source: article.source,
  }))
}

function xPostsToBreakingItems(posts: Awaited<ReturnType<typeof fetchViralXPostsForTopic>>): BreakingItem[] {
  return posts
    .slice()
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, 12)
    .map((post) => ({
      title: post.text,
      href: `/x/${post.topicId || "uap-disclosure"}`,
      source: post.username ? `@${post.username}` : "X",
    }))
}

function transcriptDescription(video: ChannelVideo, transcript: YouTubeTranscript, fallback: string) {
  const excerpt = transcriptExcerpt(transcript, 260)
  if (excerpt) return excerpt
  return fallback || `Watch and research ${video.title} from Tales From the Inverted World.`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { videoId } = await params
  const video = await getArchiveVideo(videoId, { allowProviderFallbacks: false })
  if (!video) {
    return {
      title: "Tales archive video",
      robots: {
        index: false,
        follow: true,
      },
    }
  }

  const dossier = buildVideoDossier(video)
  const synopsis = buildSynopsis(video, dossier.topic).join(" ")
  const transcript = video.transcript
    ? transcriptFromText(video.videoId, video.transcript)
    : await getYouTubeTranscript(video.videoId, { allowProviderFallbacks: false })
  const description = transcriptDescription(video, transcript, synopsis)
  const url = `/archive/${videoId}`

  return {
    title: video.title,
    description,
    keywords: [
      video.title,
      dossier.topic.title,
      "Tales From the Inverted World",
      "Inverted World transcript",
      "paranormal research",
      "conspiracy research",
      "UFO",
      "UAP",
      "declassified documents",
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: video.title,
      description,
      url,
      type: "article",
      publishedTime: video.date || undefined,
      images: video.thumbnail ? [video.thumbnail] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      description,
      images: video.thumbnail ? [video.thumbnail] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  }
}

export default async function ArchiveVideoPage({ params }: PageProps) {
  const { videoId } = await params
  const video = await getArchiveVideo(videoId, { allowProviderFallbacks: false })
  if (!video) {
    const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
    return (
      <InvertedPageShell
        eyebrow="Tales archive"
        title="Tales archive video"
        breakingItems={[]}
        heroTitle="Tales archive video"
        heroDescription="This archive entry is being refreshed. The source video and surrounding archive remain available."
      >
        <div className="mb-6">
          <a
            href="/archive"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/58 transition hover:text-[#df2f2f]"
          >
            <ArrowLeft className="h-4 w-4" />
            Archive
          </a>
        </div>

        <section className={cn("grid gap-4 p-5 text-sm leading-6 text-[#f4efe2]/68", archiveSurface)}>
          <p>Continue with the original upload, then return to the archive for related Tales and current dossiers.</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#df2f2f]/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/18"
            >
              Watch on YouTube
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a href="/archive" className="inline-flex items-center gap-2 bg-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-black/54">
              Full archive
              <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
            </a>
            <a href="/news" className="inline-flex items-center gap-2 bg-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-black/54">
              News desk
              <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
            </a>
          </div>
        </section>
      </InvertedPageShell>
    )
  }

  const dossier = buildVideoDossier(video)
  const canonicalUrl = `https://www.inverted.world/archive/${videoId}`
  const [transcript, liveArticles, xPosts, recommendedVideos] = await Promise.all([
    video.transcript
      ? Promise.resolve(transcriptFromText(video.videoId, video.transcript))
      : getYouTubeTranscript(video.videoId, { allowProviderFallbacks: false }),
    fetchLiveArticlesForTopic(dossier.topic.id, dossier.topic.query.replaceAll('"', ""), {
      allowProviderFallbacks: false,
    }).catch(() => []),
    fetchViralXPostsForTopic(dossier.topic.id, { allowProviderFallbacks: false }).catch(() => []),
    getRecommendedArchiveVideos(video, 8, { allowProviderFallbacks: false }).catch(() => []),
  ])
  const breakingItems = [...xPostsToBreakingItems(xPosts), ...articleToBreakingItems(liveArticles)]

  return (
    <InvertedPageShell
      eyebrow="LIVE Mon - Thurs at 10 p.m. EST"
      title={video.title}
      breakingItems={breakingItems}
      heroTitle={video.title}
      heroDescription=""
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoDossierJsonLd(dossier, canonicalUrl, transcript)) }}
      />

      <div className="mb-6">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/58 transition hover:text-[#df2f2f]"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </a>
      </div>

      <section className={cn("p-2 sm:p-3", archiveSurface)}>
        <div className="relative aspect-video overflow-hidden bg-[#050504]/55">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={video.embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </section>

      {!!recommendedVideos.length && (
        <section className={cn("mt-5 p-3 sm:p-4", archiveSurface)}>
          <h2 className="iw-serif text-4xl leading-none text-[#fff8e6]">More Tales</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedVideos.map((recommended) => (
              <a
                key={recommended.videoId || recommended.href}
                href={recommended.videoId ? `/archive/${recommended.videoId}` : recommended.href}
                className="group overflow-hidden bg-[#050504]/36 transition hover:bg-[#070706]/62"
              >
                <span className="relative block aspect-video overflow-hidden bg-[#050504]/70">
                  {recommended.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={recommended.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-78" />
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-[#070706]/22 transition group-hover:bg-[#070706]/8">
                    <Play className="h-6 w-6 fill-[#fff8e6] text-[#fff8e6]" />
                  </span>
                </span>
                <span className="block p-3">
                  <span className="iw-serif line-clamp-3 text-xl leading-[1.05] text-[#fff8e6] group-hover:text-[#df2f2f]">
                    {recommended.title}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}
    </InvertedPageShell>
  )
}
