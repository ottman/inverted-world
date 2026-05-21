import type { Metadata } from "next"
import Script from "next/script"
import { ArrowLeft, ExternalLink, Play } from "lucide-react"
import { notFound } from "next/navigation"
import { archiveSurface, InvertedPageShell, XIcon, type BreakingItem } from "@/components/inverted-page-shell"
import { getArchiveVideo, getRecommendedArchiveVideos } from "@/lib/deep-archive"
import { buildVideoDossier, videoDossierJsonLd } from "@/lib/video-dossier"
import { fetchLiveArticlesForTopic } from "@/lib/live-articles"
import { fetchViralXPostsForTopic } from "@/lib/x-posts"
import {
  getYouTubeTranscript,
  groupTranscriptSegments,
  transcriptExcerpt,
  type YouTubeTranscript,
} from "@/lib/youtube-transcript"
import { cn } from "@/lib/utils"
import type { ChannelVideo, ContentTopic } from "@/data/inverted-world"

type PageProps = {
  params: {
    videoId: string
  }
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

function formatTranscriptTime(seconds: number) {
  const safeSeconds = Math.max(Math.floor(seconds), 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

function transcriptDescription(video: ChannelVideo, transcript: YouTubeTranscript, fallback: string) {
  const excerpt = transcriptExcerpt(transcript, 260)
  if (excerpt) return excerpt
  return fallback || `Watch and research ${video.title} from Tales From the Inverted World.`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const video = await getArchiveVideo(params.videoId)
  if (!video) {
    return {
      title: "Inverted World archive",
    }
  }

  const dossier = buildVideoDossier(video)
  const synopsis = buildSynopsis(video, dossier.topic).join(" ")
  const transcript = await getYouTubeTranscript(video.videoId)
  const description = transcriptDescription(video, transcript, synopsis)
  const url = `/archive/${params.videoId}`

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
  const video = await getArchiveVideo(params.videoId)
  if (!video) notFound()

  const dossier = buildVideoDossier(video)
  const canonicalUrl = `https://www.inverted.world/archive/${params.videoId}`
  const synopsis = buildSynopsis(video, dossier.topic)
  const [transcript, liveArticles, xPosts, recommendedVideos] = await Promise.all([
    getYouTubeTranscript(video.videoId),
    fetchLiveArticlesForTopic(dossier.topic.id, dossier.topic.query.replaceAll('"', "")).catch(() => []),
    fetchViralXPostsForTopic(dossier.topic.id).catch(() => []),
    getRecommendedArchiveVideos(video, 8).catch(() => []),
  ])
  const breakingItems = [...xPostsToBreakingItems(xPosts), ...articleToBreakingItems(liveArticles)]

  return (
    <InvertedPageShell
      eyebrow="LIVE Mon - Thurs at 10 p.m. EST"
      title={video.title}
      breakingItems={breakingItems}
      heroTitle={video.title}
      heroDescription={`Transcript, source video, live coverage, and research links for the ${dossier.topic.title} file.`}
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

      <section className="grid gap-5 lg:grid-cols-[1.14fr_0.86fr]">
        <div className={cn("p-3", archiveSurface)}>
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
        </div>

        <aside className={cn("p-5", archiveSurface)}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">{video.date || "archive"}</p>
          <h2 className="iw-serif mt-4 text-4xl leading-tight text-[#fff8e6]">Episode record</h2>
          <p className="mt-4 text-sm leading-6 text-[#f4efe2]/68">{synopsis[0]}</p>
          <div className="mt-6 grid gap-2 text-xs uppercase tracking-[0.14em] text-[#f4efe2]/48">
            <span>topic: {dossier.topic.title}</span>
            <span>source: Tales From the Inverted World</span>
            <span>format: video + transcript + research links</span>
            <span>transcript: {transcript.available ? `${transcript.language || "captions"} / ${transcript.source || "youtube"}` : "not publicly available"}</span>
          </div>
        </aside>
      </section>

      <article className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className={cn("p-5 sm:p-6", archiveSurface)}>
          <TranscriptSection video={video} transcript={transcript} synopsis={synopsis} />
        </div>

        <aside className="grid h-fit gap-5">
          <section className={cn("p-5", archiveSurface)}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">Recommended videos</h2>
            <div className="mt-4 grid gap-3">
              {recommendedVideos.map((recommended) => (
                <a
                  key={recommended.videoId || recommended.href}
                  href={recommended.videoId ? `/archive/${recommended.videoId}` : recommended.href}
                  className="group grid grid-cols-[86px_minmax(0,1fr)] gap-3 bg-[#070706]/24 p-2 transition hover:bg-[#070706]/46"
                >
                  <span className="relative block aspect-video overflow-hidden bg-[#050504]/70">
                    {recommended.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={recommended.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-78" />
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-[#070706]/22">
                      <Play className="h-4 w-4 fill-[#fff8e6] text-[#fff8e6]" />
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-semibold leading-5 text-[#fff8e6] group-hover:text-[#df2f2f]">
                      {recommended.title}
                    </span>
                    <span className="mt-2 block text-xs uppercase tracking-[0.14em] text-[#f4efe2]/42">
                      {recommended.date || "Tales upload"}
                    </span>
                  </span>
                </a>
              ))}
              {!recommendedVideos.length && (
                <a
                  href="https://www.youtube.com/@TalesfromtheInvertedWorld"
                  target="_blank"
                  rel="noreferrer"
                  className="group block bg-[#070706]/24 p-3 text-sm font-semibold leading-5 text-[#fff8e6] transition hover:bg-[#070706]/46 hover:text-[#df2f2f]"
                >
                  More Tales From The Inverted World videos
                </a>
              )}
            </div>
          </section>

          {!!liveArticles.length && (
            <section className={cn("p-5", archiveSurface)}>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">Current coverage</h2>
              <div className="mt-4 grid gap-2">
                {liveArticles.slice(0, 5).map((article) => (
                  <a
                    key={article.id}
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group block bg-[#070706]/24 p-3 transition hover:bg-[#070706]/46"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="iw-serif text-xl leading-[1.05] text-[#fff8e6] group-hover:text-[#df2f2f]">
                        {article.title}
                      </span>
                      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#f4efe2]/38" />
                    </span>
                    <span className="mt-2 block text-xs uppercase tracking-[0.14em] text-[#f4efe2]/42">
                      {article.source}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className={cn("p-5", archiveSurface)}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#fff8e6]">
                <XIcon className="h-4 w-4 text-[#df2f2f]" />
                X signal
              </h2>
              <a
                href={`/x/${dossier.topic.id}`}
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#dff7ff] transition hover:text-[#df2f2f]"
              >
                Signal page
              </a>
            </div>
            <div className="grid gap-3">
              {xPosts.slice(0, 2).map((post) => (
                <article key={post.id || post.url} className="relative overflow-hidden bg-black p-2">
                  <a href={`/x/${post.topicId || dossier.topic.id}`} className="absolute inset-0 z-10" aria-label={`Open ${dossier.topic.title} X signal stream`} />
                  <div className="iw-compact-tweet">
                    <blockquote
                      className="twitter-tweet iw-tweet-blockquote"
                      data-theme="dark"
                      data-dnt="true"
                      data-cards="hidden"
                      data-conversation="none"
                      data-width="260"
                    >
                      <a href={post.url}>{post.text}</a>
                    </blockquote>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </article>
      <Script src="https://platform.twitter.com/widgets.js" strategy="lazyOnload" />
    </InvertedPageShell>
  )
}

function TranscriptSection({
  video,
  transcript,
  synopsis,
}: {
  video: ChannelVideo
  transcript: YouTubeTranscript
  synopsis: string[]
}) {
  if (!transcript.available) {
    return (
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Transcript</p>
        <h2 className="iw-serif mt-4 text-4xl leading-tight text-[#fff8e6] sm:text-5xl">{video.title}</h2>
        <div className="mt-5 grid max-w-3xl gap-4">
          <p className="text-sm leading-7 text-[#f4efe2]/72">
            No public YouTube captions are available for this upload yet. Until a transcript is available, use the
            original video, the current coverage, and the research links on this page as the source trail.
          </p>
          {synopsis.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-7 text-[#f4efe2]/72">
              {paragraph}
            </p>
          ))}
        </div>
      </section>
    )
  }

  const groups = groupTranscriptSegments(transcript.segments)

  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Transcript</p>
      <h2 className="iw-serif mt-4 text-4xl leading-tight text-[#fff8e6] sm:text-5xl">{video.title}</h2>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#f4efe2]/48">
        {transcript.language || "captions"} / {transcript.source || "youtube"} / refreshed daily
      </p>
      <div className="mt-6 grid gap-5" itemProp="transcript">
        {groups.map((group) => (
          <p key={`${group.start}-${group.text.slice(0, 18)}`} className="grid gap-2 text-sm leading-7 text-[#f4efe2]/76 sm:grid-cols-[72px_minmax(0,1fr)]">
            <a
              href={`${video.href}&t=${Math.floor(group.start)}s`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold uppercase tracking-[0.12em] text-[#df2f2f] transition hover:text-[#fff8e6]"
            >
              {formatTranscriptTime(group.start)}
            </a>
            <span>{group.text}</span>
          </p>
        ))}
      </div>
    </section>
  )
}
