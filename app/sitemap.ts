import type { MetadataRoute } from "next"
import { getDeepArchive } from "@/lib/deep-archive"
import { fetchRecursivClaimDossiers } from "@/lib/recursiv/content"

const baseUrl = "https://www.inverted.world"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/archive", "/news", "/research", "/terms", "/privacy", "/llms.txt"].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "hourly",
    priority:
      path === ""
        ? 1
        : path === "/news"
          ? 0.94
          : path === "/archive" || path === "/research"
            ? 0.92
            : path === "/terms" || path === "/privacy"
              ? 0.42
              : 0.62,
  }))

  try {
    const archive = await getDeepArchive({ limit: 1000, maxLimit: 1000, allowProviderFallbacks: false })
    const videoRoutes: MetadataRoute.Sitemap = archive.videos
      .filter((video) => video.videoId)
      .map((video) => ({
        url: `${baseUrl}/archive/${video.videoId}`,
        lastModified: video.date ? new Date(video.date) : new Date(archive.generatedAt),
        changeFrequency: "daily",
        priority: 0.86,
      }))

    const dossiers = (await fetchRecursivClaimDossiers({ limit: 50 })) || []
    const dossierRoutes: MetadataRoute.Sitemap = dossiers.map((dossier) => ({
      url: `${baseUrl}/news/${dossier.slug}`,
      lastModified: dossier.publishedAt ? new Date(dossier.publishedAt) : new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    }))

    return [...staticRoutes, ...dossierRoutes, ...videoRoutes]
  } catch {
    return staticRoutes
  }
}
