import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { InvertedPageShell, type BreakingItem } from "@/components/inverted-page-shell"
import { XSignalPage } from "@/components/x-signal-page"
import { topics } from "@/data/inverted-world"
import { xPostInternalHref } from "@/lib/x-links"
import { fetchViralXPostsForTopic } from "@/lib/x-posts"

type PageProps = {
  params: {
    topicId: string
  }
}

export const dynamic = "force-dynamic"
export const revalidate = 300

function getTopic(topicId: string) {
  return topics.find((topic) => topic.id === topicId)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const topic = getTopic(params.topicId)
  if (!topic) return { title: "X Signals | Inverted World" }

  return {
    title: `${topic.title} X Signals`,
    description: `Fresh viral X posts and live social signal tracking for ${topic.title}: ${topic.signal}`,
    alternates: {
      canonical: `/x/${topic.id}`,
    },
  }
}

export default async function XTopicPage({ params }: PageProps) {
  const topic = getTopic(params.topicId)
  if (!topic) notFound()

  const posts = await fetchViralXPostsForTopic(topic.id, { limit: 24 }).catch(() => [])
  const breakingItems: BreakingItem[] = posts.map((post) => ({
    title: post.text,
    href: xPostInternalHref(post, topic.id),
    source: post.username ? `@${post.username}` : "X",
  }))

  return (
    <InvertedPageShell
      eyebrow="LIVE Mon - Thurs at 10 p.m. EST"
      title={`${topic.title} X Signals`}
      heroTitle={`${topic.title} X Signals`}
      heroDescription={`Ranked posts and source leads for ${topic.signal.toLowerCase()}. Open a post, follow the original, or jump back into the related archive lane.`}
      breakingItems={breakingItems}
    >
      <XSignalPage topic={topic} initialPosts={posts} />
    </InvertedPageShell>
  )
}
