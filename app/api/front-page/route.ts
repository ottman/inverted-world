import { NextResponse } from "next/server"
import { getLatestRecursivFrontPageEdition, getLatestRecursivPipelineRun } from "@/lib/recursiv/content"

export const dynamic = "force-dynamic"

export async function GET() {
  const [edition, pipeline] = await Promise.all([getLatestRecursivFrontPageEdition(), getLatestRecursivPipelineRun()])

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    edition,
    pipeline,
  })
}
