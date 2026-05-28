import type { Metadata } from "next"
import Waves from "@/components/Waves"
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
    <main className="relative min-h-screen overflow-hidden bg-[#070706] text-[#f4efe2]">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-95">
        <Waves
          lineColor="rgba(244, 239, 226, 0.42)"
          backgroundColor="#070706"
          waveSpeedX={0.008}
          waveSpeedY={0.005}
          waveAmpX={30}
          waveAmpY={18}
          xGap={13}
          yGap={38}
          friction={0.92}
          tension={0.004}
          maxCursorMove={78}
        />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(7,7,6,0.10),rgba(7,7,6,0.82))]" />
      <div className="relative z-10 grid min-h-screen place-items-center px-4 py-10 sm:px-6 lg:px-8">
        <ResearchChat />
      </div>
    </main>
  )
}
