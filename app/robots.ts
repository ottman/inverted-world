import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://invertedworld.on.recursiv.io/sitemap.xml",
    host: "https://invertedworld.on.recursiv.io",
  }
}
