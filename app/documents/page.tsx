import { Database, ExternalLink } from "lucide-react"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { researchDocuments, topics } from "@/data/inverted-world"
import { cn } from "@/lib/utils"

export default function DocumentsPage() {
  return (
    <InvertedPageShell eyebrow={`${researchDocuments.length} source lanes`} title="Documents">
      <div className={cn("mb-5 grid gap-3 p-4 sm:grid-cols-3", archiveSurface)}>
        <Metric label="official" value={String(researchDocuments.filter((doc) => doc.kind === "government").length)} />
        <Metric label="archives" value={String(researchDocuments.filter((doc) => doc.kind === "archive").length)} />
        <Metric label="legal + science" value={String(researchDocuments.filter((doc) => doc.kind === "legal" || doc.kind === "science").length)} />
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {topics.map((topic) => (
          <a
            key={topic.id}
            href={`/api/documents?topic=${topic.id}`}
            className="shrink-0 rounded-md border border-[#f4efe2]/12 bg-[#070706]/24 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/62 transition hover:border-[#e8b45c]/45 hover:text-[#fff8e6]"
          >
            {topic.title}
          </a>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {researchDocuments.map((doc) => (
          <a
            key={`${doc.source}-${doc.title}`}
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className={cn("group min-h-[170px] p-4 transition hover:border-[#7dd3fc]/55", archiveSurface)}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <Database className="h-5 w-5 text-[#e8b45c]" />
              <ExternalLink className="h-4 w-4 text-[#f4efe2]/38 transition group-hover:text-[#7dd3fc]" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/42">{doc.kind}</p>
            <h2 className="mt-3 text-base font-semibold leading-6 text-[#fff8e6]">{doc.title}</h2>
            <p className="mt-3 text-sm text-[#f4efe2]/52">{doc.source}</p>
          </a>
        ))}
      </div>
    </InvertedPageShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#f4efe2]/10 bg-[#050504]/30 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/44">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#fff8e6]">{value}</p>
    </div>
  )
}
