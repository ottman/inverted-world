import { NextRequest, NextResponse } from "next/server"
import { getDeepArchive } from "@/lib/deep-archive"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") || "100")
  const offset = Number(request.nextUrl.searchParams.get("offset") || "0")
  const archive = await getDeepArchive({ limit, offset, maxLimit: 500 })
  return NextResponse.json(archive)
}
