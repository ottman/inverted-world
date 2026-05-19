import { NextRequest, NextResponse } from "next/server"
import { getTopic } from "@/data/inverted-world"
import { callClaudeGateway } from "@/lib/claude"
import { getRecursivSdk, RECURSIV_AGENT_ID } from "@/lib/recursiv"
import { buildLocalResearchResponse, buildResearchPrompt, suggestFollowUps } from "@/lib/research-prompt"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function callRecursivAgent(prompt: string) {
  if (!RECURSIV_AGENT_ID) {
    throw new Error("RECURSIV_AGENT_ID is not configured")
  }

  const sdk = getRecursivSdk()
  const { content, conversationId } = await sdk.agents.chatStreamText(RECURSIV_AGENT_ID, { message: prompt })
  const answer = content.trim()

  if (!answer) throw new Error("Recursiv agent returned an empty response")

  return { answer, conversationId }
}

function buildProviderOfflineResponse(message: string, errors: string[]) {
  return [
    "Claude is not currently reachable from this deployment.",
    "",
    "What I can verify from the app path:",
    ...errors.map((error) => `- ${error}`),
    "",
    "Required fix:",
    "- Fund the OpenRouter key used by this project, or attach a valid Anthropic key, or repair the Recursiv agent provider key.",
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
      followUps: suggestFollowUps(message, topic),
    })
  } catch (recursivError) {
    try {
      const llm = await callClaudeGateway(prompt)
      return NextResponse.json({
        mode: llm.mode,
        answer: llm.answer,
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
