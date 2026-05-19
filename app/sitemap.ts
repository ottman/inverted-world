import type { MetadataRoute } from "next"
import { intelligenceArticles } from "@/data/intelligence-articles"
import { getDeepArchive } from "@/lib/deep-archive"

const baseUrl = "https://invertedworld.on.recursiv.io"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/archive", "/news", "/documents"].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/archive" ? "hourly" : "daily",
    priority: path === "" ? 1 : 0.8,
  }))

  try {
    const archive = await getDeepArchive({ limit: 1000, maxLimit: 1000 })
    const articleRoutes: MetadataRoute.Sitemap = intelligenceArticles.map((article) => ({
      url: `${baseUrl}/news/${article.id}`,
      lastModified: new Date(article.publishedAt),
      changeFrequency: "weekly",
      priority: 0.7,
    }))
    const videoRoutes: MetadataRoute.Sitemap = archive.videos
      .filter((video) => video.videoId)
      .map((video) => ({
        url: `${baseUrl}/archive/${video.videoId}`,
        lastModified: video.date ? new Date(video.date) : new Date(archive.generatedAt),
        changeFrequency: "weekly",
        priority: 0.72,
      }))

    return [...staticRoutes, ...articleRoutes, ...videoRoutes]
  } catch {
    const articleRoutes: MetadataRoute.Sitemap = intelligenceArticles.map((article) => ({
      url: `${baseUrl}/news/${article.id}`,
      lastModified: new Date(article.publishedAt),
      changeFrequency: "weekly",
      priority: 0.7,
    }))
    return [...staticRoutes, ...articleRoutes]
  }
}
