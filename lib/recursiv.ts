import { Recursiv } from "@recursiv/sdk"

export const RECURSIV_BASE_URL =
  process.env.RECURSIV_BASE_URL ||
  process.env.NEXT_PUBLIC_RECURSIV_BASE_URL ||
  "https://api.recursiv.io/api/v1"

export const RECURSIV_PROJECT_ID =
  process.env.RECURSIV_PROJECT_ID || process.env.NEXT_PUBLIC_RECURSIV_PROJECT_ID || ""

export const RECURSIV_ORG_ID =
  process.env.RECURSIV_ORG_ID || process.env.NEXT_PUBLIC_RECURSIV_ORG_ID || ""

export const RECURSIV_AGENT_ID =
  process.env.RECURSIV_AGENT_ID ||
  process.env.NEXT_PUBLIC_RECURSIV_AGENT_ID ||
  "e260c5ff-b21e-4af2-a488-40da4c4fc61d"

export const INVERTED_WORLD_DB = process.env.RECURSIV_DATABASE_NAME || "inverted_world_research"

let sdk: Recursiv | null = null

function getServerApiKey() {
  return (
    process.env.RECURSIV_SERVER_API_KEY ||
    (process.env.ALLOW_GLOBAL_RECURSIV_API_KEY === "1" ? process.env.RECURSIV_API_KEY : "") ||
    ""
  )
}

export function getRecursivSdk() {
  const apiKey = getServerApiKey()
  if (!apiKey) {
    throw new Error("RECURSIV_SERVER_API_KEY is not configured")
  }

  if (!sdk) {
    sdk = new Recursiv({
      apiKey,
      baseUrl: RECURSIV_BASE_URL,
      timeout: 180_000,
    })
  }

  return sdk
}

export function getRecursivStatus() {
  const hasServerKey = Boolean(getServerApiKey())

  return {
    configured: Boolean(hasServerKey && RECURSIV_PROJECT_ID),
    hasServerKey,
    hasAgent: Boolean(RECURSIV_AGENT_ID),
    agentId: RECURSIV_AGENT_ID,
    baseUrl: RECURSIV_BASE_URL,
    orgId: RECURSIV_ORG_ID,
    projectId: RECURSIV_PROJECT_ID,
    databaseName: INVERTED_WORLD_DB,
  }
}
