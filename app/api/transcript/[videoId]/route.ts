import { NextResponse } from "next/server"
import { getYouTubeTranscript } from "@/lib/youtube-transcript"

export const dynamic = "force-dynamic"
export const revalidate = 86_400

export async function GET(_request: Request, { params }: { params: { videoId: string } }) {
  const transcript = await getYouTubeTranscript(params.videoId)

  return NextResponse.json(transcript, {
    headers: {
      "cache-control": "s-maxage=86400, stale-while-revalidate=86400",
    },
  })
}
