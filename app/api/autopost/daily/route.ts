import { NextResponse } from "next/server"
import { buildDailyAutopostPacket } from "@/lib/recursiv/daily-autopost"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await buildDailyAutopostPacket())
}
