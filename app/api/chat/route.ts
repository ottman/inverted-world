import { NextRequest, NextResponse } from "next/server"
import { getTopic } from "@/data/inverted-world"
import { readAuthCookies } from "@/lib/auth-cookies"
import { callClaudeGateway } from "@/lib/claude"
import { recordChatExchange } from "@/lib/inverted-database"
import { createAuthedSdk, getRecursivSdk, RECURSIV_AGENT_ID } from "@/lib/recursiv"
import { callRecursivAgentText } from "@/lib/recursiv-agent"
import { buildLocalResearchResponse, buildResearchPrompt, suggestFollowUps } from "@/lib/research-prompt"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function callRecursivAgent(request: NextRequest, prompt: string, conversationId?: string) {
  const auth = readAuthCookies(request)
  const agentId = auth.agentId || RECURSIV_AGENT_ID

  if (!agentId) {
    throw new Error("RECURSIV_AGENT_ID is not configured")
  }

  const sdk = auth.apiKey ? createAuthedSdk(auth.apiKey) : getRecursivSdk()
  const response = await callRecursivAgentText(sdk, {
    agentId,
    prompt,
    conversationId,
    newConversation: !conversationId,
  })

  return {
    ...response,
    sdk,
    userId: auth.userId,
  }
}

function buildProviderOfflineResponse(message: string, errors: string[]) {
  return [
    "The live model path is not currently reachable from this deployment.",
    "",
    "What I can verify from the app path:",
    ...errors.map((error) => `- ${error}`),
    "",
    "Required fix:",
    "- Repair the Recursiv managed agent provider first. Direct Anthropic/OpenRouter is only the emergency fallback.",
    "",
    "Once that is done, this same box should answer freeform questions about conspiracies, paranormal claims, documents, networks, and open questions without filters.",
    "",
    `Your prompt was: ${message}`,
  ].join("\n")
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string
    topicId?: string
    conversationId?: string
  }

  const message = body.message?.trim()
  const topic = getTopic(body.topicId)
  const conversationId = body.conversationId?.trim() || undefined

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const prompt = buildResearchPrompt(message, topic.id)

  try {
    const recursiv = await callRecursivAgent(request, prompt, conversationId)
    await recordChatExchange(recursiv.sdk, {
      userId: recursiv.userId,
      conversationId: recursiv.conversationId,
      topicId: topic.id,
      userMessage: message,
      assistantMessage: recursiv.answer,
      mode: "recursiv-agent",
    }).catch(() => null)

    return NextResponse.json({
      mode: "recursiv-agent",
      answer: recursiv.answer,
      conversationId: recursiv.conversationId,
      citations: [],
      followUps: suggestFollowUps(message, topic),
    })
  } catch (recursivError) {
    try {
      const llm = await callClaudeGateway(prompt)
      return NextResponse.json({
        mode: llm.mode,
        answer: llm.answer,
        conversationId,
        citations: [],
        followUps: suggestFollowUps(message, topic),
      })
    } catch (llmError) {
      const fallback = buildLocalResearchResponse(message, topic)
      const errors = [
        recursivError instanceof Error ? recursivError.message : "Recursiv agent unavailable",
        llmError instanceof Error ? llmError.message : "Claude/OpenRouter unavailable",
      ]
      return NextResponse.json({
        mode: "provider-offline",
        answer: buildProviderOfflineResponse(message, errors),
        citations: fallback.citations,
        followUps: fallback.followUps,
        warning: errors.join(" | "),
      })
    }
  }
}
