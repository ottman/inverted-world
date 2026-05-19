import type { Recursiv } from "@recursiv/sdk"
import { researchDocuments } from "@/data/inverted-world"
import { INVERTED_WORLD_DB, RECURSIV_PROJECT_ID } from "@/lib/recursiv"

export async function dbQuery<T = Record<string, unknown>>(sdk: Recursiv, sql: string, params: unknown[] = []) {
  if (!RECURSIV_PROJECT_ID) {
    throw new Error("RECURSIV_PROJECT_ID is not configured")
  }

  const response = await sdk.databases.query({
    project_id: RECURSIV_PROJECT_ID,
    database_name: INVERTED_WORLD_DB,
    sql,
    params,
  })

  return (response.data?.rows ?? []) as T[]
}

export async function ensureInvertedWorldDatabase(sdk: Recursiv) {
  if (!RECURSIV_PROJECT_ID) {
    throw new Error("RECURSIV_PROJECT_ID is not configured")
  }

  await sdk.databases.ensure({
    project_id: RECURSIV_PROJECT_ID,
    name: INVERTED_WORLD_DB,
  })

  const migrations = [
    `CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      agent_id TEXT,
      role TEXT DEFAULT 'researcher',
      created_at TIMESTAMPTZ DEFAULT now(),
      last_seen_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS research_sessions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT,
      conversation_id TEXT,
      topic_id TEXT,
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS research_sessions_conversation_id_idx
      ON research_sessions(conversation_id)`,
    `CREATE TABLE IF NOT EXISTS research_messages (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      session_id TEXT REFERENCES research_sessions(id),
      user_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      mode TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS source_documents (
      id TEXT PRIMARY KEY,
      topic_id TEXT,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      kind TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS daily_issues (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      issue_date DATE UNIQUE NOT NULL,
      headline TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      source_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
  ]

  for (const sql of migrations) {
    await dbQuery(sdk, sql)
  }

  await seedSourceDocuments(sdk)
}

export async function upsertMember(
  sdk: Recursiv,
  member: { userId: string; email: string; name?: string | null; agentId?: string | null },
) {
  await dbQuery(
    sdk,
    `INSERT INTO members (user_id, email, name, agent_id, last_seen_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id)
     DO UPDATE SET email=$2, name=$3, agent_id=COALESCE($4, members.agent_id), last_seen_at=now()`,
    [member.userId, member.email, member.name ?? null, member.agentId ?? null],
  )
}

export async function recordChatExchange(
  sdk: Recursiv,
  input: {
    userId?: string
    conversationId?: string
    topicId?: string
    userMessage: string
    assistantMessage: string
    mode: string
  },
) {
  if (!input.conversationId) return

  const title = input.userMessage.replace(/\s+/g, " ").trim().slice(0, 96) || "Untitled investigation"
  const sessions = await dbQuery<{ id: string }>(
    sdk,
    `INSERT INTO research_sessions (user_id, conversation_id, topic_id, title, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (conversation_id)
     DO UPDATE SET user_id=COALESCE($1, research_sessions.user_id), topic_id=$3, title=COALESCE(research_sessions.title, $4), updated_at=now()
     RETURNING id`,
    [input.userId ?? null, input.conversationId, input.topicId ?? null, title],
  )
  const sessionId = sessions[0]?.id
  if (!sessionId) return

  await dbQuery(
    sdk,
    `INSERT INTO research_messages (session_id, user_id, role, content, mode)
     VALUES ($1, $2, 'user', $3, NULL), ($1, $2, 'assistant', $4, $5)`,
    [sessionId, input.userId ?? null, input.userMessage, input.assistantMessage, input.mode],
  )
}

async function seedSourceDocuments(sdk: Recursiv) {
  for (const doc of researchDocuments) {
    const id = stableDocumentId(doc.url)
    await dbQuery(
      sdk,
      `INSERT INTO source_documents (id, topic_id, title, source, url, kind, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (url)
       DO UPDATE SET title=$3, source=$4, kind=$6, updated_at=now()`,
      [id, doc.topicIds.join(","), doc.title, doc.source, doc.url, doc.kind],
    )
  }
}

function stableDocumentId(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)

  return `doc_${slug || "source"}`
}
