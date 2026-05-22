import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { topics } from "@/data/inverted-world"
import { fetchSourceDocuments, type SourceDocument } from "@/lib/recursiv/content"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 300

export const metadata: Metadata = {
  title: "Source Documents | Inverted World",
  description:
    "Primary records, court portals, declassified archives, science datasets, and news indexes used by Inverted World dossiers.",
  alternates: {
    canonical: "/documents",
  },
}

const kindLabels: Record<SourceDocument["kind"], string> = {
  government: "Government",
  science: "Science",
  archive: "Archive",
  legal: "Legal",
  "news-index": "News Index",
}

function hostName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "source"
  }
}

export default async function DocumentsPage() {
  const { sourceMode, documents } = await fetchSourceDocuments()
  const documentsByKind = documents.reduce<Record<string, number>>((counts, document) => {
    counts[document.kind] = (counts[document.kind] || 0) + 1
    return counts
  }, {})

  return (
    <InvertedPageShell
      eyebrow="Source shelf"
      title="Source Documents"
      heroTitle="Source Documents"
      heroDescription="Court records, declassified archives, official portals, science datasets, and news indexes for checking the claims behind each lane."
    >
      <div className="grid gap-5">
        <section className={cn("grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-6", archiveSurface)}>
          <div className="bg-black/24 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">Source Mode</p>
            <p className="iw-serif mt-2 text-3xl leading-none text-[#fff8e6]">
              {sourceMode === "recursiv-database" ? "Recursiv" : "Static"}
            </p>
          </div>
          {Object.entries(kindLabels).map(([kind, label]) => (
            <div key={kind} className="bg-black/24 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">{label}</p>
              <p className="iw-serif mt-2 text-4xl leading-none text-[#fff8e6]">{documentsByKind[kind] || 0}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          {topics.map((topic) => {
            const topicDocuments = documents.filter((document) => document.topicIds.includes(topic.id))
            return (
              <article key={topic.id} id={`topic-${topic.id}`} className={cn("p-4 sm:p-5", archiveSurface)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">{topic.title}</p>
                    <h2 className="iw-serif mt-2 text-4xl leading-none text-[#fff8e6]">{topic.signal}</h2>
                  </div>
                  <a
                    href={`/#topic-${topic.id}`}
                    className="shrink-0 bg-black/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/60 transition hover:text-[#fff8e6]"
                  >
                    Archive
                  </a>
                </div>

                <div className="mt-4 grid gap-2">
                  {topicDocuments.map((document) => (
                    <a
                      key={`${topic.id}-${document.url}`}
                      href={document.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group grid gap-2 bg-[#050504]/34 p-3 transition hover:bg-black/56"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#df2f2f]">
                          {kindLabels[document.kind]} / {document.source}
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-[#f4efe2]/38 group-hover:text-[#fff8e6]" />
                      </span>
                      <span className="text-sm leading-5 text-[#fff8e6]">{document.title}</span>
                      <span className="text-xs text-[#f4efe2]/44">{hostName(document.url)}</span>
                    </a>
                  ))}
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </InvertedPageShell>
  )
}
