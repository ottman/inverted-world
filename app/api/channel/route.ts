import { NextResponse } from "next/server"
import {
  channelProfile,
  featuredVideos,
  researchDocuments,
  socialLinks,
  topics,
} from "@/data/inverted-world"
import { intelligenceArticles } from "@/data/intelligence-articles"
import { getRecursivStatus } from "@/lib/recursiv"
import { INVERTED_AGENT_MODEL } from "@/lib/recursiv-agent"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    channel: channelProfile,
    socials: socialLinks,
    topics,
    featuredVideos,
    articleCount: intelligenceArticles.length,
    researchDocuments,
    ai: {
      provider: "recursiv-managed-agent",
      model: INVERTED_AGENT_MODEL,
      directOpenRouter: false,
    },
    recursiv: getRecursivStatus(),
  })
}
