import type { MetadataRoute } from "next"
import { getDeepArchive } from "@/lib/deep-archive"

const baseUrl = "https://invertedworld.on.recursiv.io"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/archive"].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "hourly",
    priority: path === "" ? 1 : 0.8,
  }))

  try {
    const archive = await getDeepArchive({ limit: 1000, maxLimit: 1000 })
    const videoRoutes: MetadataRoute.Sitemap = archive.videos
      .filter((video) => video.videoId)
      .map((video) => ({
        url: `${baseUrl}/archive/${video.videoId}`,
        lastModified: video.date ? new Date(video.date) : new Date(archive.generatedAt),
        changeFrequency: "weekly",
        priority: 0.72,
      }))

    return [...staticRoutes, ...videoRoutes]
  } catch {
    return staticRoutes
  }
}
