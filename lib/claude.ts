export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514"

type ClaudeContentBlock = {
  type?: string
  text?: string
}

type ClaudeResponse = {
  content?: ClaudeContentBlock[]
}

export function getClaudeStatus() {
  return {
    configured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: ANTHROPIC_MODEL,
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
      system:
        "You are the Inverted World research agent. You can discuss any conspiracy, anomaly, mystery, occult claim, elite-network claim, tech-governance concern, or open question. Be gripping but disciplined. Separate records, reporting, allegations, speculation, and unknowns. Never pretend a claim is proven when it is not. Always offer next searches and source paths.",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
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
