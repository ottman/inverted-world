"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import { ExternalLink, Facebook, Instagram, Radio, Youtube } from "lucide-react"
import Waves from "@/components/Waves"
import { socialLinks, topics } from "@/data/inverted-world"
import { cn } from "@/lib/utils"

export const archiveSurface = "bg-[#070706]/30 backdrop-blur-[2px]"

export type BreakingItem = {
  title: string
  href: string
  source?: string
}

type LiveStatus = {
  isLive: boolean
  title?: string
  url?: string
}

export function InvertedPageShell({
  eyebrow,
  title,
  children,
  action,
  breakingItems,
  heroTitle = "Inverted World",
  heroDescription = "Tales From the Inverted World investigates the mysteries that lie beneath the surface of everyday life.",
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  breakingItems?: BreakingItem[]
  heroTitle?: string
  heroDescription?: string
}) {
  const [liveStatus, setLiveStatus] = useState<LiveStatus>({ isLive: false })

  useEffect(() => {
    let active = true

    async function loadLiveStatus() {
      try {
        const response = await fetch("/api/youtube-live", { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as LiveStatus
        if (active) setLiveStatus({ isLive: Boolean(data.isLive), title: data.title, url: data.url })
      } catch {
        if (active) setLiveStatus({ isLive: false })
      }
    }

    void loadLiveStatus()
    const interval = window.setInterval(() => void loadLiveStatus(), 60_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070706] text-[#f4efe2]">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-95">
        <Waves
          lineColor="rgba(244, 239, 226, 0.42)"
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
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(7,7,6,0.04),rgba(7,7,6,0.72))]" />

      <div className="relative z-10">
        <header
          className={cn(
            "sticky top-0 z-30 bg-[#070706]/24 backdrop-blur-[2px] transition-colors",
            liveStatus.isLive && "bg-[#180404]/46 shadow-[0_1px_0_rgba(223,47,47,0.42)]",
          )}
        >
          <BreakingTicker items={breakingItems} />
          <div className="mx-auto grid max-w-7xl gap-3 px-3 py-3 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:px-8">
            <a className="flex min-w-0 items-center gap-3" href="/archive" aria-label="Inverted World archive">
              <Image
                src="/images/inverted-world-banner-logo.png"
                alt="Inverted World"
                width={1229}
                height={203}
                priority
                className="h-10 w-auto max-w-[76vw] shrink sm:h-11 sm:max-w-none"
              />
            </a>
            <nav className="flex w-full items-center gap-3 overflow-x-auto text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/64 lg:justify-center lg:gap-5 lg:tracking-[0.14em]">
              {topics.map((topic) => (
                <a key={topic.id} className="shrink-0 transition hover:text-[#df2f2f]" href={`/archive#topic-${topic.id}`}>
                  {topic.title}
                </a>
              ))}
            </nav>
            <div className="hidden lg:block" aria-hidden="true" />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="mb-5 grid gap-4 bg-[#070706]/18 p-4 backdrop-blur-[1px] sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#df2f2f]">{eyebrow}</p>
              <h1 className="iw-serif mt-2 max-w-5xl text-5xl leading-[0.9] tracking-normal text-[#fff8e6] sm:text-7xl">
                {heroTitle}
              </h1>
              <p className="iw-serif mt-3 max-w-3xl text-2xl leading-[1.05] text-[#f4efe2]/86 sm:text-3xl">
                {heroDescription}
              </p>
              <p className="sr-only">{title}</p>
            </div>
            {action}
          </div>
          {children}
        </main>

        <SimpleFooter />
      </div>
    </div>
  )
}

function BreakingTicker({ items }: { items?: BreakingItem[] }) {
  const fallbackItems = topics.map((topic) => ({
    title: topic.signal,
    href: `/archive#topic-${topic.id}`,
    source: topic.title,
  }))
  const visibleItems = (items?.length ? items : fallbackItems).slice(0, 32)
  const marqueeItems = [...visibleItems, ...visibleItems]

  return (
    <div>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 sm:px-6 lg:px-8">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#df2f2f]">Breaking</span>
        <div className="iw-breaking-scroll min-w-0 flex-1 overflow-hidden py-2">
          <div className="iw-breaking-track flex w-max gap-4">
            {marqueeItems.map((item, index) => {
              const external = item.href.startsWith("http")
              return (
                <a
                  key={`${item.href}-${item.title}-${index}`}
                  href={item.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  className="group flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-[#f4efe2]/62 transition hover:text-[#fff8e6]"
                >
                  <span className="max-w-[72vw] truncate sm:max-w-[420px]">{item.title}</span>
                  {item.source && <span className="text-[#df2f2f]/70">{item.source}</span>}
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function SimpleFooter() {
  return (
    <footer className="relative z-10 mx-auto mt-8 flex max-w-7xl flex-col gap-4 px-3 py-6 text-[#f4efe2]/56 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
      <div className="flex items-center gap-3">
        <Image
          src="/images/inverted-world-banner-logo.png"
          alt="Inverted World"
          width={1229}
          height={203}
          className="h-12 w-auto max-w-[72vw] opacity-82 sm:h-14"
        />
        <span className="text-xs uppercase tracking-[0.14em]">© {new Date().getFullYear()} Subverse, Inc.</span>
      </div>
      <div className="flex items-center gap-2">
        {socialLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            aria-label={link.label}
            className="grid h-9 w-9 place-items-center bg-[#070706]/30 text-[#f4efe2]/62 transition hover:bg-[#df2f2f]/12 hover:text-[#fff8e6]"
          >
            <SocialIcon label={link.label} />
          </a>
        ))}
      </div>
    </footer>
  )
}

function SocialIcon({ label }: { label: string }) {
  const iconClass = "h-4 w-4"
  if (label === "YouTube") return <Youtube className={iconClass} />
  if (label === "Facebook") return <Facebook className={iconClass} />
  if (label === "Instagram") return <Instagram className={iconClass} />
  if (label === "X") return <XIcon className={iconClass} />
  return <Radio className={iconClass} />
}

export function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M13.86 10.47 21.15 2h-1.73l-6.33 7.35L8.04 2H2.2l7.64 11.12L2.2 22h1.73l6.68-7.76L15.96 22h5.84l-7.94-11.53Zm-2.37 2.75-.77-1.11-6.16-8.8h2.65l4.97 7.11.77 1.11 6.47 9.25h-2.65l-5.28-7.56Z" />
    </svg>
  )
}

export function ExternalAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-md bg-[#070706]/22 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/12",
        archiveSurface,
      )}
    >
      {children}
      <ExternalLink className="h-4 w-4" />
    </a>
  )
}
