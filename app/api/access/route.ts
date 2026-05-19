import { NextRequest, NextResponse } from "next/server"
import { clearAuthCookies, readAuthCookies, setAuthCookies } from "@/lib/auth-cookies"
import { ensureInvertedWorldDatabase, upsertMember } from "@/lib/inverted-database"
import {
  createAnonymousSdk,
  createAuthedSdk,
  INVERTED_WORLD_AUTH_SCOPES,
  RECURSIV_AGENT_ID,
  RECURSIV_PROJECT_ID,
} from "@/lib/recursiv"
import { ensureInvertedPersonalAgent } from "@/lib/recursiv-agent"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type AccessBody = {
  email?: string
  password?: string
  name?: string
  mode?: "login" | "signup"
}

export async function GET(request: NextRequest) {
  const auth = readAuthCookies(request)
  if (!auth.apiKey) {
    return NextResponse.json({ authenticated: false })
  }

  try {
    const sdk = createAuthedSdk(auth.apiKey)
    const profile = await sdk.users.me()
    return NextResponse.json({
      authenticated: true,
      member: {
        id: profile.data.id,
        email: profile.data.email || auth.email,
        name: profile.data.name || auth.name,
        agentId: auth.agentId || RECURSIV_AGENT_ID,
      },
    })
  } catch {
    const response = NextResponse.json({ authenticated: false })
    clearAuthCookies(response)
    return response
  }
}

export async function POST(request: NextRequest) {
  if (!RECURSIV_PROJECT_ID) {
    return NextResponse.json({ error: "RECURSIV_PROJECT_ID is not configured" }, { status: 500 })
  }

  const body = (await request.json().catch(() => ({}))) as AccessBody
  const mode = body.mode === "login" ? "login" : "signup"
  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()
  const name = body.name?.trim() || email?.split("@")[0] || "Inverted World Researcher"

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 })
  }

  if (
    !password ||
    password.length < 12 ||
    password.length > 128 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return NextResponse.json(
      { error: "Password must be 12-128 characters with uppercase, lowercase, number, and symbol." },
      { status: 400 },
    )
  }

  try {
    const anonSdk = createAnonymousSdk()
    const keyInput = {
      name: `inverted-world-${Date.now()}`,
      scopes: [...INVERTED_WORLD_AUTH_SCOPES],
      projectId: RECURSIV_PROJECT_ID,
    }
    const result =
      mode === "login"
        ? await anonSdk.auth.signInAndCreateKey({ email, password }, keyInput)
        : await anonSdk.auth.signUpAndCreateKey({ email, password, name }, keyInput)

    const authedSdk = createAuthedSdk(result.apiKey)
    const warnings: string[] = []
    let agentId = RECURSIV_AGENT_ID

    try {
      agentId = await ensureInvertedPersonalAgent(authedSdk, {
        email,
        interests: ["conspiracies", "paranormal", "government documents", "open-source intelligence"],
      })
    } catch (error) {
      warnings.push(error instanceof Error ? `Personal agent: ${error.message}` : "Personal agent was not provisioned")
    }

    try {
      await ensureInvertedWorldDatabase(authedSdk)
      await upsertMember(authedSdk, {
        userId: result.user.id,
        email: result.user.email || email,
        name: result.user.name || name,
        agentId,
      })
    } catch (error) {
      warnings.push(error instanceof Error ? `Database: ${error.message}` : "Database setup failed")
    }

    const response = NextResponse.json({
      ok: true,
      mode,
      message: mode === "login" ? "Research desk unlocked." : "Research desk created.",
      warnings,
      member: {
        id: result.user.id,
        email: result.user.email || email,
        name: result.user.name || name,
        role: "researcher",
        product: "inverted-world",
        agentId,
      },
    })

    setAuthCookies(response, {
      apiKey: result.apiKey,
      sessionToken: result.session.token,
      userId: result.user.id,
      email: result.user.email || email,
      name: result.user.name || name,
      agentId,
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recursiv auth failed"
    return NextResponse.json({ error: message }, { status: mode === "login" ? 401 : 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = readAuthCookies(request)
  if (auth.sessionToken) {
    await createAnonymousSdk().auth.signOut(auth.sessionToken).catch(() => null)
  }

  const response = NextResponse.json({ ok: true })
  clearAuthCookies(response)
  return response
}
