"use client"

import type React from "react"
import Image from "next/image"
import { ArrowLeft, ExternalLink } from "lucide-react"
import Waves from "@/components/Waves"
import { cn } from "@/lib/utils"

export const archiveSurface = "border border-[#f4efe2]/12 bg-[#070706]/28 backdrop-blur-[2px]"

export function InvertedPageShell({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
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
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(7,7,6,0.04),rgba(7,7,6,0.72))]" />

      <div className="relative z-10">
        <header className="sticky top-0 z-30 border-b border-[#f4efe2]/10 bg-transparent backdrop-blur-[2px]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8">
            <a className="flex min-w-0 items-center gap-3" href="/" aria-label="Inverted World home">
              <Image
                src="/images/inverted-world-banner-logo.png"
                alt="Inverted World"
                width={1229}
                height={203}
                priority
                className="h-7 w-auto max-w-[54vw] shrink sm:h-10 sm:max-w-none"
              />
            </a>
            <nav className="order-3 flex w-full items-center justify-center gap-4 overflow-x-auto text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/64 md:order-none md:w-auto md:gap-6 md:tracking-[0.18em]">
              <a className="transition hover:text-[#e8b45c]" href="/news">
                News
              </a>
              <a className="transition hover:text-[#e8b45c]" href="/archive">
                Archive
              </a>
              <a className="transition hover:text-[#e8b45c]" href="/documents">
                Documents
              </a>
            </nav>
            <a
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#f4efe2]/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/72 transition hover:border-[#e8b45c]/45 hover:text-[#fff8e6]"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </a>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-3 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e8b45c]">{eyebrow}</p>
              <h1 className="mt-2 text-4xl font-semibold leading-none tracking-normal text-[#fff8e6] sm:text-6xl">{title}</h1>
            </div>
            {action}
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}

export function ExternalAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-md border border-[#e8b45c]/45 bg-[#070706]/22 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#e8b45c]/12",
        archiveSurface,
      )}
    >
      {children}
      <ExternalLink className="h-4 w-4" />
    </a>
  )
}
