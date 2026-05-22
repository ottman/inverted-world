export const DEFAULT_RECURSIV_BASE_URL = "https://api.recursiv.io/api/v1"
export const DEFAULT_RECURSIV_DATABASE_NAME = "inverted_world_research"
const LOCAL_RECURSIV_API_KEY_FILE = "/private/tmp/inverted-world-recursiv-key"

export type RecursivRuntimeConfig = {
  baseUrl: string
  organizationId?: string
  projectId?: string
  agentId?: string
  databaseName: string
  apiKey?: string
}

type ConfigOptions = {
  allowDeveloperApiKey?: boolean
}

function readLocalApiKeyFile() {
  if (typeof window !== "undefined" || process.env.NODE_ENV === "production") return undefined

  try {
    const fs = require("node:fs") as typeof import("node:fs")
    if (fs.existsSync(LOCAL_RECURSIV_API_KEY_FILE)) {
      return fs.readFileSync(LOCAL_RECURSIV_API_KEY_FILE, "utf8").trim()
    }
  } catch {
    return undefined
  }

  return undefined
}

export function getRecursivRuntimeConfig(options: ConfigOptions = {}): RecursivRuntimeConfig {
  const apiKey =
    readLocalApiKeyFile() ||
    process.env.RECURSIV_SERVER_API_KEY ||
    (options.allowDeveloperApiKey ? process.env.RECURSIV_API_KEY || process.env.SOCIAL_DEV_API_KEY : undefined)

  return {
    baseUrl: process.env.RECURSIV_BASE_URL || process.env.NEXT_PUBLIC_RECURSIV_BASE_URL || DEFAULT_RECURSIV_BASE_URL,
    organizationId: process.env.RECURSIV_ORG_ID || process.env.NEXT_PUBLIC_RECURSIV_ORG_ID,
    projectId: process.env.RECURSIV_PROJECT_ID || process.env.NEXT_PUBLIC_RECURSIV_PROJECT_ID,
    agentId: process.env.RECURSIV_AGENT_ID,
    databaseName: process.env.RECURSIV_DATABASE_NAME || DEFAULT_RECURSIV_DATABASE_NAME,
    apiKey,
  }
}

export function hasRecursivReadConfig() {
  const config = getRecursivRuntimeConfig()
  return Boolean(config.apiKey && config.projectId && config.databaseName)
}

export function requireRecursivRuntimeConfig(options: ConfigOptions = {}) {
  const config = getRecursivRuntimeConfig(options)
  const missing = [
    config.apiKey ? undefined : options.allowDeveloperApiKey ? "RECURSIV_SERVER_API_KEY or RECURSIV_API_KEY" : "RECURSIV_SERVER_API_KEY",
    config.projectId ? undefined : "RECURSIV_PROJECT_ID",
    config.databaseName ? undefined : "RECURSIV_DATABASE_NAME",
  ].filter(Boolean)

  if (missing.length) {
    throw new Error(`Missing Recursiv config: ${missing.join(", ")}`)
  }

  return config as RecursivRuntimeConfig & { apiKey: string; projectId: string }
}
