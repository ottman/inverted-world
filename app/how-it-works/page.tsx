import type { Metadata } from "next"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { topics } from "@/data/inverted-world"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "How It Works | Inverted World",
  description:
    "How Inverted World combines the Tales archive, live news, X velocity, source documents, Recursiv jobs, and AI-assisted dossiers.",
  alternates: {
    canonical: "/how-it-works",
  },
}

const systemSteps = [
  {
    title: "Archive First",
    body: "Every Tales From the Inverted World upload becomes a durable research object: video page, topic lane, source context, transcript when available, and related coverage.",
  },
  {
    title: "Signal Intake",
    body: "Topic jobs collect live news links, X posts, official records, court material, FOIA archives, YouTube updates, and source documents across each lane.",
  },
  {
    title: "Claim Clustering",
    body: "The system groups posts and articles around the same claim, event, person, document, agency, or anomaly so readers can see the story instead of isolated links.",
  },
  {
    title: "Evidence Labels",
    body: "AI assists with source extraction, bias contrast, timeline building, headline drafting, and evidence grading. Source links stay attached so claims can be checked directly.",
  },
  {
    title: "Published Dossiers",
    body: "Strong clusters become living dossiers with weird reads, skeptical reads, confirmed facts, open questions, X velocity, related videos, and generated visual assets.",
  },
  {
    title: "Reader Research",
    body: "The long-term product is a chat-enabled research room where users can interrogate each story, ask for opposing arguments, and trace claims back to primary material.",
  },
]

export default function HowItWorksPage() {
  return (
    <InvertedPageShell
      eyebrow="Research system"
      title="How It Works"
      heroTitle="How It Works"
      heroDescription="A daily intelligence desk for the unexplained, the classified, the misreported, and the stories moving fastest through independent media."
    >
      <div className="grid gap-5">
        <section className={cn("p-4 sm:p-5", archiveSurface)}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">The Goal</p>
              <h2 className="iw-serif mt-2 text-4xl leading-none text-[#fff8e6] sm:text-5xl">Ground-level velocity, archive-level memory.</h2>
            </div>
            <div className="grid gap-4 text-sm leading-7 text-[#f4efe2]/72">
              <p>
                Inverted World is built around the show, then expanded into a full news and archive product for the
                conspiracy, paranormal, intelligence, technology, and anomalous-science beat.
              </p>
              <p>
                The aim is simple: preserve the source material, catch the fastest-moving social signal, compare both
                sides of the coverage, and turn the strongest leads into sourced dossiers readers can inspect.
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Technical Shape</p>
              <h2 className="iw-serif mt-2 text-4xl leading-none text-[#fff8e6] sm:text-5xl">Recursiv is the publishing backbone.</h2>
              <div className="mt-4 grid gap-4 text-sm leading-7 text-[#f4efe2]/68">
                <p>
                  The front end is a Next.js reading experience. The backend direction is Recursiv-hosted state:
                  channel items, coverage snapshots, X signals, article drafts, generated assets, and scheduled jobs.
                </p>
                <p>
                  Provider keys stay server-side. Jobs collect signals, normalize sources, dedupe repeats, score velocity,
                  draft articles, prepare assets, and publish only the records meant for the site to read.
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
