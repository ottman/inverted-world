import { NextResponse } from "next/server"
import { getArchiveVideo } from "@/lib/deep-archive"
import { getYouTubeTranscript, transcriptFromText } from "@/lib/youtube-transcript"

export const dynamic = "force-dynamic"
export const revalidate = 86_400

export async function GET(_request: Request, { params }: { params: { videoId: string } }) {
  const video = await getArchiveVideo(params.videoId, { allowProviderFallbacks: false })
  const transcript = video?.transcript
    ? transcriptFromText(video.videoId || params.videoId, video.transcript)
    : await getYouTubeTranscript(params.videoId, { allowProviderFallbacks: false })

  return NextResponse.json(transcript, {
    headers: {
      "cache-control": "s-maxage=86400, stale-while-revalidate=86400",
    },
  })
}
