import { NextRequest, NextResponse } from "next/server"
import { getTopic } from "@/data/inverted-world"
import { readAuthCookies } from "@/lib/auth-cookies"
import { recordChatExchange } from "@/lib/inverted-database"
import { createAuthedSdk, getRecursivSdk, RECURSIV_AGENT_ID } from "@/lib/recursiv"
import { callRecursivAgentText, ensureInvertedAgentConfig } from "@/lib/recursiv-agent"
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
  await ensureInvertedAgentConfig(sdk, agentId).catch(() => null)
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

function buildProviderOfflineResponse(localAnswer: string, errors: string[]) {
  return [
    localAnswer,
    "",
    "Agent note: live Recursiv synthesis is temporarily unreachable, so this response is a local source scaffold. Use it as a starting map, not a final answer.",
    ...errors.slice(0, 1).map((error) => `Status: ${error}`),
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
    await recordChatExchange(getDatabaseWriteSdk(recursiv.sdk), {
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
    const fallback = buildLocalResearchResponse(message, topic)
    const errors = [recursivError instanceof Error ? recursivError.message : "Recursiv agent unavailable"]
    return NextResponse.json({
      mode: "provider-offline",
      answer: buildProviderOfflineResponse(fallback.answer, errors),
      citations: fallback.citations,
      followUps: fallback.followUps,
      warning: errors.join(" | "),
    })
  }
}

function getDatabaseWriteSdk<T>(fallback: T) {
  try {
    return getRecursivSdk()
  } catch {
    return fallback
  }
}
