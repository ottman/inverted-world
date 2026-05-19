import type { Recursiv } from "@recursiv/sdk"

const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 800

export const INVERTED_AGENT_MODEL = process.env.RECURSIV_AGENT_MODEL || "google/gemini-3.1-pro-preview"

export const INVERTED_AGENT_SYSTEM_PROMPT = [
  "You are the Inverted World research agent: a conspiracy, paranormal, hidden-network, anomalous-science, and document-research specialist.",
  "You are allowed to discuss any topic, but you must separate verified records, mainstream reporting, allegation, inference, speculation, and unknowns.",
  "Your voice is curious and willing to believe, but disciplined. Never pretend a claim is proven when the documents do not prove it.",
  "Prioritize government records, court filings, declassified archives, public datasets, primary-source video/transcripts, reputable reporting, and transparent counterarguments.",
  "When a user is vague, ask one sharp follow-up question and offer 3 high-signal investigation paths.",
  "When a user asks for content, help them build viral but sourced articles, threads, scripts, thumbnails, and research packets.",
].join("\n")

export function isEmptyResponseError(error: unknown) {
  if (!error || typeof error !== "object") return false
  const maybe = error as { code?: string; message?: string }
  if (maybe.code === "empty_response") return true
  const message = maybe.message?.toLowerCase() || ""
  return message.includes("empty response") || message.includes("empty_response")
}

export async function ensureInvertedPersonalAgent(
  sdk: Recursiv,
  preferences: { email?: string; interests?: string[] } = {},
) {
  const result = await sdk.agents.ensurePersonal({
    preferences: {
      product: "inverted-world",
      source: "web",
      ...preferences,
    },
    overrides: {
      name: "Inverted World Research Agent",
      model: INVERTED_AGENT_MODEL,
      system_prompt: INVERTED_AGENT_SYSTEM_PROMPT,
    },
  })

  await ensureInvertedAgentConfig(sdk, result.data.agent_id)

  return result.data.agent_id
}

export async function ensureInvertedAgentConfig(sdk: Recursiv, agentId: string) {
  await sdk.agents.update(agentId, {
    name: "Inverted World Research Agent",
    model: INVERTED_AGENT_MODEL,
    system_prompt: INVERTED_AGENT_SYSTEM_PROMPT,
    social_mode: "chat_only",
    post_frequency: "never",
    tool_mode: "permission",
  })
}

export async function callRecursivAgentText(
  sdk: Recursiv,
  input: {
    agentId: string
    prompt: string
    conversationId?: string
    newConversation?: boolean
  },
) {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await sdk.agents.chatStreamText(input.agentId, {
        message: input.prompt,
        ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
        ...(input.newConversation ? { new_conversation: true } : {}),
      })
      const content = result.content?.trim() || ""

      if (!content) {
        lastError = Object.assign(new Error("Recursiv agent returned an empty response"), {
          code: "empty_response",
        })
        if (attempt < MAX_RETRIES) {
          await wait(BACKOFF_BASE_MS * Math.pow(2, attempt - 1))
          continue
        }
        break
      }

      return {
        answer: content,
        conversationId: result.conversationId || input.conversationId,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Recursiv agent request failed")
      if (!isEmptyResponseError(error) || attempt === MAX_RETRIES) break
      await wait(BACKOFF_BASE_MS * Math.pow(2, attempt - 1))
    }
  }

  throw lastError || new Error("Recursiv agent returned an empty response")
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
