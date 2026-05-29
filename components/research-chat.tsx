"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp, Loader2 } from "lucide-react"
import { MarkdownText } from "@/components/dossier-chat"
import { cn } from "@/lib/utils"

type Message = {
  role: "user" | "assistant"
  text: string
}

function randomConversationId() {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `research-${suffix}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 128)
}

export function ResearchChat() {
  const [message, setMessage] = useState("")
  const [conversationId, setConversationId] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem("inverted-world-research")
    const nextConversationId = stored || randomConversationId()
    window.localStorage.setItem("inverted-world-research", nextConversationId)
    setConversationId(nextConversationId)
  }, [])

  // Keep the latest message (and the loading indicator) in view as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  async function submit() {
    const value = message.replace(/\s+/g, " ").trim()
    if (!value || loading) return
    const nextConversationId = conversationId || randomConversationId()
    if (!conversationId) setConversationId(nextConversationId)

    // Recursiv is stateless across turns, so send recent history for multi-turn context.
    const history = messages.slice(-6)

    setLoading(true)
    setError("")
    setMessage("")
    setMessages((current) => [...current, { role: "user", text: value }])

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: value, conversationId: nextConversationId, history }),
      })
      const data = (await response.json()) as { response?: string; conversationId?: string; error?: string }
      if (!response.ok) throw new Error(data.error || `Research returned ${response.status}`)
      const responseConversationId = data.conversationId || nextConversationId
      window.localStorage.setItem("inverted-world-research", responseConversationId)
      setConversationId(responseConversationId)
      setMessages((current) => [...current, { role: "assistant", text: data.response || "" }])
    } catch (error) {
      setError(error instanceof Error ? error.message : "Research failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="iw-serif grid w-full max-w-4xl gap-5">
      {messages.length || loading ? (
        <div ref={scrollRef} className="grid max-h-[58vh] gap-4 overflow-y-auto pr-1">
          {messages.map((item, index) => (
            <article
              key={`${item.role}-${index}`}
              className={cn(
                "max-w-[94%] bg-[#050504]/46 p-4 text-2xl leading-[1.05] text-[#f4efe2]/82 backdrop-blur-[2px] sm:p-5 sm:text-3xl",
                item.role === "user" ? "justify-self-end text-[#fff8e6]" : "justify-self-start",
              )}
            >
              {item.role === "assistant" ? <MarkdownText text={item.text} /> : item.text}
            </article>
          ))}
          {loading ? (
            <article className="flex max-w-[94%] items-center gap-3 justify-self-start bg-[#050504]/46 p-4 text-2xl leading-[1.05] text-[#f4efe2]/82 backdrop-blur-[2px] sm:p-5 sm:text-3xl">
              <Loader2 className="h-6 w-6 animate-spin text-[#df2f2f]" />
              <span className="text-[#f4efe2]/64">Researching...</span>
            </article>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-center text-xl leading-none text-[#df2f2f]">{error}</p> : null}

      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end bg-[#050504]/58 p-2 shadow-[0_0_0_1px_rgba(244,239,226,0.10)] backdrop-blur-[2px] focus-within:shadow-[0_0_0_1px_rgba(223,47,47,0.42)]">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void submit()
              }
            }}
            rows={1}
            maxLength={2000}
            className="iw-serif max-h-44 min-h-14 resize-none bg-transparent px-3 py-3 text-3xl leading-none text-[#fff8e6] outline-none placeholder:text-[#f4efe2]/36 sm:text-5xl"
            placeholder="Research anything..."
          />
          <button
            type="submit"
            disabled={loading || !message.trim()}
            aria-label="Research"
            className="grid h-12 w-12 place-items-center bg-[#df2f2f]/14 text-[#fff8e6] transition hover:bg-[#df2f2f]/26 disabled:cursor-wait disabled:opacity-45 sm:h-14 sm:w-14"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </button>
        </div>
      </form>
    </section>
  )
}
