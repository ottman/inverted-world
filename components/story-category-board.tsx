"use client"

import { useMemo, useState } from "react"
import { archiveSurface } from "@/components/inverted-page-shell"
import { cn } from "@/lib/utils"

// Lightweight per-card data — deliberately excludes the heavy story `body`/coverage so filtering
// stays client-side without shipping the full article payload to the browser.
export type StoryCardData = {
  uri: string
  headline: string
  synopsis: string
  category?: string
  articleCount: number
  outletCount: number
  concepts: string[]
  imageUrl?: string
}

// A stories section with a category filter bar across the top, so a reader can jump straight to
// Politics / World / Tech / Sports etc. instead of scanning every card.
export function StoryCategoryBoard({
  eyebrow,
  title,
  note,
  cards,
}: {
  eyebrow: string
  title: string
  note: string
  cards: StoryCardData[]
}) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of cards) {
      if (card.category) counts.set(card.category, (counts.get(card.category) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
  }, [cards])

  const [active, setActive] = useState<string | null>(null)
  const shown = active ? cards.filter((card) => card.category === active) : cards

  return (
    <section className={cn("mt-6 grid gap-3 border-t-2 border-[#df2f2f]/45 p-3 pt-4", archiveSurface)}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#f4efe2]/10 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">{eyebrow}</p>
          <h2 className="iw-serif text-4xl leading-none text-[#fff8e6]">{title}</h2>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/46">
          {active ? `${shown.length} in ${active}` : note}
        </div>
      </div>

      {categories.length > 1 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <CategoryPill label="All" count={cards.length} active={active === null} onClick={() => setActive(null)} />
          {categories.map((category) => (
            <CategoryPill
              key={category.name}
              label={category.name}
              count={category.count}
              active={active === category.name}
              onClick={() => setActive(category.name)}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((card) => (
          <a
            key={card.uri}
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
              <span className="text-[#df2f2f]">{card.articleCount.toLocaleString()} articles covering</span>
              {card.outletCount ? <span>· {card.outletCount}+ outlets</span> : null}
              {card.concepts.map((concept) => (
                <span key={concept} className="bg-black/30 px-2 py-1">
                  {concept}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}

function CategoryPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition",
        active ? "bg-[#df2f2f] text-[#fff8e6]" : "bg-black/30 text-[#f4efe2]/64 hover:bg-black/52 hover:text-[#fff8e6]",
      )}
    >
      {label}
      <span className={cn("text-[10px]", active ? "text-[#fff8e6]/70" : "text-[#f4efe2]/40")}>{count}</span>
    </button>
  )
}
