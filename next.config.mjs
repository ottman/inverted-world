import { execSync } from "node:child_process"

function releaseBuildId() {
  const envCommit =
    process.env.RECURSIV_DEPLOY_COMMIT ||
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA
  if (envCommit) return envCommit.slice(0, 12)

  try {
    return execSync("git rev-parse --short=12 HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    return "manual-build"
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: async () => releaseBuildId(),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
