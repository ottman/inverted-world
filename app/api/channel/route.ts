import { NextResponse } from "next/server"
import {
  channelProfile,
  featuredVideos,
  researchDocuments,
  socialLinks,
  topics,
} from "@/data/inverted-world"
import { intelligenceArticles } from "@/data/intelligence-articles"
import { getClaudeStatus } from "@/lib/claude"
import { getRecursivStatus } from "@/lib/recursiv"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    channel: channelProfile,
    socials: socialLinks,
    topics,
    featuredVideos,
    articleCount: intelligenceArticles.length,
    researchDocuments,
    claude: getClaudeStatus(),
    recursiv: getRecursivStatus(),
  })
}
