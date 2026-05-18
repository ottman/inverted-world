import { NextResponse } from "next/server"
import {
  channelProfile,
  featuredVideos,
  researchDocuments,
  socialLinks,
  topics,
} from "@/data/inverted-world"
import { getRecursivStatus } from "@/lib/recursiv"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    channel: channelProfile,
    socials: socialLinks,
    topics,
    featuredVideos,
    researchDocuments,
    recursiv: getRecursivStatus(),
  })
}
