"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Send } from "lucide-react"
import { cn } from "@/lib/utils"

type Message = {
  role: "user" | "assistant"
  text: string
}

type StoredChatMessage = {
  conversationId?: string
  message?: string
  response?: string
}

export function DossierChat({ slug }: { slug: string }) {
  const [message, setMessage] = useState("")
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function loadMessages() {
      try {
        const response = await fetch(`/api/dossiers/${slug}/chat?limit=6`, {
          headers: { accept: "application/json" },
        })
        if (!response.ok) return
        const data = (await response.json()) as { messages?: StoredChatMessage[] }
        if (!active || !data.messages?.length) return
        const hydrated = data.messages.flatMap((item) => {
          const items: Message[] = []
          if (item.message) items.push({ role: "user", text: item.message })
          if (item.response) items.push({ role: "assistant", text: item.response })
          return items
        })
        setMessages(hydrated)
        const latestConversationId = [...data.messages].reverse().find((item) => item.conversationId)?.conversationId
        setConversationId(latestConversationId)
      } catch {
        // History is a convenience layer; posting a new question should still work if this read fails.
      }
    }

    void loadMessages()

    return () => {
      active = false
    }
  }, [slug])

  async function submit() {
    const value = message.replace(/\s+/g, " ").trim()
    if (!value || loading) return

    setLoading(true)
    setError("")
    setMessage("")
    setMessages((current) => [...current, { role: "user", text: value }])

    try {
      const response = await fetch(`/api/dossiers/${slug}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: value, conversationId }),
      })
      const data = (await response.json()) as { response?: string; conversationId?: string; error?: string }
      if (!response.ok) throw new Error(data.error || `Chat returned ${response.status}`)
      setConversationId(data.conversationId)
      setMessages((current) => [...current, { role: "assistant", text: data.response || "" }])
    } catch (error) {
      setError(error instanceof Error ? error.message : "Chat failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="grid gap-3 bg-[#050504]/42 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">Ask This Story</h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#df2f2f]">AI</span>
      </div>

      <div className="grid min-h-[120px] gap-3">
        {messages.length ? (
          messages.map((item, index) => (
            <div
              key={`${item.role}-${index}`}
              className={cn(
                "max-w-[92%] p-3 text-sm leading-6",
                item.role === "user"
                  ? "justify-self-end bg-[#df2f2f]/14 text-[#fff8e6]"
                  : "justify-self-start bg-black/36 text-[#f4efe2]/78",
              )}
            >
              {item.role === "assistant" ? <MarkdownText text={item.text} /> : item.text}
            </div>
          ))
        ) : (
          <div className="grid place-items-center bg-black/28 p-4 text-center text-sm leading-6 text-[#f4efe2]/54">
            Ask what is documented, what is alleged, what is missing, or which sources matter most.
          </div>
        )}
      </div>

      {error ? <p className="text-xs text-[#df2f2f]">{error}</p> : null}

      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="h-11 min-w-0 bg-black/42 px-3 text-sm text-[#fff8e6] outline-none ring-1 ring-[#f4efe2]/10 placeholder:text-[#f4efe2]/34 focus:ring-[#df2f2f]/48"
          placeholder="Ask about the evidence..."
          maxLength={1200}
        />
        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 bg-[#df2f2f]/14 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:bg-[#df2f2f]/24 disabled:cursor-wait disabled:opacity-55"
        >
          <Send className="h-4 w-4" />
          Ask
        </button>
      </form>
    </section>
  )
}

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }

function MarkdownText({ text }: { text: string }) {
  const blocks = parseMarkdownBlocks(text)

  return (
    <div className="grid gap-3">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5"
          return (
            <Heading key={`${block.type}-${index}`} className="iw-serif text-2xl leading-none text-[#fff8e6]">
              {renderInlineMarkdown(block.text)}
            </Heading>
          )
        }

        if (block.type === "ul" || block.type === "ol") {
          const List = block.type === "ul" ? "ul" : "ol"
          return (
            <List
              key={`${block.type}-${index}`}
              className={cn(
                "grid gap-1 pl-5 text-sm leading-6",
                block.type === "ul" ? "list-disc" : "list-decimal",
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </List>
          )
        }

        if (block.type === "quote") {
          return (
            <blockquote key={`${block.type}-${index}`} className="border-l border-[#df2f2f]/48 pl-3 text-[#f4efe2]/68">
              {renderInlineMarkdown(block.text)}
            </blockquote>
          )
        }

        if (block.type === "code") {
          return (
            <pre key={`${block.type}-${index}`} className="overflow-x-auto bg-black/44 p-3 text-xs leading-5 text-[#f4efe2]/72">
              <code>{block.text}</code>
            </pre>
          )
        }

        return <p key={`${block.type}-${index}`}>{renderInlineMarkdown(block.text)}</p>
      })}
    </div>
  )
}

function parseMarkdownBlocks(value: string): MarkdownBlock[] {
  const lines = value.replace(/\r\n/g, "\n").split("\n")
  const blocks: MarkdownBlock[] = []
  let paragraph: string[] = []
  let list: { type: "ul" | "ol"; items: string[] } | null = null
  let code: string[] | null = null

  function flushParagraph() {
    if (!paragraph.length) return
    blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() })
    paragraph = []
  }

  function flushList() {
    if (!list) return
    blocks.push(list)
    list = null
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("```")) {
      flushParagraph()
      flushList()
      if (code) {
        blocks.push({ type: "code", text: code.join("\n") })
        code = null
      } else {
        code = []
      }
      continue
    }

    if (code) {
      code.push(line)
      continue
    }

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() })
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (unorderedMatch) {
      flushParagraph()
      if (!list || list.type !== "ul") {
        flushList()
        list = { type: "ul", items: [] }
      }
      list.items.push(unorderedMatch[1].trim())
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushParagraph()
      if (!list || list.type !== "ol") {
        flushList()
        list = { type: "ol", items: [] }
      }
      list.items.push(orderedMatch[1].trim())
      continue
    }

    const quoteMatch = trimmed.match(/^>\s?(.+)$/)
    if (quoteMatch) {
      flushParagraph()
      flushList()
      blocks.push({ type: "quote", text: quoteMatch[1].trim() })
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }

  if (code) blocks.push({ type: "code", text: code.join("\n") })
  flushParagraph()
  flushList()

  return blocks.length ? blocks : [{ type: "paragraph", text: value }]
}

function renderInlineMarkdown(value: string) {
  const nodes: ReactNode[] = []
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|(https?:\/\/[^\s)]+))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) nodes.push(value.slice(lastIndex, match.index))

    if (match[2] && match[3]) {
      nodes.push(
        <a
          key={`link-${match.index}`}
          href={match[3]}
          target={match[3].startsWith("http") ? "_blank" : undefined}
          rel={match[3].startsWith("http") ? "noreferrer" : undefined}
          className="text-[#dff7ff] underline decoration-[#df2f2f]/45 underline-offset-4 transition hover:text-[#fff8e6]"
        >
          {match[2]}
        </a>,
      )
    } else if (match[4]) {
      nodes.push(
        <code key={`code-${match.index}`} className="bg-black/42 px-1.5 py-0.5 text-[0.92em] text-[#fff8e6]">
          {match[4]}
        </code>,
      )
    } else if (match[5]) {
      nodes.push(
        <strong key={`strong-${match.index}`} className="font-semibold text-[#fff8e6]">
          {match[5]}
        </strong>,
      )
    } else if (match[6]) {
      nodes.push(
        <em key={`em-${match.index}`} className="text-[#fff8e6]/88">
          {match[6]}
        </em>,
      )
    } else if (match[7]) {
      nodes.push(
        <a
          key={`url-${match.index}`}
          href={match[7]}
          target="_blank"
          rel="noreferrer"
          className="text-[#dff7ff] underline decoration-[#df2f2f]/45 underline-offset-4 transition hover:text-[#fff8e6]"
        >
          {match[7]}
        </a>,
      )
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < value.length) nodes.push(value.slice(lastIndex))
  return nodes
}
