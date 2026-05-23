import { NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { INVERTED_WORLD_RELEASE } from "@/lib/release"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function publicEnv(name: string) {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : null
}

function readBuildId() {
  try {
    return fs.readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || null
  } catch {
    return null
  }
}

function commitLikeBuildId(value: string | null) {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return /^[a-f0-9]{7,40}$/.test(normalized) ? normalized : null
}

function sourceRevision(buildId: string | null) {
  const pairs = [
    ["RECURSIV_DEPLOY_COMMIT", publicEnv("RECURSIV_DEPLOY_COMMIT")],
    ["RECURSIV_DEPLOYMENT_COMMIT", publicEnv("RECURSIV_DEPLOYMENT_COMMIT")],
    ["RECURSIV_SOURCE_REVISION", publicEnv("RECURSIV_SOURCE_REVISION")],
    ["NEXT_PUBLIC_GIT_COMMIT_SHA", publicEnv("NEXT_PUBLIC_GIT_COMMIT_SHA")],
    ["GIT_COMMIT_SHA", publicEnv("GIT_COMMIT_SHA")],
    ["VERCEL_GIT_COMMIT_SHA", publicEnv("VERCEL_GIT_COMMIT_SHA")],
    ["COOLIFY_GIT_COMMIT_SHA", publicEnv("COOLIFY_GIT_COMMIT_SHA")],
    ["CF_PAGES_COMMIT_SHA", publicEnv("CF_PAGES_COMMIT_SHA")],
    ["GITHUB_SHA", publicEnv("GITHUB_SHA")],
    ["NEXT_BUILD_ID", commitLikeBuildId(buildId)],
  ] as const
  const match = pairs.find(([, value]) => value)
  return {
    value: match?.[1] || null,
    source: match?.[0] || null,
  }
}

export async function GET() {
  const buildId = readBuildId()
  const revision = sourceRevision(buildId)

  return NextResponse.json({
    ...INVERTED_WORLD_RELEASE,
    generatedAt: new Date().toISOString(),
    deployment: {
      projectId: publicEnv("NEXT_PUBLIC_RECURSIV_PROJECT_ID") || publicEnv("RECURSIV_PROJECT_ID"),
      siteUrl: publicEnv("INVERTED_WORLD_SITE_URL"),
      vercelGitCommitSha: publicEnv("VERCEL_GIT_COMMIT_SHA"),
      recursivDeploymentId: publicEnv("RECURSIV_DEPLOYMENT_ID"),
      buildId,
      sourceRevision: revision.value,
      sourceRevisionSource: revision.source,
    },
  })
}
