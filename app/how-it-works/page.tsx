import type { Metadata } from "next"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { topics } from "@/data/inverted-world"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "How It Works | Inverted World",
  description:
    "How Inverted World turns the Tales archive, live news, X signal, source documents, and AI research into a daily independent media desk.",
  alternates: {
    canonical: "/how-it-works",
  },
}

const systemSteps = [
  {
    title: "Archive First",
    body: "The show is the center of gravity. Episodes and shorts are organized into topic lanes so new readers can move from a current story back into the full Tales archive.",
  },
  {
    title: "Signal Intake",
    body: "The desk watches live news, X, official records, court material, FOIA archives, YouTube updates, and source documents across the strange and contested beats.",
  },
  {
    title: "Story Clustering",
    body: "Related posts, articles, documents, names, agencies, and events are grouped together so readers see the story instead of a pile of disconnected links.",
  },
  {
    title: "Source Contrast",
    body: "AI helps compare mainstream coverage, independent media, primary records, skeptical reads, and social velocity while keeping the original links close to the story.",
  },
  {
    title: "Readable Stories",
    body: "Strong clusters become clean articles with the baseline facts first, then source links, open questions, X momentum, and related Tales context for deeper research.",
  },
  {
    title: "Reader Research",
    body: "Readers can keep going: open the source, watch the related episode, follow the X lane, or ask AI to explain what is known, disputed, missing, and worth checking next.",
  },
]

export default function HowItWorksPage() {
  return (
    <InvertedPageShell
      eyebrow="Research system"
      title="How It Works"
      heroTitle="How It Works"
      heroDescription="A daily independent media desk for the unexplained, the classified, the misreported, and the stories moving fastest online."
    >
      <div className="grid gap-5">
        <section className={cn("p-4 sm:p-5", archiveSurface)}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">The Goal</p>
              <h2 className="iw-serif mt-2 text-4xl leading-none text-[#fff8e6] sm:text-5xl">Fast signal, long memory.</h2>
            </div>
            <div className="grid gap-4 text-sm leading-7 text-[#f4efe2]/72">
              <p>
                Inverted World starts with Tales From the Inverted World and expands it into a full news and archive
                product for conspiracy-world reporting, paranormal investigations, intelligence history, AI power,
                elite networks, and anomalous science.
              </p>
              <p>
                The aim is simple: preserve the original material, catch the fastest-moving social signal, compare the
                coverage, and turn the strongest leads into stories readers can actually follow.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {systemSteps.map((step) => (
            <article key={step.title} className={cn("min-h-[220px] p-4", archiveSurface)}>
              <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">{step.title}</h2>
              <p className="mt-4 text-sm leading-6 text-[#f4efe2]/66">{step.body}</p>
            </article>
          ))}
        </section>

        <section className={cn("p-4 sm:p-5", archiveSurface)}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">The Product</p>
              <h2 className="iw-serif mt-2 text-4xl leading-none text-[#fff8e6] sm:text-5xl">Built to become a daily habit.</h2>
              <div className="mt-4 grid gap-4 text-sm leading-7 text-[#f4efe2]/68">
                <p>
                  The homepage gives you the show, live topic lanes, current X signal, and a fast path into the newest
                  stories. The news desk turns the strongest clusters into readable articles with sources and context.
                </p>
                <p>
                  The experience is designed for repeat visits: watch the latest episode, scan what is breaking, read the
                  sourced story, then go deeper through archive video, primary links, social reaction, and AI research.
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              {topics.map((topic) => (
                <a
                  key={topic.id}
                  href={`/#topic-${topic.id}`}
                  className="group flex items-start justify-between gap-4 bg-[#050504]/34 p-3 transition hover:bg-black/56"
                >
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">{topic.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#f4efe2]/54">{topic.signal}</span>
                  </span>
                  <span className="text-xs uppercase tracking-[0.12em] text-[#f4efe2]/40 group-hover:text-[#fff8e6]">Open</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </InvertedPageShell>
  )
}
