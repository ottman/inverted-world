export type XPostLink = {
  id?: string
  topicId?: string
  url?: string
}

export function xPostAnchorId(post: XPostLink) {
  const rawKey = post.id || post.url || "post"
  const key = rawKey
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)

  return `signal-${key || "post"}`
}

export function xPostInternalHref(post: XPostLink, fallbackTopicId: string) {
  const topicId = post.topicId || fallbackTopicId
  return `/x/${encodeURIComponent(topicId)}#${xPostAnchorId(post)}`
}
