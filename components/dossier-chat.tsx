"use client"

import { useEffect, useState } from "react"
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
              {item.text}
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
