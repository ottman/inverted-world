import type { Recursiv } from '@recursiv/sdk';
import { DATABASE_NAME, PROJECT_ID } from './recursiv';

export async function dbQuery<T = Record<string, unknown>>(
  sdk: Recursiv,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const response = await (sdk.databases as any).query({
    project_id: PROJECT_ID,
    database_name: DATABASE_NAME,
    sql,
    params,
  });
  return (response?.data?.rows || response?.rows || []) as T[];
}

export async function ensureDatabase(sdk: Recursiv): Promise<void> {
  await (sdk.databases as any).ensure({
    project_id: PROJECT_ID,
    name: DATABASE_NAME,
  });

  const migrations = [
    `CREATE TABLE IF NOT EXISTS research_desks (
      user_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS research_cases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      conversation_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS source_documents (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      source_type TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
  ];

  for (const sql of migrations) {
    await dbQuery(sdk, sql).catch((error: Error) => {
      console.warn('[database] migration warning:', error.message);
    });
  }
}
