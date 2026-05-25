import { execSync } from "node:child_process"

function releaseBuildId() {
  const envCommit =
    process.env.RECURSIV_DEPLOY_COMMIT ||
    process.env.RECURSIV_DEPLOYMENT_COMMIT ||
    process.env.RECURSIV_SOURCE_REVISION ||
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COOLIFY_GIT_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
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
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ]
  },
}

export default nextConfig
