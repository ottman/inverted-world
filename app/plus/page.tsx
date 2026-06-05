import type { Metadata } from "next"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { UpgradeButton } from "@/components/plus/upgrade-button"
import { cn } from "@/lib/utils"

export const dynamic = "force-static"

export const metadata: Metadata = {
  title: "Inverted World+ | Membership",
  description: "Go deeper into the Inverted World — ad-free, the full declassified archive, unlimited research, and bonus daily games.",
}

const PERKS = [
  { title: "Ad-free everywhere", body: "Read the feed, the tales, and the dossiers with zero ads." },
  { title: "The full archive", body: "Every declassified tale and dossier, unlocked — no caps." },
  { title: "Unlimited Research", body: "Ask the Inverted World research engine as much as you want." },
  { title: "Bonus daily games", body: "Extra daily puzzles, streak history, and members-only modes." },
  { title: "Early access", body: "New investigations and features before anyone else." },
  { title: "Support independent media", body: "Fund original reporting from the edge of the unknown." },
]

export default function PlusPage() {
  return (
    <InvertedPageShell
      eyebrow="Membership"
      title="Inverted World+"
      heroTitle="Inverted World+"
      heroDescription="Go deeper into the unknown — and keep independent investigation alive."
    >
      <div className="grid gap-6">
        <section className={cn("grid gap-6 p-5 sm:p-8", archiveSurface)}>
          <div className="grid gap-3 border-b border-[#f4efe2]/10 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Join the watchers</p>
            <h2 className="iw-serif text-4xl leading-none text-[#fff8e6] sm:text-5xl">Everything, unlocked.</h2>
            <p className="max-w-2xl text-sm leading-6 text-[#f4efe2]/70">
              The Inverted World stays free to read. Members go ad-free, unlock the full archive and unlimited
              research, get bonus games — and keep the lights on for original investigation.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((perk) => (
              <div key={perk.title} className="grid content-start gap-1 border border-[#f4efe2]/10 bg-[#050504]/40 p-4">
                <h3 className="iw-serif text-2xl leading-tight text-[#fff8e6]">{perk.title}</h3>
                <p className="text-sm leading-6 text-[#f4efe2]/64">{perk.body}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-start gap-3 border-t border-[#f4efe2]/10 pt-6">
            <UpgradeButton />
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#f4efe2]/40">Cancel anytime · Secure checkout via Stripe</p>
          </div>
        </section>
      </div>
    </InvertedPageShell>
  )
}
