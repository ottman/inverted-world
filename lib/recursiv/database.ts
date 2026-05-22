import { createRecursivServerClient } from "@/lib/recursiv/client"
import { getRecursivRuntimeConfig } from "@/lib/recursiv/config"
import { INVERTED_WORLD_SCHEMA_SQL, INVERTED_WORLD_TABLES } from "@/lib/recursiv/schema"

export type RecursivRow = Record<string, unknown>

export async function queryInvertedWorldDatabase<T extends RecursivRow = RecursivRow>(
  sql: string,
  params: unknown[] = [],
) {
  const config = getRecursivRuntimeConfig()
  if (!config.apiKey || !config.projectId) return null

  try {
    const { sdk } = createRecursivServerClient()
    const { data } = await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql,
      params,
    })

    return (data.rows || []) as T[]
  } catch (error) {
    if (process.env.RECURSIV_STRICT_READS === "1") throw error
    console.warn("[recursiv] database read skipped:", error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function provisionInvertedWorldDatabase(options: { allowDeveloperApiKey?: boolean } = {}) {
  const { sdk, config } = createRecursivServerClient({
    allowDeveloperApiKey: options.allowDeveloperApiKey,
    timeout: 120000,
  })

  await sdk.databases.ensure({
    project_id: config.projectId,
    name: config.databaseName,
  })

  for (const sql of INVERTED_WORLD_SCHEMA_SQL) {
    await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql,
    })
  }

  return {
    projectId: config.projectId,
    databaseName: config.databaseName,
    tableCount: INVERTED_WORLD_TABLES.length,
  }
}
