"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Waves from "@/components/Waves"
import { intelligenceArticles, type IntelligenceArticle } from "@/data/intelligence-articles"
import {
  channelProfile,
  featuredVideos,
  researchDocuments,
  socialLinks,
  type ChannelVideo,
  type ResearchDocument,
} from "@/data/inverted-world"
import { cn } from "@/lib/utils"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  mode?: string
  followUps?: string[]
}

type ArticlesResponse = {
  articles?: IntelligenceArticle[]
  warnings?: string[]
}

type AccessResponse = {
  authenticated?: boolean
  ok?: boolean
  error?: string
  message?: string
  warnings?: string[]
  member?: {
    id?: string
    email?: string
    name?: string
    agentId?: string
  }
}

const starterPrompts = [
  "What conspiracy should we investigate first?",
  "What is the strongest conspiracy case that still lacks the missing proof?",
  "Map the Epstein claims by evidence quality.",
  "What is the strangest true document in government archives?",
  "What is the Machine State hiding in plain sight?",
  "Ask me a question that starts a deep investigation.",
]

const laneMeta = {
  UAP: { code: "SKY-221", color: "#e8b45c", label: "Skywatch" },
  BLACK: { code: "VAULT-D", color: "#e8b45c", label: "Black Vault" },
  NET: { code: "WEB-172", color: "#e53935", label: "Power Web" },
  FIELD: { code: "STR-08", color: "#f4efe2", label: "High Strangeness" },
  TECH: { code: "MS-PAL", color: "#7dd3fc", label: "Machine State" },
  SPACE: { code: "OW-SOL", color: "#7dd3fc", label: "Off-World" },
  BIO: { code: "BIO-19", color: "#e53935", label: "Bio Vault" },
  INFRA: { code: "GRID-24", color: "#7dd3fc", label: "Hidden Grid" },
} as const

type LaneKey = keyof typeof laneMeta

const youtubeVideos = featuredVideos.filter((video) => video.source === "YouTube" && video.videoId && video.embedUrl)

export function InvertedWorldEditorialApp() {
  const [articles, setArticles] = useState<IntelligenceArticle[]>(intelligenceArticles)
  const [articleWarnings, setArticleWarnings] = useState<string[]>([])
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [activeVideo, setActiveVideo] = useState<ChannelVideo>(youtubeVideos[0])
  const [selectedArticle, setSelectedArticle] = useState<IntelligenceArticle | null>(null)
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "What door are we opening first: Skywatch, the Black Vault, the Power Web, the Machine State, High Strangeness, Off-World Signals, or something stranger?",
      mode: "truth-engine",
      followUps: [
        "Open Skywatch retrieval claims",
        "Map the Power Web evidence",
        "Start with MKULTRA and modern psyops",
      ],
    },
  ])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authMessage, setAuthMessage] = useState("")
  const [authBusy, setAuthBusy] = useState(false)
  const [memberEmail, setMemberEmail] = useState("")

  const leadArticles = useMemo(() => articles.slice(0, 12), [articles])
  const heroArticles = useMemo(() => leadArticles.slice(0, 3), [leadArticles])
  const tickerItems = useMemo(
    () =>
      leadArticles.slice(0, 8).map((article) => {
        const lane = getLane(article)
        return `${laneMeta[lane].code} -> ${article.title}`
      }),
    [leadArticles],
  )
  const assistantMessages = messages.filter((message) => message.role === "assistant")
  const latestAnswer = assistantMessages[assistantMessages.length - 1]

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

  const loadSession = useCallback(async () => {
    const response = await fetch("/api/access").catch(() => null)
    if (!response?.ok) return
    const data = (await response.json().catch(() => ({}))) as AccessResponse
    if (data.authenticated && data.member?.email) {
      window.localStorage.setItem("inverted-world-member-email", data.member.email)
      setMemberEmail(data.member.email)
      if (data.member.name) setName(data.member.name)
      return
    }
    window.localStorage.removeItem("inverted-world-member-email")
    setMemberEmail("")
  }, [])

  useEffect(() => {
    const storedEmail = window.localStorage.getItem("inverted-world-member-email") || ""
    setMemberEmail(storedEmail)
    void loadSession()
    void loadArticles()
  }, [loadArticles, loadSession])

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
        body: JSON.stringify({ message, conversationId }),
      })
      const data = (await response.json()) as {
        answer?: string
        mode?: string
        error?: string
        followUps?: string[]
        conversationId?: string
      }
      if (data.conversationId) setConversationId(data.conversationId)
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer || data.error || "No response returned.",
          mode: data.mode,
          followUps: data.followUps,
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
    if (authBusy) return
    setAuthBusy(true)
    setAuthMessage("")
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, mode: authMode }),
      })
      const data = (await response.json().catch(() => ({}))) as AccessResponse
      if (response.ok) {
        const nextEmail = data.member?.email || email.trim().toLowerCase()
        window.localStorage.setItem("inverted-world-member-email", nextEmail)
        setMemberEmail(nextEmail)
        setName(data.member?.name || name)
        setAuthMessage(data.warnings?.length ? `Signed in. ${data.warnings[0]}` : data.message || "Research desk unlocked.")
        window.setTimeout(() => setAuthOpen(false), data.warnings?.length ? 1400 : 650)
        return
      }
      setAuthMessage(data.error || "Recursiv auth failed.")
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    await fetch("/api/access", { method: "DELETE" }).catch(() => null)
    window.localStorage.removeItem("inverted-world-member-email")
    setMemberEmail("")
    setConversationId(null)
    setAuthOpen(false)
  }

  function openAuth(mode: "login" | "signup") {
    setAuthMode(mode)
    setAuthOpen(true)
    setAuthMessage("")
  }

  return (
    <div className="iw-redesign-root">
      <Background />
      <div className="iw-shell">
        <Ticker items={tickerItems} />
        <Masthead memberEmail={memberEmail} openAuth={openAuth} />
        {memberEmail && (
          <div className="iw-member-banner">
            <span>desk unlocked</span>
            <strong>{memberEmail}</strong>
            <button onClick={() => void signOut()}>sign out</button>
          </div>
        )}

        <section className="iw-hero iw-command-hero" id="engine">
          <div className="iw-hero-grid">
            <div className="iw-hero-left">
              <div className="iw-hero-kicker">
                <span className="iw-hot-dot" />
                live ai research desk / {leadArticles.length} open signals
              </div>
              <h1 className="iw-hero-headline iw-hero-serif">
                <span>Ask the</span>
                <br />
                <span className="iw-accent-text">weird question.</span>
              </h1>
              <p className="iw-hero-deck">
                A fast Claude/OpenRouter research desk for conspiracies, paranormal claims, classified history, and the open-source record.
                It separates claim, receipt, counter-read, and next verification step.
              </p>
              <div className="iw-hero-actions">
                <button
                  className="iw-command-primary"
                  onClick={() => void askResearchAgent("Ask me one provocative investigation question about the hidden structure of the week.")}
                >
                  start a case
                </button>
                <a className="iw-command-secondary" href="/news">
                  live news map
                </a>
                <a className="iw-command-secondary" href="/archive">
                  video archive
                </a>
              </div>
              <div className="iw-hero-stats">
                <Stat label="briefs" value={String(articles.length)} />
                <Stat label="archive" value="LIVE" />
                <Stat label="sources" value={String(researchDocuments.length)} />
                <Stat label="desk" value={memberEmail ? "OPEN" : "JOIN"} />
              </div>
              <div className="iw-live-strip" aria-label="Live research signals">
                {heroArticles.map((article) => (
                  <LiveSignalCard key={article.id} article={article} onOpen={() => setSelectedArticle(article)} />
                ))}
              </div>
            </div>

            <aside className="iw-hero-right">
              <TruthEngine
                asking={asking}
                prompt={prompt}
                latestAnswer={latestAnswer}
                messages={messages}
                setPrompt={setPrompt}
                askResearchAgent={askResearchAgent}
              />
            </aside>
          </div>
          <div className="iw-method-rail" aria-label="Research method">
            <MethodRailItem step="01" title="Ask anything" text="No filter menu. Start with the claim." />
            <MethodRailItem step="02" title="Split signal" text="Receipts, rumor, counter-read, missing proof." />
            <MethodRailItem step="03" title="Follow sources" text="News, government docs, archives." />
            <MethodRailItem step="04" title="Build media" text="Article, thumbnail, dossier, next questions." />
          </div>
        </section>

        <section className="iw-section" id="intel">
          <SectionHeader
            kicker="section 01"
            title="The dossier"
            sub="Numbered briefs, live sources, and source-first framing."
            right={
              <button className="iw-pill" onClick={() => void loadArticles()}>
                {loadingArticles ? "refreshing..." : "refresh"}
              </button>
            }
          />
          <ol className="iw-dossier">
            {leadArticles.map((article, index) => (
              <DossierItem key={article.id} article={article} index={index} onOpen={() => setSelectedArticle(article)} />
            ))}
          </ol>
          {articleWarnings.length > 0 && <p className="iw-warning">{articleWarnings.slice(0, 2).join(" | ")}</p>}
        </section>

        <section className="iw-section" id="watch">
          <SectionHeader
            kicker="section 02"
            title="The archive"
            sub="Episodes, shorts, and the live uploads playlist from Tales From the Inverted World."
            right={
              <a className="iw-pill" href="/archive">
                deep archive
              </a>
            }
          />
          <div className="iw-watch">
            <div className="iw-watch-main">
              <div className="iw-watch-frame">
                <iframe
                  src={activeVideo.embedUrl || channelProfile.youtubeUploadsEmbedUrl}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
                <div className="iw-watch-overlay">
                  <Sigil lane={getVideoLane(activeVideo)} />
                  <span className="iw-watch-date">{activeVideo.date}</span>
                </div>
              </div>
              <div className="iw-watch-meta">
                <div className="iw-watch-num">No. {String(youtubeVideos.indexOf(activeVideo) + 1).padStart(2, "0")}</div>
                <h3 className="iw-watch-title iw-hero-serif">{activeVideo.title}</h3>
              </div>
            </div>
            <ol className="iw-watch-list">
              {youtubeVideos.slice(0, 8).map((video, index) => (
                <li
                  key={video.videoId}
                  onClick={() => setActiveVideo(video)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setActiveVideo(video)
                    }
                  }}
                  className={cn("iw-watch-item", video.videoId === activeVideo.videoId && "iw-watch-item-active")}
                  role="button"
                  tabIndex={0}
                  aria-label={`Play ${video.title}`}
                >
                  <span className="iw-watch-rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="iw-watch-thumb">
                    <Image
                      src={video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`}
                      alt=""
                      fill
                      sizes="90px"
                      unoptimized
                    />
                  </span>
                  <span className="iw-watch-info">
                    <span className="iw-watch-info-meta">
                      <Sigil lane={getVideoLane(video)} />
                      <span className="iw-watch-info-time">{video.date}</span>
                    </span>
                    <span className="iw-watch-info-title">{video.title}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="iw-section" id="documents">
          <SectionHeader
            kicker="section 03"
            title="The filing cabinet"
            sub="Primary records and open-source databases the desk is cross-checking right now."
            right={
              <a className="iw-pill" href="/documents">
                source database
              </a>
            }
          />
          <div className="iw-docs">
            {researchDocuments.slice(0, 12).map((doc, index) => (
              <DocumentCard key={`${doc.source}-${doc.title}`} doc={doc} index={index} />
            ))}
          </div>
        </section>

        <Colophon />
      </div>

      {authOpen && (
        <AccessModal
          authMode={authMode}
          email={email}
          name={name}
          password={password}
          authMessage={authMessage}
          authBusy={authBusy}
          memberEmail={memberEmail}
          setEmail={setEmail}
          setName={setName}
          setPassword={setPassword}
          setAuthMode={setAuthMode}
          setAuthOpen={setAuthOpen}
          submitAccess={submitAccess}
          signOut={signOut}
        />
      )}
      {selectedArticle && <BriefModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
    </div>
  )
}

function Background() {
  return (
    <div className="iw-bg" aria-hidden>
      <div className="iw-bg-canvas">
        <Waves
          lineColor="rgba(232,180,92,0.22)"
          backgroundColor="#070706"
          waveSpeedX={0.008}
          waveSpeedY={0.005}
          waveAmpX={24}
          waveAmpY={14}
          xGap={14}
          yGap={42}
          friction={0.92}
          tension={0.004}
          maxCursorMove={78}
        />
      </div>
      <div className="iw-bg-vignette" />
      <div className="iw-bg-grain" />
    </div>
  )
}

function Ticker({ items }: { items: string[] }) {
  const row = (items.length ? items : ["UAP-221 -> archive live"]).concat(items, items)
  return (
    <div className="iw-ticker">
      <div className="iw-ticker-mark">live</div>
      <div className="iw-ticker-track">
        <div className="iw-ticker-row">
          {row.map((item, index) => (
            <span key={`${item}-${index}`} className="iw-ticker-item">
              <span className="iw-ticker-dot">◇</span>
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="iw-ticker-time">
        <Clock />
      </div>
    </div>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <span>
      {now.toISOString().slice(11, 19)} <span className="iw-faded">ZULU</span>
    </span>
  )
}

function Masthead({
  memberEmail,
  openAuth,
}: {
  memberEmail: string
  openAuth: (mode: "login" | "signup") => void
}) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <header className="iw-mast">
      <div className="iw-mast-row">
        <div className="iw-mast-l">
          <span className="iw-accent-text">vol. iii</span>
          <span className="iw-divider">/</span>
          <span>issue 142</span>
          <span className="iw-divider">/</span>
          <span>{today}</span>
        </div>
        <div className="iw-mast-r">
          <a className="iw-mast-link" href="/news">
            news
          </a>
          <a className="iw-mast-link" href="/archive">
            archive
          </a>
          <a className="iw-mast-link" href="/documents">
            documents
          </a>
          <a className="iw-mast-link" href="#engine">
            truth engine
          </a>
          <button className="iw-mast-link iw-mast-link-btn" onClick={() => openAuth("login")}>
            {memberEmail ? "desk" : "login"}
          </button>
          <button className="iw-mast-join" onClick={() => openAuth("signup")}>
            <span className="iw-pulse" />
            {memberEmail ? "joined" : "join desk"}
          </button>
        </div>
      </div>
      <div className="iw-mast-logo-row">
        <a href="/" aria-label="Inverted World home">
          <Image
            src="/images/inverted-world-banner-logo.png"
            alt="Inverted World"
            width={1229}
            height={203}
            priority
            className="iw-mast-logo"
          />
        </a>
        <div className="iw-mast-tagline">
          <div className="iw-mast-tag-rule" />
          <div className="iw-mast-tag-text">
            <span>Evidence-first intelligence for the strange, classified, misreported,</span>
            <br />
            <span>and not-yet-understood. Records before narratives.</span>
          </div>
        </div>
      </div>
    </header>
  )
}

function TruthEngine({
  asking,
  prompt,
  latestAnswer,
  messages,
  setPrompt,
  askResearchAgent,
}: {
  asking: boolean
  prompt: string
  latestAnswer?: ChatMessage
  messages: ChatMessage[]
  setPrompt: (value: string) => void
  askResearchAgent: (customPrompt?: string) => Promise<void>
}) {
  return (
    <div className="iw-engine">
      <div className="iw-engine-head">
        <span className="iw-engine-sig">talk to the desk</span>
        <span className="iw-engine-status">
          Fast Claude/OpenRouter path. Recursiv logs the research trail.
        </span>
      </div>
      <form
        className="iw-engine-form"
        onSubmit={(event) => {
          event.preventDefault()
          void askResearchAgent()
        }}
      >
        <span className="iw-engine-caret">&gt;</span>
        <input
          className="iw-engine-input"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask anything: UAP, Epstein, MKULTRA, AI surveillance, occult history..."
        />
        <button type="submit" className="iw-engine-send" disabled={asking}>
          {asking ? "running..." : "ask"}
        </button>
      </form>
      <div className="iw-engine-chips">
        {starterPrompts.map((starter) => (
          <button key={starter} className="iw-chip" onClick={() => void askResearchAgent(starter)}>
            {starter}
          </button>
        ))}
      </div>
      {asking && (
        <div className="iw-thinking">
          <span className="iw-thinking-dot" />
          <span>reading the claim, source trail, and counter-read...</span>
        </div>
      )}
      {latestAnswer && (
        <div className="iw-engine-out">
          <Stripe label={latestAnswer.mode || "answer"} color="#e8b45c" text={latestAnswer.content} />
          {latestAnswer.followUps?.length ? (
            <div className="iw-engine-chips iw-engine-followups">
              {latestAnswer.followUps.map((followUp) => (
                <button key={followUp} className="iw-chip" onClick={() => void askResearchAgent(followUp)}>
                  {followUp}
                </button>
              ))}
            </div>
          ) : null}
          {messages.filter((message) => message.role === "user").length > 0 && (
            <Stripe
              label="last ask"
              color="#7dd3fc"
              text={messages.filter((message) => message.role === "user").slice(-1)[0]?.content || ""}
            />
          )}
        </div>
      )}
    </div>
  )
}

function SectionHeader({
  kicker,
  title,
  sub,
  right,
}: {
  kicker: string
  title: string
  sub?: string
  right?: React.ReactNode
}) {
  return (
    <div className="iw-secthead">
      <div className="iw-secthead-l">
        <div className="iw-secthead-kicker">{kicker}</div>
        <h2 className="iw-secthead-title iw-hero-serif">{title}</h2>
        {sub && <div className="iw-secthead-sub">{sub}</div>}
      </div>
      {right && <div className="iw-secthead-r">{right}</div>}
    </div>
  )
}

function LiveSignalCard({ article, onOpen }: { article: IntelligenceArticle; onOpen: () => void }) {
  const lane = getLane(article)
  return (
    <button className="iw-live-card" type="button" onClick={onOpen}>
      <span className="iw-live-card-top">
        <Sigil lane={lane} />
        <span>{article.heat}</span>
      </span>
      <span className="iw-live-card-title">{article.title}</span>
      <span className="iw-live-card-source">{article.source}</span>
    </button>
  )
}

function MethodRailItem({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className="iw-method-item">
      <span>{step}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

function DossierItem({ article, index, onOpen }: { article: IntelligenceArticle; index: number; onOpen: () => void }) {
  const lane = getLane(article)
  return (
    <li
      className="iw-doss-item"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open brief: ${article.title}`}
    >
      <div className="iw-doss-num">No. {String(index + 1).padStart(2, "0")}</div>
      <div className="iw-doss-body">
        <div className="iw-doss-meta">
          <Sigil lane={lane} />
          <span className="iw-stamp" style={{ color: laneMeta[lane].color, borderColor: `${laneMeta[lane].color}88` }}>
            {article.heat >= 96 ? "receipts+" : article.heat >= 86 ? "weird read" : "verify"}
          </span>
          <span className="iw-meta-source">{article.source}</span>
          <HeatBar heat={article.heat} />
        </div>
        <h3 className="iw-doss-title">{article.title}</h3>
        <p className="iw-doss-deck">{article.deck}</p>
      </div>
      <div className="iw-doss-cta">open</div>
    </li>
  )
}

function DocumentCard({ doc, index }: { doc: ResearchDocument; index: number }) {
  return (
    <a className="iw-doc" href={doc.url} target="_blank" rel="noreferrer">
      <div className="iw-doc-top">
        <span className="iw-doc-kind">{doc.kind}</span>
        <span className="iw-doc-id">doc-{String(index + 1).padStart(3, "0")}</span>
      </div>
      <h4 className="iw-doc-title">{doc.title}</h4>
      <div className="iw-doc-foot">
        <span>{doc.source}</span>
        <span className="iw-dot" />
        <span className="iw-accent-text">open ↗</span>
      </div>
    </a>
  )
}

function BriefModal({ article, onClose }: { article: IntelligenceArticle; onClose: () => void }) {
  const lane = getLane(article)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="iw-modal" onClick={onClose}>
      <article className="iw-modal-card" onClick={(event) => event.stopPropagation()}>
        <button className="iw-modal-x" onClick={onClose} aria-label="Close brief">
          x
        </button>
        <div className="iw-modal-meta">
          <Sigil lane={lane} size="lg" />
          <span className="iw-stamp iw-stamp-lg" style={{ color: laneMeta[lane].color, borderColor: `${laneMeta[lane].color}88` }}>
            {article.topic}
          </span>
          <HeatBar heat={article.heat} large />
        </div>
        <h2 className="iw-modal-title iw-hero-serif">{article.title}</h2>
        <p className="iw-modal-deck">{article.deck}</p>
        <div className="iw-modal-stripes">
          {article.body.map((paragraph, index) => (
            <Stripe key={paragraph} label={stripeLabel(index)} color={stripeColor(index)} text={paragraph} />
          ))}
        </div>
        <a className="iw-pill iw-modal-source" href={article.sourceUrl} target="_blank" rel="noreferrer">
          {article.source}
        </a>
      </article>
    </div>
  )
}

function AccessModal({
  authMode,
  email,
  name,
  password,
  authMessage,
  authBusy,
  memberEmail,
  setEmail,
  setName,
  setPassword,
  setAuthMode,
  setAuthOpen,
  submitAccess,
  signOut,
}: {
  authMode: "login" | "signup"
  email: string
  name: string
  password: string
  authMessage: string
  authBusy: boolean
  memberEmail: string
  setEmail: (value: string) => void
  setName: (value: string) => void
  setPassword: (value: string) => void
  setAuthMode: (value: "login" | "signup") => void
  setAuthOpen: (value: boolean) => void
  submitAccess: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  signOut: () => Promise<void>
}) {
  if (memberEmail) {
    return (
      <div className="iw-modal" onClick={() => setAuthOpen(false)}>
        <article className="iw-modal-card iw-auth-card" onClick={(event) => event.stopPropagation()}>
          <button className="iw-modal-x" onClick={() => setAuthOpen(false)} aria-label="Close">
            x
          </button>
          <div className="iw-engine-sig">desk unlocked</div>
          <h2 className="iw-modal-title iw-hero-serif">Your investigations are live.</h2>
          <p className="iw-auth-note iw-auth-note-strong">{memberEmail}</p>
          <div className="iw-auth-actions">
            <button className="iw-engine-send iw-auth-submit" onClick={() => setAuthOpen(false)}>
              continue
            </button>
            <button className="iw-auth-secondary" onClick={() => void signOut()}>
              sign out
            </button>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="iw-modal" onClick={() => setAuthOpen(false)}>
      <article className="iw-modal-card iw-auth-card" onClick={(event) => event.stopPropagation()}>
        <button className="iw-modal-x" onClick={() => setAuthOpen(false)} aria-label="Close">
          x
        </button>
        <div className="iw-engine-sig">{authMode === "login" ? "enter desk" : "join desk"}</div>
        <h2 className="iw-modal-title iw-hero-serif">Save investigations.</h2>
        <div className="iw-auth-toggle" aria-label="Access mode">
          <button className={cn(authMode === "signup" && "iw-auth-toggle-active")} onClick={() => setAuthMode("signup")} type="button">
            create
          </button>
          <button className={cn(authMode === "login" && "iw-auth-toggle-active")} onClick={() => setAuthMode("login")} type="button">
            sign in
          </button>
        </div>
        <form onSubmit={submitAccess} className="iw-auth-fields">
          {authMode === "signup" && (
            <label className="iw-auth-label">
              name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="iw-auth-input"
                placeholder="research handle"
                autoComplete="name"
              />
            </label>
          )}
          <label className="iw-auth-label">
            email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="iw-auth-input"
              placeholder="you@proton.me"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="iw-auth-label">
            password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="iw-auth-input"
              placeholder="12+ chars, Aa1!"
              type="password"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>
          <button className="iw-engine-send iw-auth-submit" disabled={authBusy}>
            {authBusy ? "checking..." : authMode === "login" ? "sign in" : "create desk"}
          </button>
        </form>
        <p className="iw-auth-note">
          Recursiv account. Saved rooms, personal agent, daily brief queue.
        </p>
        {authMessage && <p className="iw-warning">{authMessage}</p>}
      </article>
    </div>
  )
}

function Colophon() {
  return (
    <footer className="iw-foot">
      <div className="iw-foot-top">
        <div className="iw-foot-mark">
          <Image src="/images/inverted-world-banner-logo.png" alt="Inverted World" width={1229} height={203} />
          <p>{channelProfile.operatingLine}</p>
        </div>
        <div className="iw-foot-cols">
          <div>
            <h5>desk</h5>
            <a href="#intel">Dossier</a>
            <a href="#watch">Watch</a>
            <a href="#documents">Documents</a>
            <a href="#engine">Truth engine</a>
          </div>
          <div>
            <h5>channels</h5>
            {socialLinks.slice(0, 4).map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </div>
          <div>
            <h5>method</h5>
            <a>Receipts</a>
            <a>Rumor</a>
            <a>Weird read</a>
            <a>Skeptic read</a>
            <a>Verify next</a>
          </div>
        </div>
      </div>
      <div className="iw-foot-bot">
        <span>© 2026 Subverse, Inc.</span>
        <span className="iw-flex" />
        <span className="iw-accent-text">believe nothing. follow everything.</span>
      </div>
    </footer>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="iw-stat">
      <div className="iw-stat-value">{value}</div>
      <div className="iw-stat-label">{label}</div>
    </div>
  )
}

function Sigil({ lane, size }: { lane: LaneKey; size?: "lg" }) {
  const meta = laneMeta[lane]
  return (
    <span className={cn("iw-sigil", size === "lg" && "iw-sigil-lg")} style={{ borderColor: `${meta.color}66`, color: meta.color }}>
      <span className="iw-sigil-lane">{lane}</span>
      <span className="iw-sigil-sep">▸</span>
      <span className="iw-sigil-code">{meta.code}</span>
    </span>
  )
}

function HeatBar({ heat, large }: { heat: number; large?: boolean }) {
  const filled = Math.max(1, Math.round((heat / 100) * 5))
  return (
    <span className={cn("iw-heat", large && "iw-heat-lg")} title={`Heat ${heat}`}>
      <span className="iw-heat-label">heat</span>
      <span className="iw-heat-bars">
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} className="iw-heat-seg" style={{ background: index < filled ? "#e8b45c" : "rgba(244,239,226,0.14)" }} />
        ))}
      </span>
      <span className="iw-heat-num">{heat}</span>
    </span>
  )
}

function Stripe({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div className="iw-stripe">
      <div className="iw-stripe-label" style={{ color, borderColor: `${color}55` }}>
        {label}
      </div>
      <div className="iw-stripe-text">{text}</div>
    </div>
  )
}

function getLane(article: IntelligenceArticle): LaneKey {
  if (article.topicId === "uap-disclosure") return "UAP"
  if (article.topicId === "secret-programs") return "BLACK"
  if (article.topicId === "epstein-networks") return "NET"
  if (article.topicId === "cryptids-paranormal") return "FIELD"
  if (article.topicId === "ai-technocracy") return article.title.toLowerCase().includes("data") ? "INFRA" : "TECH"
  if (article.topicId === "space-anomalies") return "SPACE"
  return "UAP"
}

function getVideoLane(video: ChannelVideo): LaneKey {
  if (video.topicId === "uap-disclosure") return "UAP"
  if (video.topicId === "secret-programs") return "BLACK"
  if (video.topicId === "epstein-networks") return "NET"
  if (video.topicId === "cryptids-paranormal") return "FIELD"
  if (video.topicId === "ai-technocracy") return "TECH"
  if (video.topicId === "space-anomalies") return "SPACE"
  return "UAP"
}

function stripeLabel(index: number) {
  return ["receipts", "weird read", "skeptic read", "verify next", "context", "next search"][index] || "note"
}

function stripeColor(index: number) {
  return ["#e8b45c", "#d8b4fe", "#7dd3fc", "#8ee6a8", "#f4efe2", "#e8b45c"][index] || "#e8b45c"
}
