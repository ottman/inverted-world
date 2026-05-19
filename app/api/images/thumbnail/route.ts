import { NextRequest, NextResponse } from "next/server"
import { getRecursivSdk } from "@/lib/recursiv"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function generateWithOpenAi(prompt: string, size: "1024x1024" | "1024x1792" | "1792x1024") {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured")

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      response_format: "b64_json",
    }),
    signal: AbortSignal.timeout(45_000),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(error?.error?.message || `OpenAI image generation returned ${response.status}`)
  }

  const data = (await response.json()) as { data?: Array<{ b64_json?: string }> }
  const image = data.data?.[0]?.b64_json
  if (!image) throw new Error("OpenAI returned no image")

  return {
    url: `data:image/png;base64,${image}`,
    provider: "openai-direct",
    prompt,
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string
    size?: "1024x1024" | "1024x1792" | "1792x1024"
  }

  const prompt = body.prompt?.trim()
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
  }

  try {
    const sdk = getRecursivSdk()
    const result = await sdk.media.generateImage({
      prompt,
      provider: "dall-e",
      size: body.size || "1024x1024",
      style: "vivid",
    })

    return NextResponse.json({
      ok: true,
      path: "recursiv-sdk",
      image: result.data,
    })
  } catch (recursivError) {
    try {
      const image = await generateWithOpenAi(prompt, body.size || "1024x1024")
      return NextResponse.json({
        ok: true,
        path: "openai-fallback",
        image,
        warning: recursivError instanceof Error ? recursivError.message : "Recursiv image generation failed",
      })
    } catch (openAiError) {
      return NextResponse.json(
        {
          ok: false,
          error: "image_generation_unavailable",
          message: openAiError instanceof Error ? openAiError.message : "Image generation failed",
          recursiv: recursivError instanceof Error ? recursivError.message : "Recursiv image generation failed",
        },
        { status: 503 },
      )
    }
  }
}
