import type React from "react"
import { ArrowUpRight, Bot, Gauge, Radio } from "lucide-react"
import { archiveSurface, InvertedPageShell, type BreakingItem } from "@/components/inverted-page-shell"
import { fetchRecursivClaimDossiers, getLatestRecursivFrontPageEdition, getLatestRecursivPipelineRun } from "@/lib/recursiv/content"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 300

function formatScore(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`
  return String(Math.round(value))
}

function sectionArray(value: unknown) {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
}

function textField(value: unknown) {
  return typeof value === "string" ? value : ""
}

function formatPipelineRun(value?: string) {
  if (!value) return "pending"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

export default async function NewsPage() {
  const [edition, pipeline, dossiers] = await Promise.all([
    getLatestRecursivFrontPageEdition(),
    getLatestRecursivPipelineRun(),
    fetchRecursivClaimDossiers({ limit: 24 }).then((items) => items || []),
  ])
  const lead = dossiers[0]
  const editionArticles = sectionArray(edition?.sections.articles).slice(0, 5)
  const editionSignals = sectionArray(edition?.sections.xSignals).slice(0, 5)
  const breakingItems: BreakingItem[] = dossiers.slice(0, 18).map((dossier) => ({
    title: dossier.title,
    href: `/news/${dossier.slug}`,
    source: dossier.evidenceGrade,
  }))

  return (
    <InvertedPageShell
      eyebrow="Conspiracy-world intelligence desk"
      title="Inverted World News"
      breakingItems={breakingItems}
      heroTitle="Claim Dossiers"
      heroDescription="News coverage, X velocity, source split, evidence grading, and Tales archive context."
    >
      {edition ? (
        <section className={cn("mb-6 grid gap-4 p-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.55fr)]", archiveSurface)}>
          <div className="bg-[#050504]/36 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">
              <span>Published Edition</span>
              <span>{edition.editionDate}</span>
              <span>{Number(edition.metrics.articleCount || 0)} AI briefs</span>
              <span>{Number(edition.metrics.xSignalCount || 0)} X signals</span>
              <span>{pipeline?.status || "pipeline pending"} / {formatPipelineRun(pipeline?.completedAt)}</span>
            </div>
            <h2 className="iw-serif text-4xl leading-none text-[#fff8e6] sm:text-5xl">{edition.headline}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#f4efe2]/68">{edition.deck}</p>
          </div>
          <div className="grid gap-3 bg-black/24 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">Edition Leads</p>
            <div className="grid gap-2">
              {editionArticles.map((article) => (
                <a
                  key={textField(article.href) || textField(article.title)}
                  href={textField(article.href) || "/news"}
                  className="grid gap-1 bg-black/28 p-3 transition hover:bg-black/54"
                >
                  <span className="text-sm leading-5 text-[#fff8e6]">{textField(article.title)}</span>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[#f4efe2]/42">
                    {textField(article.source) || "Inverted World"} / heat {Number(article.heat || 0)}
                  </span>
                </a>
              ))}
            </div>
          </div>
          {editionSignals.length ? (
            <div className="lg:col-span-2 grid gap-2 bg-black/18 p-3 md:grid-cols-2 xl:grid-cols-5">
              {editionSignals.map((signal) => (
                <a
                  key={textField(signal.id) || textField(signal.href)}
                  href={textField(signal.href) || "/news"}
                  target={textField(signal.href).startsWith("http") ? "_blank" : undefined}
                  rel={textField(signal.href).startsWith("http") ? "noreferrer" : undefined}
                  className="bg-[#050504]/44 p-3 text-xs leading-5 text-[#f4efe2]/62 transition hover:bg-black/64 hover:text-[#fff8e6]"
                >
                  {textField(signal.text)}
                </a>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {lead ? (
        <section className={cn("grid gap-5 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]", archiveSurface)}>
          <a href={`/news/${lead.slug}`} className="group grid content-between gap-8 bg-[#050504]/38 p-5 transition hover:bg-black/62">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">
                <span>{lead.topic}</span>
                <span>{lead.evidenceGrade}</span>
                <span>{lead.sourceCount} sources</span>
              </div>
              <h2 className="iw-serif max-w-4xl text-5xl leading-[0.92] text-[#fff8e6] sm:text-7xl">
                {lead.title}
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-7 text-[#f4efe2]/72">{lead.summary}</p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#fff8e6]">
              Open dossier
              <ArrowUpRight className="h-4 w-4 text-[#df2f2f]" />
            </div>
          </a>

          <aside className="grid gap-3">
            <Metric icon={<Gauge className="h-4 w-4" />} label="Evidence" value={`${lead.confidenceScore}/100`} />
            <Metric icon={<Radio className="h-4 w-4" />} label="X Velocity" value={formatScore(lead.xVelocityScore)} />
            <Metric icon={<Bot className="h-4 w-4" />} label="Ask AI" value="Grounded" />
            <div className="bg-black/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">Viral Frames</p>
              <div className="mt-3 grid gap-2">
                {lead.viralHeadlines.slice(0, 4).map((headline) => (
                  <p key={headline} className="text-sm leading-5 text-[#f4efe2]/72">
                    {headline}
                  </p>
                ))}
              </div>
            </div>
          </aside>
        </section>
      ) : (
        <section className={cn("p-6 text-sm leading-6 text-[#f4efe2]/62", archiveSurface)}>
          No published claim dossiers yet. Run the Recursiv topic pulse and claim-dossier jobs to fill this desk.
        </section>
      )}

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dossiers.slice(1).map((dossier) => (
          <a
            key={dossier.slug}
            href={`/news/${dossier.slug}`}
            className="group grid min-h-[280px] content-between gap-6 bg-[#050504]/42 p-4 transition hover:bg-black/70"
          >
            <div>
              <div className="mb-3 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-[#f4efe2]/44">
                <span>{dossier.topic}</span>
                <span>{dossier.evidenceGrade}</span>
              </div>
              <h3 className="iw-serif text-3xl leading-none text-[#fff8e6] group-hover:text-[#df2f2f]">{dossier.title}</h3>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-[#f4efe2]/62">{dossier.summary}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.12em] text-[#f4efe2]/46">
              <span>{dossier.sourceCount} sources</span>
              <span>{dossier.xSignalCount} X</span>
              <span>{dossier.relatedVideoCount} videos</span>
            </div>
          </a>
        ))}
      </section>
    </InvertedPageShell>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-black/30 p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/48">
        {icon}
        {label}
      </div>
      <span className="iw-serif text-3xl leading-none text-[#fff8e6]">{value}</span>
    </div>
  )
}
