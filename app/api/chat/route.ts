import { NextRequest, NextResponse } from "next/server"
import { getTopic } from "@/data/inverted-world"
import { callClaudeGateway } from "@/lib/claude"
import { getRecursivSdk, RECURSIV_AGENT_ID } from "@/lib/recursiv"
import { buildLocalResearchResponse, buildResearchPrompt } from "@/lib/research-prompt"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function callRecursivAgent(prompt: string) {
  if (!RECURSIV_AGENT_ID) {
    throw new Error("RECURSIV_AGENT_ID is not configured")
  }

  const sdk = getRecursivSdk()
  const stream = sdk.agents.chatStream(RECURSIV_AGENT_ID, { message: prompt })
  let answer = ""
  let conversationId = ""

  for await (const chunk of stream as AsyncIterable<{
    delta?: string
    content?: string
    conversation_id?: string
  }>) {
    answer += chunk.delta ?? chunk.content ?? ""
    if (chunk.conversation_id) conversationId = chunk.conversation_id
  }

  if (!answer.trim()) {
    throw new Error("Recursiv agent returned an empty response")
  }

  return { answer, conversationId }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string
    topicId?: string
  }

  const message = body.message?.trim()
  const topic = getTopic(body.topicId)

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const prompt = buildResearchPrompt(message, topic.id)

  try {
    const recursiv = await callRecursivAgent(prompt)
    return NextResponse.json({
      mode: "recursiv-agent",
      answer: recursiv.answer,
      conversationId: recursiv.conversationId,
      citations: [],
    })
  } catch (recursivError) {
    try {
      const llm = await callClaudeGateway(prompt)
      return NextResponse.json({
        mode: llm.mode,
        answer: llm.answer,
        citations: [],
      })
    } catch (llmError) {
      const fallback = buildLocalResearchResponse(message, topic)
      return NextResponse.json({
        ...fallback,
        warning: [
          recursivError instanceof Error ? recursivError.message : "Recursiv agent unavailable",
          llmError instanceof Error ? llmError.message : "Claude/OpenRouter unavailable",
        ].join(" | "),
      })
    }
  }
}
