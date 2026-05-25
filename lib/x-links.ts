export type XPostLink = {
  id?: string
  topicId?: string
  url?: string
  username?: string
}

const X_STATUS_URL_PATTERN = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)\/status\/(\d+)/i

export function xPostAnchorId(post: XPostLink) {
  const rawKey = post.id || post.url || "post"
  const key = rawKey
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)

  return `signal-${key || "post"}`
}

function xStatusParts(post: XPostLink) {
  const urlMatch = post.url?.match(X_STATUS_URL_PATTERN)
  const id = post.id?.match(/^\d{8,}$/) ? post.id : urlMatch?.[2]
  const username = post.username || urlMatch?.[1]
  return { id, username }
}

export function xPostExternalHref(post: XPostLink) {
  const { id, username } = xStatusParts(post)
  if (id) return username ? `https://x.com/${username}/status/${id}` : `https://x.com/i/web/status/${id}`
  return post.url || "https://x.com"
}

export function xPostInternalHref(post: XPostLink, fallbackTopicId: string) {
  const topicId = post.topicId || fallbackTopicId
  return `/x/${encodeURIComponent(topicId)}#${xPostAnchorId(post)}`
}
