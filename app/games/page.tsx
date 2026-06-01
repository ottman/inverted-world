import type { Metadata } from "next"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { CategoryNav } from "@/components/category-nav"
import { SpaceInvaders } from "@/components/games/space-invaders"
import { ConspiracyTrivia } from "@/components/games/conspiracy-trivia"
import { cn } from "@/lib/utils"

export const dynamic = "force-static"

export const metadata: Metadata = {
  title: "Games | Inverted World",
  description:
    "Play in the Inverted World — a Space Invaders run rendered over the site's living background, and a trivia game on conspiracies that turned out to be true.",
}

export default function GamesPage() {
  return (
    <InvertedPageShell eyebrow="Arcade" title="Games" heroTitle="Games" heroDescription="Kill time in the inverted world.">
      <div className="grid gap-6">
        <CategoryNav
          ariaLabel="Games"
          className="border-y border-[#f4efe2]/10 py-3"
          items={[
            { key: "invaders", label: "Invaders", href: "#invaders" },
            { key: "trivia", label: "Conspiracy Trivia", href: "#trivia", accent: true },
          ]}
        />

        <section id="invaders" className={cn("scroll-mt-28 grid gap-4 p-4 sm:p-6", archiveSurface)}>
          <div className="border-b border-[#f4efe2]/10 pb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Arcade</p>
            <h2 className="iw-serif text-4xl leading-none text-[#fff8e6] sm:text-5xl">Invaders</h2>
            <p className="mt-2 text-sm text-[#f4efe2]/64">They came from the inverted sky. Hold the line.</p>
          </div>
          <div className="mx-auto w-full max-w-2xl">
            <SpaceInvaders />
          </div>
        </section>

        <section id="trivia" className={cn("scroll-mt-28 grid gap-4 p-4 sm:p-6", archiveSurface)}>
          <div className="border-b border-[#f4efe2]/10 pb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Declassified</p>
            <h2 className="iw-serif text-4xl leading-none text-[#fff8e6] sm:text-5xl">Conspiracy or Fact?</h2>
            <p className="mt-2 text-sm text-[#f4efe2]/64">Every answer here is documented — files, hearings, court rulings.</p>
          </div>
          <div className="mx-auto w-full max-w-2xl">
            <ConspiracyTrivia />
          </div>
        </section>
      </div>
    </InvertedPageShell>
  )
}
