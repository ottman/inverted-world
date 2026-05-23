import { NextResponse } from "next/server"
import { INVERTED_WORLD_RELEASE } from "@/lib/release"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function publicEnv(name: string) {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : null
}

export async function GET() {
  return NextResponse.json({
    ...INVERTED_WORLD_RELEASE,
    generatedAt: new Date().toISOString(),
    deployment: {
      projectId: publicEnv("NEXT_PUBLIC_RECURSIV_PROJECT_ID") || publicEnv("RECURSIV_PROJECT_ID"),
      siteUrl: publicEnv("INVERTED_WORLD_SITE_URL"),
      vercelGitCommitSha: publicEnv("VERCEL_GIT_COMMIT_SHA"),
      recursivDeploymentId: publicEnv("RECURSIV_DEPLOYMENT_ID"),
    },
  })
}

