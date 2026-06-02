import type { Metadata } from "next"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { CategoryNav } from "@/components/category-nav"
import { SpaceInvaders } from "@/components/games/space-invaders"
import { ConspiracyTrivia } from "@/components/games/conspiracy-trivia"
import { RealOrHoax } from "@/components/games/real-or-hoax"
import { RedactedWordle } from "@/components/games/redacted-wordle"
import { CipherDaily } from "@/components/games/cipher-daily"
import { InvertedConnections } from "@/components/games/inverted-connections"
import { MothmanFlap } from "@/components/games/mothman-flap"
import { CryptidCam } from "@/components/games/cryptid-cam"
import { cn } from "@/lib/utils"

export const dynamic = "force-static"

export const metadata: Metadata = {
  title: "Games | Inverted World",
  description:
    "Play in the Inverted World — snap-judge real vs hoax, crack the daily codeword and cryptogram, sort the daily Connections grid, fly the Mothman, shoot the invaders, and test yourself on conspiracies that turned out to be true.",
}

type GameSection = {
  id: string
  eyebrow: string
  title: string
  tagline: string
  node: React.ReactNode
}

const SECTIONS: GameSection[] = [
  {
    id: "real-or-hoax",
    eyebrow: "Verdict",
    title: "Real or Hoax?",
    tagline: "Documented fact, or famous fake? Snap-judge each file and run up your streak.",
    node: <RealOrHoax />,
  },
  {
    id: "redacted",
    eyebrow: "Daily · Classified",
    title: "Redacted",
    tagline: "Six tries to decrypt today's classified codeword.",
    node: <RedactedWordle />,
  },
  {
    id: "cipher",
    eyebrow: "Daily · Cryptogram",
    title: "Cipher",
    tagline: "Crack today's message, pulled from the unsolved-code files.",
    node: <CipherDaily />,
  },
  {
    id: "connections",
    eyebrow: "Daily · Patterns",
    title: "Connections",
    tagline: "Find the four hidden groups. Four mistakes and the file closes.",
    node: <InvertedConnections />,
  },
  {
    id: "trivia",
    eyebrow: "Declassified",
    title: "Conspiracy or Fact?",
    tagline: "Every answer here is documented — files, hearings, court rulings.",
    node: <ConspiracyTrivia />,
  },
  {
    id: "flap",
    eyebrow: "Arcade",
    title: "Mothman Flap",
    tagline: "Fly the Point Pleasant cryptid through the bridge girders.",
    node: <MothmanFlap />,
  },
  {
    id: "cam",
    eyebrow: "Field Op",
    title: "Cryptid Cam",
    tagline: "They surface for a heartbeat. Photograph them before they vanish.",
    node: <CryptidCam />,
  },
  {
    id: "invaders",
    eyebrow: "Arcade",
    title: "Invaders",
    tagline: "They came from the inverted sky. Hold the line.",
    node: <SpaceInvaders />,
  },
]

const NAV = [
  { key: "real-or-hoax", label: "Real or Hoax", href: "#real-or-hoax", accent: true },
  { key: "redacted", label: "Redacted", href: "#redacted" },
  { key: "cipher", label: "Cipher", href: "#cipher" },
  { key: "connections", label: "Connections", href: "#connections" },
  { key: "trivia", label: "Conspiracy Trivia", href: "#trivia" },
  { key: "flap", label: "Mothman Flap", href: "#flap" },
  { key: "cam", label: "Cryptid Cam", href: "#cam" },
  { key: "invaders", label: "Invaders", href: "#invaders" },
]

export default function GamesPage() {
  return (
    <InvertedPageShell eyebrow="Arcade" title="Games" heroTitle="Games" heroDescription="Kill time in the inverted world.">
      <div className="grid gap-6">
        <CategoryNav ariaLabel="Games" scroll className="border-y border-[#f4efe2]/10 py-3" items={NAV} />

        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className={cn("scroll-mt-28 grid gap-4 p-4 sm:p-6", archiveSurface)}>
            <div className="border-b border-[#f4efe2]/10 pb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">{section.eyebrow}</p>
              <h2 className="iw-serif text-4xl leading-none text-[#fff8e6] sm:text-5xl">{section.title}</h2>
              <p className="mt-2 text-sm text-[#f4efe2]/64">{section.tagline}</p>
            </div>
            <div className="mx-auto w-full max-w-2xl">{section.node}</div>
          </section>
        ))}
      </div>
    </InvertedPageShell>
  )
}
