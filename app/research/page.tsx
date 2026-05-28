import type { Metadata } from "next"
import { InvertedPageShell } from "@/components/inverted-page-shell"
import { ResearchChat } from "@/components/research-chat"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Research | Inverted World",
  description: "Research any topic through the Inverted World truth-seeking lens.",
  alternates: {
    canonical: "/research",
  },
}

export default function ResearchPage() {
  return (
    <InvertedPageShell
      eyebrow="Research"
      title="Research"
      heroTitle="Research"
      showHero={false}
      mainClassName="grid min-h-[calc(100vh-16rem)] place-items-center py-12 sm:py-16 lg:py-20"
    >
      <ResearchChat />
    </InvertedPageShell>
  )
}
