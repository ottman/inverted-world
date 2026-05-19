import { NextResponse } from "next/server"
import { getDeepArchive } from "@/lib/deep-archive"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const archive = await getDeepArchive()
  return NextResponse.json(archive)
}
