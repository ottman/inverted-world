import type { MediaLibraryItem } from "@/data/inverted-world"

export function mediaItemHref(item: Pick<MediaLibraryItem, "id">) {
  return `/media/${encodeURIComponent(item.id)}`
}
