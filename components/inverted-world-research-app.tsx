"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Archive,
  BadgeCheck,
  Brain,
  Database,
  ExternalLink,
  FileSearch,
  Globe2,
  Newspaper,
  PlayCircle,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldQuestion,
  Sparkles,
  Video,
  Youtube,
} from "lucide-react"
import Waves from "@/components/Waves"
import {
  channelProfile,
  fallbackCoverage,
  featuredVideos,
  getDocumentsForTopic,
  getTopic,
  getVideosForTopic,
  researchDocuments,
  socialLinks,
  topics,
  type ChannelVideo,
  type NewsCoverageItem,
} from "@/data/inverted-world"
import { cn } from "@/lib/utils"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  mode?: string
}

type NewsResponse = {
  coverage: NewsCoverageItem[]
  warnings?: string[]
}

const starterPrompts = [
  "Build a claim ledger for this topic.",
  "What government documents should we read first?",
  "Find the strongest skeptical and weird interpretations.",
]

const mediaFormats = [
  {
    icon: Newspaper,
    title: "AI news brief",
    copy: "A daily article that compares official records, outlet framing, and unresolved anomalies.",
  },
  {
    icon: Video,
    title: "Episode dossier",
    copy: "A source packet for producers: timeline, clips to pull, documents, counters, and open questions.",
  },
  {
    icon: FileSearch,
    title: "FOIA tracker",
    copy: "A running board of missing records, agency targets, request language, and response status.",
  },
  {
    icon: Brain,
    title: "Theory lab",
    copy: "Competing models scored by evidence quality, explanatory power, and unknowns.",
  },
]

const youtubeVideos = featuredVideos.filter((video) => video.source === "YouTube" && video.videoId)
const latestYouTubeVideo = youtubeVideos[0]

export function InvertedWorldResearchApp() {
  const [topicId, setTopicId] = useState(topics[0].id)
  const [prompt, setPrompt] = useState(starterPrompts[0])
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Select a lane, ask a research question, and I will build from channel context, public records, cross-outlet coverage, and open-source data. The posture is document-first and anomaly-friendly, not credulous.",
      mode: "briefing",
    },
  ])
  const [coverage, setCoverage] = useState<NewsCoverageItem[]>(fallbackCoverage)
  const [coverageWarnings, setCoverageWarnings] = useState<string[]>([])
  const [loadingCoverage, setLoadingCoverage] = useState(false)
  const [asking, setAsking] = useState(false)

  const topic = useMemo(() => getTopic(topicId), [topicId])
  const topicVideos = useMemo(() => getVideosForTopic(topicId), [topicId])
  const topicDocs = useMemo(() => getDocumentsForTopic(topicId), [topicId])

  async function loadCoverage(nextTopicId = topicId) {
    setLoadingCoverage(true)
    try {
      const response = await fetch(`/api/news?topic=${encodeURIComponent(nextTopicId)}`)
      const data = (await response.json()) as NewsResponse
      setCoverage(data.coverage?.length ? data.coverage : fallbackCoverage)
      setCoverageWarnings(data.warnings ?? [])
    } catch (error) {
      setCoverage(fallbackCoverage)
      setCoverageWarnings([error instanceof Error ? error.message : "Coverage refresh failed"])
    } finally {
      setLoadingCoverage(false)
    }
  }

  useEffect(() => {
    void loadCoverage(topicId)
  }, [topicId])

  async function askResearchAgent(customPrompt?: string) {
    const message = (customPrompt ?? prompt).trim()
    if (!message || asking) return

    setAsking(true)
    setMessages((current) => [...current, { role: "user", content: message }])
    setPrompt("")

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, topicId }),
      })
      const data = (await response.json()) as { answer?: string; mode?: string; error?: string }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer || data.error || "No response returned.",
          mode: data.mode,
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Research agent failed.",
          mode: "error",
        },
      ])
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070706] text-[#f4efe2]">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-75">
        <Waves
          lineColor="rgba(232, 180, 92, 0.26)"
          backgroundColor="#070706"
          waveSpeedX={0.007}
          waveSpeedY={0.004}
          waveAmpX={28}
          waveAmpY={15}
          xGap={14}
          yGap={42}
          friction={0.92}
          tension={0.004}
          maxCursorMove={70}
        />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_50%_0%,rgba(232,180,92,0.13),transparent_34%),linear-gradient(180deg,rgba(7,7,6,0.08),rgba(7,7,6,0.84)_62%,rgba(7,7,6,0.94))]" />

      <div className="relative z-10">
        <header className="sticky top-0 z-30 border-b border-[#f4efe2]/10 bg-transparent backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
            <a className="flex min-w-0 items-center gap-3" href="/">
              <img
                src="/images/inverted-world-banner-logo.png"
                alt="Inverted World"
                className="h-7 w-auto max-w-[58vw] shrink sm:h-10 sm:max-w-none"
              />
              <span className="hidden border-l border-[#f4efe2]/15 pl-3 text-xs uppercase tracking-[0.22em] text-[#e8b45c] md:block">
                Research OS
              </span>
            </a>
            <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#f4efe2]/64 lg:flex">
              <a className="transition hover:text-[#e8b45c]" href="#archive">
                Archive
              </a>
              <a className="transition hover:text-[#e8b45c]" href="#coverage">
                Coverage
              </a>
              <a className="transition hover:text-[#e8b45c]" href="#documents">
                Documents
              </a>
              <a className="transition hover:text-[#e8b45c]" href="#studio">
                Studio
              </a>
            </nav>
            <a
              href="https://www.youtube.com/@TalesfromtheInvertedWorld"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-[#e53935]/45 bg-[#e53935]/12 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2] transition hover:bg-[#e53935]/22"
            >
              <Radio className="h-4 w-4" />
              <span className="hidden sm:inline">Live</span>
            </a>
          </div>
        </header>

        <main>
          <section className="border-b border-[#f4efe2]/10">
            <div className="mx-auto grid min-h-[calc(100vh-65px)] max-w-7xl gap-6 px-3 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:gap-8 lg:px-8 lg:py-10">
              <div className="flex min-h-[520px] flex-col justify-between sm:min-h-[620px]">
                <div className="max-w-4xl pt-2 lg:pt-14">
                  <div className="mb-5 inline-flex items-center gap-2 border border-[#e8b45c]/35 bg-[#e8b45c]/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e8b45c]">
                    <ShieldQuestion className="h-4 w-4" />
                    Wanting to believe. Built to verify.
                  </div>
                  <h1 className="max-w-5xl text-4xl font-semibold leading-[1.02] tracking-normal text-[#fff8e6] sm:text-6xl lg:text-7xl">
                    Inverted World Intelligence Desk
                  </h1>
                  <p className="mt-5 max-w-3xl text-base leading-7 text-[#f4efe2]/72 sm:mt-6 sm:text-lg sm:leading-8">
                    {channelProfile.operatingLine} The system turns episodes, public records, news coverage,
                    FOIA targets, and source criticism into research-ready media.
                  </p>

                  <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-3">
                    <Metric icon={Archive} label="Archive" value={channelProfile.archiveCountLabel} />
                    <Metric icon={Database} label="Backend" value="Recursiv SDK: auth, DB, storage, agents" />
                    <Metric icon={Globe2} label="Coverage" value="News outlets plus official and open data" />
                  </div>
                </div>

                <div className="mt-8 grid gap-3 sm:mt-10 lg:grid-cols-2">
                  {topics.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setTopicId(item.id)}
                      className={cn(
                        "group min-h-[112px] border p-4 text-left transition",
                        item.id === topicId
                          ? "border-[#e8b45c]/70 bg-[#e8b45c]/12"
                          : "border-[#f4efe2]/12 bg-[#0f0e0c]/72 hover:border-[#e8b45c]/45 hover:bg-[#16130f]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#fff8e6]">{item.title}</span>
                        <Search className="h-4 w-4 text-[#e8b45c]" />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#f4efe2]/62">{item.signal}</p>
                    </button>
                  ))}
                </div>
              </div>

              <aside className="flex min-h-[540px] flex-col border border-[#f4efe2]/12 bg-[#0c0b0a]/78 backdrop-blur-xl sm:min-h-[620px]">
                <div className="border-b border-[#f4efe2]/10 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e8b45c]">
                        Research Agent
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-[#fff8e6]">{topic.title}</h2>
                    </div>
                    <BadgeCheck className="h-6 w-6 text-[#7dd3fc]" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#f4efe2]/66">{topic.stance}</p>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={cn(
                        "border p-4",
                        message.role === "user"
                          ? "border-[#e8b45c]/35 bg-[#21180d] sm:ml-8"
                          : "border-[#f4efe2]/12 bg-[#11100e] sm:mr-8",
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/50">
                        {message.role === "user" ? <Send className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {message.role === "user" ? "You" : message.mode || "Inverted AI"}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[#f4efe2]/78">{message.content}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#f4efe2]/10 p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {starterPrompts.map((item) => (
                      <button
                        key={item}
                        onClick={() => void askResearchAgent(item)}
                        className="border border-[#f4efe2]/12 bg-[#f4efe2]/5 px-3 py-2 text-xs text-[#f4efe2]/70 transition hover:border-[#e8b45c]/50 hover:text-[#fff8e6]"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void askResearchAgent()
                    }}
                  >
                    <textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      className="min-h-12 flex-1 resize-none border border-[#f4efe2]/14 bg-[#050504] px-3 py-3 text-sm text-[#fff8e6] outline-none transition placeholder:text-[#f4efe2]/30 focus:border-[#e8b45c]/70"
                      placeholder="Ask about documents, claims, coverage, or media angles..."
                    />
                    <button
                      type="submit"
                      disabled={asking}
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#e8b45c] text-[#120d07] transition hover:bg-[#ffd17a] disabled:opacity-50"
                      aria-label="Send research prompt"
                    >
                      {asking ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                  </form>
                </div>
              </aside>
            </div>
          </section>

          <section id="archive" className="border-b border-[#f4efe2]/10 bg-[#0a0908]/78 py-10 sm:py-14">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
              <SectionHeader
                eyebrow="Channel archive"
                title="The videos are embedded, not just referenced"
                copy="The full uploads playlist is live in the page, and the latest channel feed is exposed as playable research material for claim ledgers, transcript pulls, source graphs, and media packets."
              />

              <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.14fr)_minmax(320px,0.86fr)]">
                <div className="border border-[#f4efe2]/12 bg-[#11100e]/82 p-3 backdrop-blur-md sm:p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">
                        Full uploads playlist
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-[#fff8e6] sm:text-2xl">
                        Tales From the Inverted World
                      </h3>
                    </div>
                    <a
                      href="https://www.youtube.com/@TalesfromtheInvertedWorld/videos"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-[#f4efe2]/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/70 transition hover:border-[#e8b45c]/50 hover:text-[#fff8e6]"
                    >
                      <Youtube className="h-4 w-4 text-[#e53935]" />
                      YouTube
                    </a>
                  </div>
                  <div className="relative aspect-video overflow-hidden border border-[#f4efe2]/10 bg-[#050504]">
                    <iframe
                      className="absolute inset-0 h-full w-full"
                      src={channelProfile.youtubeUploadsEmbedUrl}
                      title="Tales From the Inverted World full uploads playlist"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#f4efe2]/52">
                    This playlist embed follows the channel uploads feed, so the archive surface is not limited to a
                    hand-picked card list.
                  </p>
                </div>

                <div className="border border-[#f4efe2]/12 bg-[#11100e]/82 p-4 backdrop-blur-md sm:p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">Active lane</p>
                  <h3 className="mt-3 text-2xl font-semibold text-[#fff8e6] sm:text-3xl">{topic.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-[#f4efe2]/68">{topic.signal}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {topics.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setTopicId(item.id)}
                        className={cn(
                          "border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
                          item.id === topicId
                            ? "border-[#e8b45c] bg-[#e8b45c] text-[#120d07]"
                            : "border-[#f4efe2]/12 text-[#f4efe2]/62 hover:border-[#e8b45c]/50",
                        )}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 space-y-3">
                    {(topicVideos.length ? topicVideos : youtubeVideos.slice(0, 3)).slice(0, 4).map((video) => (
                      <a
                        key={`topic-${video.title}-${video.date}`}
                        href={video.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-3 border border-[#f4efe2]/12 bg-[#050504]/72 p-3 transition hover:border-[#e8b45c]/55 hover:bg-[#16130f]"
                      >
                        <PlayCircle className="mt-1 h-4 w-4 shrink-0 text-[#e8b45c]" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-5 text-[#fff8e6]">{video.title}</span>
                          <span className="mt-1 block text-xs text-[#f4efe2]/44">
                            {video.source} | {video.date}
                          </span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {latestYouTubeVideo && (
                <div className="mt-5 border border-[#f4efe2]/12 bg-[#11100e]/82 p-3 backdrop-blur-md sm:p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">
                        Latest embedded upload
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-[#fff8e6] sm:text-2xl">
                        {latestYouTubeVideo.title}
                      </h3>
                    </div>
                    <a
                      href={latestYouTubeVideo.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-[#f4efe2]/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/70 transition hover:border-[#e8b45c]/50 hover:text-[#fff8e6]"
                    >
                      Open
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <VideoEmbed video={latestYouTubeVideo} priority />
                </div>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {youtubeVideos.slice(1, 10).map((video) => (
                  <VideoEmbed key={`${video.videoId}-${video.date}`} video={video} />
                ))}
              </div>
            </div>
          </section>

          <section id="coverage" className="border-b border-[#f4efe2]/10 py-10 sm:py-14">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <SectionHeader
                  eyebrow="AI news generator"
                  title="Coverage across outlets and records"
                  copy="The app asks what news outlets are saying, then anchors the story against government documents, legal records, scientific sources, and archives."
                />
                <button
                  onClick={() => void loadCoverage()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#7dd3fc]/40 bg-[#7dd3fc]/10 px-4 text-sm font-semibold text-[#dff7ff] transition hover:bg-[#7dd3fc]/18"
                >
                  <RefreshCw className={cn("h-4 w-4", loadingCoverage && "animate-spin")} />
                  Refresh coverage
                </button>
              </div>
              <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {coverage.slice(0, 12).map((item, index) => (
                  <a
                    key={`${item.url}-${index}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[142px] border border-[#f4efe2]/12 bg-[#0f0e0c]/82 p-4 transition hover:border-[#7dd3fc]/55 hover:bg-[#131a1d]"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          "inline-flex items-center border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                          item.lane === "news" && "border-[#e8b45c]/30 text-[#e8b45c]",
                          item.lane === "official" && "border-[#7dd3fc]/30 text-[#7dd3fc]",
                          item.lane === "science" && "border-[#8ee6a8]/30 text-[#8ee6a8]",
                          item.lane === "archive" && "border-[#d8b4fe]/30 text-[#d8b4fe]",
                        )}
                      >
                        {item.lane}
                      </span>
                      <span className="truncate text-xs text-[#f4efe2]/44">{item.outlet}</span>
                    </div>
                    <h4 className="text-sm font-semibold leading-6 text-[#fff8e6]">{item.title}</h4>
                    {(item.publishedAt || item.sourceCountry) && (
                      <p className="mt-3 text-xs text-[#f4efe2]/44">
                        {[item.publishedAt, item.sourceCountry].filter(Boolean).join(" | ")}
                      </p>
                    )}
                  </a>
                ))}
              </div>
              {coverageWarnings.length > 0 && (
                <p className="mt-4 text-sm text-[#e8b45c]/72">{coverageWarnings.join(" | ")}</p>
              )}
            </div>
          </section>

          <section id="documents" className="border-b border-[#f4efe2]/10 bg-[#0a0908]/78 py-10 sm:py-14">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
              <SectionHeader
                eyebrow="Primary-source layer"
                title="Government documents and open-source data first"
                copy="The AI should cite records, show absences, and keep claims in the right evidentiary lane."
              />
              <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(topicDocs.length ? topicDocs : researchDocuments).slice(0, 9).map((doc) => (
                  <a
                    key={doc.url}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[132px] border border-[#f4efe2]/12 bg-[#11100e] p-4 transition hover:border-[#e8b45c]/55 hover:bg-[#16130f]"
                  >
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-[#f4efe2]/48">
                      <FileSearch className="h-4 w-4 text-[#e8b45c]" />
                      {doc.kind}
                    </div>
                    <h4 className="text-base font-semibold leading-6 text-[#fff8e6]">{doc.title}</h4>
                    <p className="mt-2 text-sm text-[#f4efe2]/50">{doc.source}</p>
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section id="studio" className="py-10 sm:py-14">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
              <SectionHeader
                eyebrow="Media studio"
                title="A whole AI-generated news system"
                copy="The production loop is content ingestion, source expansion, document checks, narrative split, and publishable media outputs."
              />
              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {mediaFormats.map((format) => (
                  <div key={format.title} className="min-h-[202px] border border-[#f4efe2]/12 bg-[#0f0e0c]/86 p-5">
                    <format.icon className="h-7 w-7 text-[#e8b45c]" />
                    <h3 className="mt-5 text-xl font-semibold text-[#fff8e6]">{format.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#f4efe2]/64">{format.copy}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1fr]">
                <div className="border border-[#f4efe2]/12 bg-[#11100e] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">Recursiv under the hood</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {["Auth and saved research", "Database-backed archive", "Storage for docs and clips", "AI agents for synthesis"].map(
                      (item) => (
                        <div key={item} className="border border-[#f4efe2]/10 bg-[#050504] p-3 text-sm text-[#f4efe2]/72">
                          {item}
                        </div>
                      ),
                    )}
                  </div>
                </div>
                <div className="border border-[#f4efe2]/12 bg-[#11100e] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e8b45c]">Network</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {socialLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="border border-[#f4efe2]/12 px-3 py-2 text-sm text-[#f4efe2]/70 transition hover:border-[#e8b45c]/50 hover:text-[#fff8e6]"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Archive
  label: string
  value: string
}) {
  return (
    <div className="min-h-[116px] border border-[#f4efe2]/12 bg-[#0f0e0c]/78 p-4">
      <Icon className="h-5 w-5 text-[#e8b45c]" />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#f4efe2]/44">{label}</p>
      <p className="mt-2 text-sm leading-5 text-[#fff8e6]">{value}</p>
    </div>
  )
}

function VideoEmbed({ video, priority = false }: { video: ChannelVideo; priority?: boolean }) {
  if (!video.embedUrl) {
    return (
      <a
        href={video.href}
        target="_blank"
        rel="noreferrer"
        className="block min-h-[132px] border border-[#f4efe2]/12 bg-[#11100e] p-4 transition hover:border-[#e8b45c]/55 hover:bg-[#16130f]"
      >
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[#f4efe2]/48">
          <span>{video.source}</span>
          <span>{video.date}</span>
        </div>
        <h4 className="text-base font-semibold leading-6 text-[#fff8e6]">{video.title}</h4>
      </a>
    )
  }

  return (
    <article className="overflow-hidden border border-[#f4efe2]/12 bg-[#11100e]/82 backdrop-blur-md">
      <div className="relative aspect-video bg-[#050504]">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={video.embedUrl}
          title={video.title}
          loading={priority ? "eager" : "lazy"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[#f4efe2]/48">
          <span>{video.kind === "short" ? "YouTube Short" : video.source}</span>
          <span>{video.date}</span>
        </div>
        <a
          href={video.href}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-start gap-2 text-base font-semibold leading-6 text-[#fff8e6] transition hover:text-[#e8b45c]"
        >
          <span>{video.title}</span>
          <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 opacity-60 transition group-hover:opacity-100" />
        </a>
      </div>
    </article>
  )
}

function SectionHeader({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string
  title: string
  copy: string
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e8b45c]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#fff8e6] sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-[#f4efe2]/66">{copy}</p>
    </div>
  )
}
