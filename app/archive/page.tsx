import { DeepArchivePage } from "@/components/deep-archive-page"
import { getDeepArchive } from "@/lib/deep-archive"

export const dynamic = "force-dynamic"
export const revalidate = 900

export default async function ArchivePage() {
  const initialArchive = await getDeepArchive({ limit: 24 })
  return <DeepArchivePage initialArchive={initialArchive} />
}
