import type { MetadataRoute } from "next"
import { getDeepArchive } from "@/lib/deep-archive"

const baseUrl = "https://www.inverted.world"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/archive", "/llms.txt"].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "hourly",
    priority: path === "" ? 1 : path === "/archive" ? 0.92 : 0.62,
  }))

  try {
    const archive = await getDeepArchive({ limit: 1000, maxLimit: 1000 })
    const videoRoutes: MetadataRoute.Sitemap = archive.videos
      .filter((video) => video.videoId)
      .map((video) => ({
        url: `${baseUrl}/archive/${video.videoId}`,
        lastModified: video.date ? new Date(video.date) : new Date(archive.generatedAt),
        changeFrequency: "daily",
        priority: 0.86,
      }))

    return [...staticRoutes, ...videoRoutes]
  } catch {
    return staticRoutes
  }
}
