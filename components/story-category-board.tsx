"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { archiveSurface } from "@/components/inverted-page-shell"
import { CategoryNav } from "@/components/category-nav"
import { cn } from "@/lib/utils"

// Lightweight per-card data — deliberately excludes the heavy story `body`/coverage so the whole
// feed can live client-side (instant filtering) without shipping article bodies to the browser.
export type StoryCardData = {
  uri: string
  headline: string
  synopsis: string
  category?: string
  articleCount: number
  outletCount: number
  concepts: string[]
  imageUrl?: string
  lane?: string // "tales" gets evergreen styling/copy instead of "N articles covering"
  hasVideo?: boolean // show a ▶ marker when an embedded video is present
}

// A themed set (Blackout / Weird / Comedy / Pop & Music / Viral) that sits alongside the mainstream
// "everyone's talking about" feed in the same single nav.
export type ThemeFeed = {
  key: string
  chip: string
  title: string
  cards: StoryCardData[]
}

type Selection = { kind: "all" } | { kind: "category"; name: string } | { kind: "theme"; key: string }

// ONE navigation for the whole news page, in the homepage's style: a grid of category cards — All,
// the top-story categories (Politics, Sports, …), then the themed sections — that all drive ONE feed
// below. Same single-nav filtering as before, dressed in the homepage's topic-index card look.
export function NewsFeed({ topCards, themes }: { topCards: StoryCardData[]; themes: ThemeFeed[] }) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of topCards) {
      if (card.category) counts.set(card.category, (counts.get(card.category) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
  }, [topCards])

  // Initial filter from the URL so the header dropdown links (/news?category=… or ?theme=…) land
  // on the right section.
  const params = useSearchParams()
  const initialSelection = useMemo<Selection>(() => {
    const theme = params.get("theme")
    if (theme && themes.some((t) => t.key === theme)) return { kind: "theme", key: theme }
    const category = params.get("category")
    if (category && categories.some((c) => c.name.toLowerCase() === category.toLowerCase())) {
      return { kind: "category", name: categories.find((c) => c.name.toLowerCase() === category.toLowerCase())!.name }
    }
    return { kind: "all" }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once for the initial filter
  }, [])
  // Desktop uses the header dropdowns (via the URL); mobile uses the side-scrolling strip below,
  // which sets the selection directly.
  const [selection, setSelection] = useState<Selection>(initialSelection)

  const { cards, title } = useMemo(() => {
    if (selection.kind === "theme") {
      const theme = themes.find((item) => item.key === selection.key)
      return { cards: theme?.cards ?? [], title: theme?.title ?? "" }
    }
    if (selection.kind === "category") {
      return { cards: topCards.filter((card) => card.category === selection.name), title: selection.name }
    }
    return { cards: topCards, title: "What everyone's talking about" }
  }, [selection, topCards, themes])

  return (
    <section className={cn("grid gap-4 p-3 pt-4", archiveSurface)}>
      {/* Mobile only: a side-to-side scrolling category strip (the header dropdowns cover desktop). */}
      <CategoryNav
        ariaLabel="News categories"
        scroll
        className="-mx-1 border-b border-[#f4efe2]/10 px-1 pb-2 lg:hidden"
        items={[
          { key: "all", label: "All", count: topCards.length, active: selection.kind === "all", onClick: () => setSelection({ kind: "all" }) },
          ...categories.map((category) => ({
            key: category.name,
            label: category.name,
            count: category.count,
            active: selection.kind === "category" && selection.name === category.name,
            onClick: () => setSelection({ kind: "category", name: category.name }),
          })),
          ...themes.map((theme) => ({
            key: theme.key,
            label: theme.chip,
            count: theme.cards.length,
            accent: true,
            active: selection.kind === "theme" && selection.key === theme.key,
            onClick: () => setSelection({ kind: "theme", key: theme.key }),
          })),
        ]}
      />

      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#f4efe2]/10 pb-2">
        <h2 className="iw-serif text-4xl leading-none text-[#fff8e6]">{title}</h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/46">{cards.length} stories</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <StoryCard key={card.uri} card={card} />
        ))}
      </div>
    </section>
  )
}

function StoryCard({ card }: { card: StoryCardData }) {
  return (
    <a
      href={`/news/story/${encodeURIComponent(card.uri)}`}
      className="group flex flex-col gap-2 bg-[#050504]/40 p-4 transition hover:bg-[#050504]/66"
    >
      {card.imageUrl ? (
        <div className="-mx-4 -mt-4 mb-1 aspect-[16/9] overflow-hidden bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element -- rights-cleared CC/PD images from arbitrary hosts */}
          <img
            src={card.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top opacity-90 transition group-hover:opacity-100"
          />
        </div>
      ) : null}
      {card.category ? (
        <span className="w-fit bg-[#df2f2f]/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#fff8e6]">
          {card.category}
        </span>
      ) : null}
      <h3 className="iw-serif text-3xl font-bold leading-[1.0] text-[#fff8e6] transition group-hover:text-[#df2f2f] sm:text-4xl">
        {card.headline}
      </h3>
      <p className="text-sm leading-6 text-[#f4efe2]/72">{card.synopsis}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/46">
        {card.lane === "tales" ? (
          <>
            <span className="text-[#df2f2f]">{card.hasVideo ? "▶ Video" : "Inverted World"}</span>
            {card.outletCount ? <span>· {card.outletCount} sources</span> : null}
          </>
        ) : (
          <>
            <span className="text-[#df2f2f]">{card.articleCount.toLocaleString()} articles covering</span>
            {card.outletCount ? <span>· {card.outletCount}+ outlets</span> : null}
          </>
        )}
        {card.concepts.map((concept) => (
          <span key={concept} className="bg-black/30 px-2 py-1">
            {concept}
          </span>
        ))}
      </div>
    </a>
  )
}
