import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://www.inverted.world/sitemap.xml",
    host: "https://www.inverted.world",
  }
}
