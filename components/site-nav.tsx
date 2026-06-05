"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { ChevronDown, Menu, X } from "lucide-react"
import { topics } from "@/data/inverted-world"
import { cn } from "@/lib/utils"

type NavLink = { label: string; href: string }
type NavGroup = { title: string; items: NavLink[] }
type NavItem = { label: string; href: string; groups?: NavGroup[] }

// Tales (the video archive) categories → jump to the topic section on /archive.
const TALE_TOPICS: NavLink[] = topics.map((topic) => ({ label: topic.title, href: `/archive#topic-${topic.id}` }))

// Breaking News categories. /news shows mainstream clusters + evergreen tales, so the dropdown
// covers both, plus the themed sections — each filters the feed via ?category / ?theme.
const NEWS_CATEGORIES: NavLink[] = [
  "Politics", "World", "Business", "Sports", "Science", "Technology", "Health", "Entertainment", "Crime",
].map((label) => ({ label, href: `/news?category=${encodeURIComponent(label)}` }))

const TALE_CATEGORIES: NavLink[] = [
  "UAP & UFO Encounters", "Cryptids & Unknown Creatures", "Declassified & Secret Programs",
  "Ancient Mysteries & Lost Technology", "Lost Civilizations & Forbidden Archaeology", "Hauntings & The Paranormal",
  "Cover-ups & Documented Conspiracies", "Unexplained Disappearances", "Cursed & Anomalous Places",
  "Mind Control, Psi & Consciousness", "Time Anomalies, Dimensions & Simulation", "Cosmic Anomalies & Strange Signals",
  "Secret Societies & The Occult", "Unsolved Codes, Lost Media & Cryptic Artifacts",
].map((label) => ({ label, href: `/news?category=${encodeURIComponent(label)}` }))

const NEWS_THEMES: NavLink[] = [
  { label: "Viral", href: "/news?theme=viral" },
  { label: "Weird", href: "/news?theme=weird" },
  { label: "Comedy", href: "/news?theme=comedy" },
  { label: "Pop & Music", href: "/news?theme=pop" },
  { label: "Blackout", href: "/news?theme=blackout" },
]

const NAV: NavItem[] = [
  { label: "Tales", href: "/archive", groups: [{ title: "Topics", items: TALE_TOPICS }] },
  {
    label: "Breaking News",
    href: "/news",
    groups: [
      { title: "News", items: NEWS_CATEGORIES },
      { title: "The Strange", items: TALE_CATEGORIES },
      { title: "Sections", items: NEWS_THEMES },
    ],
  },
  { label: "Research", href: "/research" },
  { label: "Games", href: "/games" },
  { label: "Plus", href: "/plus" },
]

export function SiteNav() {
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* Desktop: left-justified serif nav with hover/focus dropdowns */}
      <nav className="iw-serif hidden w-full items-center gap-6 text-lg font-normal leading-none tracking-normal text-[#f4efe2]/70 lg:flex lg:gap-8 lg:text-xl">
        {NAV.map((item) => (item.groups ? <DesktopDropdown key={item.label} item={item} /> : (
          <a key={item.label} href={item.href} className="shrink-0 transition hover:text-[#df2f2f]">
            {item.label}
          </a>
        )))}
      </nav>

      {/* Mobile: hamburger */}
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="ml-auto p-1 text-[#f4efe2]/80 transition hover:text-[#df2f2f] lg:hidden"
      >
        <Menu className="h-7 w-7" />
      </button>
      {/* Portal to <body> so the fixed overlay escapes the header's backdrop-filter containing block
          (otherwise it'd be clipped to the header and the page bleeds through). */}
      {open && typeof document !== "undefined" && createPortal(<MobileMenu onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function DesktopDropdown({ item }: { item: NavItem }) {
  const wide = (item.groups?.length || 0) > 1
  return (
    <div className="group relative shrink-0">
      <a href={item.href} className="inline-flex items-center gap-1 transition group-hover:text-[#df2f2f]">
        {item.label}
        <ChevronDown className="h-4 w-4 opacity-60 transition group-hover:rotate-180" />
      </a>
      <div
        className={cn(
          "invisible absolute left-0 top-full z-40 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
          wide ? "w-[640px]" : "w-64",
        )}
      >
        <div
          style={{ backgroundColor: "#080808" }}
          className={cn("border border-[#f4efe2]/12 p-4 shadow-2xl", wide ? "grid grid-cols-3 gap-4" : "grid gap-1")}
        >
          {item.groups!.map((group) => (
            <div key={group.title} className="grid content-start gap-1">
              <p className="mb-1 text-[10px] font-sans font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">{group.title}</p>
              {group.items.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block truncate py-0.5 text-sm leading-snug text-[#f4efe2]/64 transition hover:text-[#fff8e6]"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div style={{ backgroundColor: "#080808" }} className="fixed inset-0 z-50 lg:hidden">
      <div className="flex items-center justify-between px-4 py-4">
        <a href="/" onClick={onClose} aria-label="inverted.world home" className="flex items-center">
          <Image src="/images/inverted-world-banner-logo.png" alt="Inverted World" width={1229} height={203} className="h-8 w-auto" />
        </a>
        <button type="button" aria-label="Close menu" onClick={onClose} className="p-1 text-[#f4efe2]/80 hover:text-[#df2f2f]">
          <X className="h-7 w-7" />
        </button>
      </div>
      <div className="grid gap-1 overflow-y-auto px-4 pb-16" style={{ maxHeight: "calc(100vh - 64px)" }}>
        {NAV.map((item) => (
          <div key={item.label} className="border-b border-[#f4efe2]/10">
            <div className="flex items-center justify-between">
              <a href={item.href} onClick={onClose} className="iw-serif py-3 text-2xl text-[#f4efe2]/90">
                {item.label}
              </a>
              {item.groups && (
                <button
                  type="button"
                  aria-label={`Toggle ${item.label} categories`}
                  onClick={() => setExpanded((e) => (e === item.label ? null : item.label))}
                  className="p-2 text-[#f4efe2]/60"
                >
                  <ChevronDown className={cn("h-6 w-6 transition", expanded === item.label && "rotate-180 text-[#df2f2f]")} />
                </button>
              )}
            </div>
            {item.groups && expanded === item.label && (
              <div className="grid gap-3 pb-4 pl-1">
                {item.groups.map((group) => (
                  <div key={group.title} className="grid gap-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">{group.title}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {group.items.map((link) => (
                        <a key={link.label} href={link.href} onClick={onClose} className="py-0.5 text-sm text-[#f4efe2]/64">
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
