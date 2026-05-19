export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6"
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.6"

const RESEARCH_SYSTEM_PROMPT =
  "You are the Inverted World research agent. You can discuss any conspiracy, anomaly, mystery, occult claim, elite-network claim, tech-governance concern, or open question. Be gripping but disciplined. Separate records, reporting, allegations, speculation, and unknowns. Never pretend a claim is proven when it is not. Always offer next searches and source paths."

type ClaudeContentBlock = {
  type?: string
  text?: string
}

type ClaudeResponse = {
  content?: ClaudeContentBlock[]
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

export function getClaudeStatus() {
  const directAnthropic = Boolean(process.env.ANTHROPIC_API_KEY)
  const openRouter = Boolean(process.env.OPENROUTER_API_KEY)
  return {
    configured: directAnthropic || openRouter,
    provider: directAnthropic ? "anthropic" : openRouter ? "openrouter" : "none",
    directAnthropic,
    openRouter,
    model: ANTHROPIC_MODEL,
    openRouterModel: OPENROUTER_MODEL,
  }
}

export async function callClaude(prompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured")
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1200,
      temperature: 0.7,
      system: RESEARCH_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Claude returned ${response.status}${detail ? `: ${detail.slice(0, 220)}` : ""}`)
  }

  const data = (await response.json()) as ClaudeResponse
  const text =
    data.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n")
      .trim() || ""

  if (!text) {
    throw new Error("Claude returned an empty response")
  }

  return text
}

export async function callClaudeViaOpenRouter(prompt: string) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured")
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://invertedworld.on.recursiv.io",
      "X-Title": "Inverted World",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 1200,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: RESEARCH_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`OpenRouter returned ${response.status}${detail ? `: ${detail.slice(0, 220)}` : ""}`)
  }

  const data = (await response.json()) as OpenRouterResponse
  const text = data.choices?.[0]?.message?.content?.trim() || ""

  if (!text) {
    throw new Error("OpenRouter returned an empty response")
  }

  return text
}

export async function callClaudeGateway(prompt: string) {
  const errors: string[] = []

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return {
        mode: "claude",
        answer: await callClaude(prompt),
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Anthropic request failed")
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      return {
        mode: "openrouter-claude",
        answer: await callClaudeViaOpenRouter(prompt),
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "OpenRouter request failed")
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) errors.push("ANTHROPIC_API_KEY is not configured")
  if (!process.env.OPENROUTER_API_KEY) errors.push("OPENROUTER_API_KEY is not configured")

  throw new Error(errors.join(" | "))
}
