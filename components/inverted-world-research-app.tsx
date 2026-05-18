"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  Archive,
  BadgeCheck,
  ExternalLink,
  Flame,
  KeyRound,
  LockKeyhole,
  Mail,
  PlayCircle,
  Radio,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserPlus,
  Video,
  X,
} from "lucide-react"
import Waves from "@/components/Waves"
import { intelligenceArticles, type IntelligenceArticle } from "@/data/intelligence-articles"
import {
  channelProfile,
  fallbackCoverage,
  featuredVideos,
  getDocumentsForTopic,
  getTopic,
  getVideosForTopic,
  researchDocuments,
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

type ArticlesResponse = {
  articles?: IntelligenceArticle[]
  warnings?: string[]
}

const starterPrompts = [
  "What is the strongest case that UAP retrieval rumors are real?",
  "Map Epstein network claims by evidence quality.",
  "What are the strangest AI control stories this week?",
  "Give me a skeptical read on Bermuda Triangle claims.",
]

const youtubeVideos = featuredVideos.filter((video) => video.source === "YouTube" && video.videoId)
const latestYouTubeVideo = youtubeVideos[0]

const surface = "border border-[#f4efe2]/12 bg-[#070706]/28 backdrop-blur-[2px]"
const hotSurface = "border border-[#e8b45c]/35 bg-[#120d07]/34 backdrop-blur-[2px]"

const thumbPalettes = [
  ["#050504", "#21180d", "#e8b45c"],
  ["#050504", "#141d20", "#7dd3fc"],
  ["#050504", "#1c1020", "#d8b4fe"],
  ["#050504", "#102017", "#8ee6a8"],
  ["#050504", "#230b0b", "#e53935"],
]

export function InvertedWorldResearchApp() {
  const [topicId, setTopicId] = useState(topics[0].id)
  const [prompt, setPrompt] = useState("Ask anything: UFOs, elite networks, AI control, cryptids, occult history...")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Ask anything. I will split record, rumor, weird read, skeptical read, and next searches.",
      mode: "claude-ready",
    },
  ])
  const [coverage, setCoverage] = useState<NewsCoverageItem[]>(fallbackCoverage)
  const [coverageWarnings, setCoverageWarnings] = useState<string[]>([])
  const [articles, setArticles] = useState<IntelligenceArticle[]>(intelligenceArticles)
  const [articleWarnings, setArticleWarnings] = useState<string[]>([])
  const [loadingCoverage, setLoadingCoverage] = useState(false)
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [asking, setAsking] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup")
  const [email, setEmail] = useState("")
  const [authMessage, setAuthMessage] = useState("")
  const [selectedArticle, setSelectedArticle] = useState<IntelligenceArticle | null>(null)

  const topic = useMemo(() => getTopic(topicId), [topicId])
  const topicVideos = useMemo(() => getVideosForTopic(topicId), [topicId])
  const topicDocs = useMemo(() => getDocumentsForTopic(topicId), [topicId])
  const featuredArticles = useMemo(
    () => articles.filter((article) => article.topicId === topicId).slice(0, 16),
    [articles, topicId],
  )

  const loadCoverage = useCallback(async (nextTopicId = topicId) => {
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
  }, [topicId])

  const loadArticles = useCallback(async () => {
    setLoadingArticles(true)
    try {
      const response = await fetch("/api/articles")
      const data = (await response.json()) as ArticlesResponse
      setArticles(data.articles?.length ? data.articles : intelligenceArticles)
      setArticleWarnings(data.warnings ?? [])
    } catch (error) {
      setArticles(intelligenceArticles)
      setArticleWarnings([error instanceof Error ? error.message : "Live intel refresh failed"])
    } finally {
      setLoadingArticles(false)
    }
  }, [])

  useEffect(() => {
    void loadCoverage(topicId)
  }, [loadCoverage, topicId])

  useEffect(() => {
    void loadArticles()
  }, [loadArticles])

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

  async function submitAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthMessage("")
    const response = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, mode: authMode }),
    })
    const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
    setAuthMessage(response.ok ? data.message || "Access request received." : data.error || "Try another email.")
  }

  function openAuth(mode: "login" | "signup") {
    setAuthMode(mode)
    setAuthOpen(true)
    setAuthMessage("")
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070706] text-[#f4efe2]">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-95">
        <Waves
          lineColor="rgba(232, 180, 92, 0.32)"
          backgroundColor="#070706"
          waveSpeedX={0.008}
          waveSpeedY={0.005}
          waveAmpX={30}
          waveAmpY={18}
          xGap={13}
          yGap={38}
          friction={0.92}
          tension={0.004}
          maxCursorMove={78}
        />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_50%_0%,rgba(232,180,92,0.11),transparent_32%),linear-gradient(180deg,rgba(7,7,6,0.04),rgba(7,7,6,0.58)_68%,rgba(7,7,6,0.78))]" />

      <div className="relative z-10">
        <header className="sticky top-0 z-30 border-b border-[#f4efe2]/10 bg-transparent backdrop-blur-[2px]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8">
            <a className="flex min-w-0 items-center gap-3" href="/">
              <Image
                src="/images/inverted-world-banner-logo.png"
                alt="Inverted World"
                width={1229}
                height={203}
                priority
                className="h-7 w-auto max-w-[54vw] shrink sm:h-10 sm:max-w-none"
              />
            </a>
            <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#f4efe2]/64 lg:flex">
              <a className="transition hover:text-[#e8b45c]" href="#intel">
                Intel
              </a>
              <a className="transition hover:text-[#e8b45c]" href="#archive">
                Archive
              </a>
              <a className="transition hover:text-[#e8b45c]" href="#sources">
                Sources
              </a>
            </nav>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuth("login")}
                className="hidden h-10 items-center gap-2 rounded-md border border-[#f4efe2]/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/72 transition hover:border-[#e8b45c]/45 hover:text-[#fff8e6] sm:inline-flex"
              >
                <LockKeyhole className="h-4 w-4" />
                Login
              </button>
              <button
                onClick={() => openAuth("signup")}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#e8b45c]/45 bg-[#e8b45c]/14 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#e8b45c]/24"
              >
                <UserPlus className="h-4 w-4" />
                Join
              </button>
            </div>
          </div>
        </header>

        <main>
          <section className="border-b border-[#f4efe2]/10">
            <div className="mx-auto grid min-h-[calc(100vh-65px)] max-w-7xl gap-5 px-3 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.96fr)] lg:px-8 lg:py-8">
              <div className="flex flex-col justify-between lg:min-h-[540px]">
                <div className="pt-2 lg:pt-12">
                  <div className="mb-5 inline-flex items-center gap-2 border border-[#e8b45c]/35 bg-[#070706]/24 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e8b45c] backdrop-blur-[2px]">
                    <Flame className="h-4 w-4" />
                    Live anomaly desk
                  </div>
                  <h1 className="max-w-5xl text-5xl font-semibold leading-[0.96] tracking-normal text-[#fff8e6] sm:text-7xl lg:text-8xl">
                    The Inverted World
                  </h1>
                  <p className="mt-5 max-w-2xl text-xl leading-8 text-[#f4efe2]/76 sm:text-2xl">
                    Believe nothing. Follow everything.
                  </p>

                  <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
                    <Stat icon={Archive} label="briefs" value={String(articles.length)} />
                    <Stat icon={Video} label="archive" value="live" />
                    <Stat icon={BadgeCheck} label="agent" value="Claude path" />
                  </div>
                </div>

                <div className="mt-8 hidden gap-3 lg:grid lg:grid-cols-2">
                  {topics.slice(0, 6).map((item) => (
                    <TopicButton key={item.id} item={item} active={item.id === topicId} onClick={() => setTopicId(item.id)} />
                  ))}
                </div>
              </div>

              <aside className={cn("flex min-h-[480px] flex-col lg:min-h-[560px]", hotSurface)}>
                <div className="border-b border-[#f4efe2]/10 p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e8b45c]">Ask anything</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#fff8e6]">{topic.title}</h2>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={cn(
                        "border p-4 backdrop-blur-[2px]",
                        message.role === "user"
                          ? "border-[#e8b45c]/35 bg-[#21180d]/42 sm:ml-8"
                          : "border-[#f4efe2]/12 bg-[#070706]/28 sm:mr-8",
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/50">
                        {message.role === "user" ? <Send className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {message.role === "user" ? "You" : message.mode || "agent"}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[#f4efe2]/82">{message.content}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#f4efe2]/10 p-4 sm:p-5">
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                    {starterPrompts.map((item) => (
                      <button
                        key={item}
                        onClick={() => void askResearchAgent(item)}
                        className="shrink-0 border border-[#f4efe2]/12 bg-[#070706]/22 px-3 py-2 text-xs text-[#f4efe2]/70 transition hover:border-[#e8b45c]/50 hover:text-[#fff8e6]"
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
                      className="min-h-12 flex-1 resize-none border border-[#f4efe2]/14 bg-[#050504]/58 px-3 py-3 text-sm text-[#fff8e6] outline-none transition placeholder:text-[#f4efe2]/30 focus:border-[#e8b45c]/70"
                      placeholder="Ask the agent..."
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

              <div className="grid gap-3 lg:hidden">
                {topics.slice(0, 6).map((item) => (
                  <TopicButton key={item.id} item={item} active={item.id === topicId} onClick={() => setTopicId(item.id)} />
                ))}
              </div>
            </div>
          </section>

          <section id="intel" className="border-b border-[#f4efe2]/10 py-10 sm:py-12">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
              <SectionBar
                kicker="Intel"
                title="100 briefs"
                action={
                  <button
                    onClick={() => void loadArticles()}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#7dd3fc]/35 bg-[#070706]/22 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#dff7ff] transition hover:bg-[#7dd3fc]/12"
                  >
                    <RefreshCw className={cn("h-4 w-4", loadingArticles && "animate-spin")} />
                    Refresh
                  </button>
                }
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(featuredArticles.length ? featuredArticles : articles.slice(0, 16)).map((article) => (
                  <ArticleCard key={article.id} article={article} onOpen={() => setSelectedArticle(article)} />
                ))}
              </div>
              {articleWarnings.length > 0 && (
                <p className="mt-4 text-xs text-[#e8b45c]/72">{articleWarnings.slice(0, 2).join(" | ")}</p>
              )}
            </div>
          </section>

          <section id="archive" className="border-b border-[#f4efe2]/10 py-10 sm:py-12">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
              <SectionBar
                kicker="Archive"
                title="Watch"
                action={
                  <a
                    href="https://www.youtube.com/@TalesfromtheInvertedWorld/videos"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#e53935]/35 bg-[#070706]/22 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#e53935]/12"
                  >
                    <Radio className="h-4 w-4" />
                    YouTube
                  </a>
                }
              />

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className={cn("p-3", surface)}>
                  <div className="relative aspect-video overflow-hidden border border-[#f4efe2]/10 bg-[#050504]/45">
                    <iframe
                      className="absolute inset-0 h-full w-full"
                      src={channelProfile.youtubeUploadsEmbedUrl}
                      title="Tales From the Inverted World uploads playlist"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                </div>
                <div className="grid gap-3">
                  {(topicVideos.length ? topicVideos : youtubeVideos.slice(0, 4)).slice(0, 4).map((video) => (
                    <a
                      key={`topic-${video.title}-${video.date}`}
                      href={video.href}
                      target="_blank"
                      rel="noreferrer"
                      className={cn("flex items-start gap-3 p-3 transition hover:border-[#e8b45c]/55", surface)}
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

              {latestYouTubeVideo && (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {youtubeVideos.slice(0, 6).map((video) => (
                    <VideoEmbed key={`${video.videoId}-${video.date}`} video={video} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section id="sources" className="py-10 sm:py-12">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
              <SectionBar
                kicker="Sources"
                title="Records"
                action={
                  <button
                    onClick={() => void loadCoverage()}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#7dd3fc]/35 bg-[#070706]/22 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#dff7ff] transition hover:bg-[#7dd3fc]/12"
                  >
                    <RefreshCw className={cn("h-4 w-4", loadingCoverage && "animate-spin")} />
                    Scan
                  </button>
                }
              />
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[...coverage.slice(0, 8), ...(topicDocs.length ? topicDocs : researchDocuments).slice(0, 4)].map((item, index) => {
                  const url = "url" in item ? item.url : item.url
                  const title = "title" in item ? item.title : "Untitled"
                  const source = "outlet" in item ? item.outlet : item.source
                  const lane = "lane" in item ? item.lane : item.kind
                  return (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn("min-h-[122px] p-4 transition hover:border-[#7dd3fc]/55", surface)}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.12em] text-[#f4efe2]/44">
                        <span>{lane}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </div>
                      <h4 className="line-clamp-3 text-sm font-semibold leading-6 text-[#fff8e6]">{title}</h4>
                      <p className="mt-2 text-xs text-[#f4efe2]/46">{source}</p>
                    </a>
                  )
                })}
              </div>
              {coverageWarnings.length > 0 && (
                <p className="mt-4 text-xs text-[#e8b45c]/72">{coverageWarnings.slice(0, 2).join(" | ")}</p>
              )}
            </div>
          </section>
        </main>
      </div>

      {authOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050504]/50 p-4 backdrop-blur-[3px]">
          <button className="absolute inset-0 cursor-default" aria-label="Close auth" onClick={() => setAuthOpen(false)} />
          <div className={cn("relative w-full max-w-md p-5", hotSurface)}>
            <button
              onClick={() => setAuthOpen(false)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#f4efe2]/12 text-[#f4efe2]/58 transition hover:text-[#fff8e6]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <KeyRound className="h-6 w-6 text-[#e8b45c]" />
            <h2 className="mt-4 text-2xl font-semibold text-[#fff8e6]">
              {authMode === "login" ? "Login" : "Join the desk"}
            </h2>
            <form onSubmit={submitAccess} className="mt-5 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/50">
                Email
              </label>
              <div className="flex gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 border border-[#f4efe2]/14 bg-[#050504]/58 px-3">
                  <Mail className="h-4 w-4 shrink-0 text-[#e8b45c]" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 min-w-0 flex-1 bg-transparent text-sm text-[#fff8e6] outline-none placeholder:text-[#f4efe2]/30"
                    placeholder="you@proton.me"
                    type="email"
                  />
                </div>
                <button className="h-12 rounded-md bg-[#e8b45c] px-4 text-sm font-semibold text-[#120d07] transition hover:bg-[#ffd17a]">
                  Send
                </button>
              </div>
              {authMessage && <p className="text-sm text-[#e8b45c]">{authMessage}</p>}
            </form>
          </div>
        </div>
      )}

      {selectedArticle && <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Archive; label: string; value: string }) {
  return (
    <div className={cn("min-h-[94px] p-3 sm:min-h-[104px] sm:p-4", surface)}>
      <Icon className="h-5 w-5 text-[#e8b45c]" />
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/44 sm:mt-4 sm:text-xs">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-5 text-[#fff8e6] sm:text-lg">{value}</p>
    </div>
  )
}

function TopicButton({
  item,
  active,
  onClick,
}: {
  item: (typeof topics)[number]
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group min-h-[86px] border p-4 text-left transition backdrop-blur-[2px] lg:min-h-[92px]",
        active
          ? "border-[#e8b45c]/70 bg-[#e8b45c]/13"
          : "border-[#f4efe2]/12 bg-[#070706]/24 hover:border-[#e8b45c]/45 hover:bg-[#070706]/34",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold uppercase tracking-[0.1em] text-[#fff8e6]">{item.title}</span>
        <Search className="h-4 w-4 text-[#e8b45c]" />
      </div>
      <p className="mt-3 line-clamp-1 text-sm text-[#f4efe2]/58">{item.signal}</p>
    </button>
  )
}

function SectionBar({
  kicker,
  title,
  action,
}: {
  kicker: string
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e8b45c]">{kicker}</p>
        <h2 className="mt-1 text-3xl font-semibold text-[#fff8e6]">{title}</h2>
      </div>
      {action}
    </div>
  )
}

function ArticleCard({ article, onOpen }: { article: IntelligenceArticle; onOpen: () => void }) {
  return (
    <article className={cn("overflow-hidden transition hover:border-[#e8b45c]/55", surface)}>
      <GeneratedThumbnail article={article} />
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.12em] text-[#f4efe2]/44">
          <span>{article.topic}</span>
          <span>{article.heat}</span>
        </div>
        <button onClick={onOpen} className="block w-full text-left">
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-[#fff8e6]">{article.title}</h3>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#f4efe2]/62">{article.deck}</p>
        </button>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={onOpen}
            className="text-xs font-semibold uppercase tracking-[0.12em] text-[#e8b45c] transition hover:text-[#ffd17a]"
          >
            Open
          </button>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#e8b45c] transition hover:text-[#ffd17a]"
          >
            <span className="truncate">{article.source}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        </div>
      </div>
    </article>
  )
}

function ArticleModal({ article, onClose }: { article: IntelligenceArticle; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050504]/50 p-3 backdrop-blur-[3px] sm:p-4">
      <button className="absolute inset-0 cursor-default" aria-label="Close brief" onClick={onClose} />
      <article className={cn("relative max-h-[92vh] w-full max-w-4xl overflow-y-auto", hotSurface)}>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#f4efe2]/12 bg-[#050504]/50 text-[#f4efe2]/58 transition hover:text-[#fff8e6]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <GeneratedThumbnail article={article} />
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.14em] text-[#f4efe2]/46">
            <span>{article.topic}</span>
            <span>{article.publishedAt}</span>
          </div>
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight text-[#fff8e6] sm:text-4xl">{article.title}</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#f4efe2]/70">{article.deck}</p>
          <div className="mt-6 grid gap-3">
            {article.body.map((paragraph) => (
              <p key={paragraph} className="border border-[#f4efe2]/12 bg-[#070706]/24 p-4 text-sm leading-6 text-[#f4efe2]/78">
                {paragraph}
              </p>
            ))}
          </div>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-md border border-[#e8b45c]/45 bg-[#e8b45c]/12 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#e8b45c]/22"
          >
            {article.source}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </article>
    </div>
  )
}

function GeneratedThumbnail({ article }: { article: IntelligenceArticle }) {
  const numericSeed = Number(article.id.replace(/\D/g, "")) || article.id.length
  const palette = thumbPalettes[numericSeed % thumbPalettes.length]
  return (
    <div
      className="relative h-36 overflow-hidden border-b border-[#f4efe2]/10"
      title={article.thumbnailPrompt}
      style={{
        background:
          `radial-gradient(circle at 70% 22%, ${palette[2]}66, transparent 28%), ` +
          `linear-gradient(135deg, ${palette[0]}, ${palette[1]} 58%, ${palette[2]})`,
      }}
    >
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(244,239,226,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(244,239,226,0.1)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-[#f4efe2]/40" />
      <div className="absolute left-3 top-3 border border-[#f4efe2]/24 bg-[#050504]/42 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#fff8e6]">
        {article.thumbnail.sigil}
      </div>
      <div className="absolute bottom-3 left-3 text-4xl font-extrabold uppercase tracking-normal text-[#fff8e6] drop-shadow">
        {article.thumbnail.glyph}
      </div>
      <div className="absolute bottom-3 right-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#050504]/80">
        IW
      </div>
    </div>
  )
}

function VideoEmbed({ video }: { video: ChannelVideo }) {
  if (!video.embedUrl) return null

  return (
    <article className={cn("overflow-hidden", surface)}>
      <div className="relative aspect-video bg-[#050504]/45">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={video.embedUrl}
          title={video.title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <a
        href={video.href}
        target="_blank"
        rel="noreferrer"
        className="group flex items-start justify-between gap-3 p-3 text-sm font-semibold leading-5 text-[#fff8e6] transition hover:text-[#e8b45c]"
      >
        <span>{video.title}</span>
        <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 opacity-60 transition group-hover:opacity-100" />
      </a>
    </article>
  )
}
