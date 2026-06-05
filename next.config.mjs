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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'unsafe-inline' covers Next.js hydration + Tailwind/inline styles (no nonce pipeline yet).
              // va.vercel-scripts.com = Vercel Analytics. Add ad/script domains here when wiring Ads.
              "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://pagead2.googlesyndication.com https://adservice.google.com https://www.googletagservices.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Rights-cleared images come from arbitrary CC/PD hosts + Pollinations; allow any https + data.
              "img-src 'self' data: https:",
              "media-src 'self' https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://va.vercel-scripts.com https://pagead2.googlesyndication.com",
              "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
            ].join("; "),
          },
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
