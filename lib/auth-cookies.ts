import type { NextRequest, NextResponse } from "next/server"

export const AUTH_COOKIES = {
  apiKey: "iw_recursiv_api_key",
  sessionToken: "iw_recursiv_session",
  userId: "iw_user_id",
  email: "iw_user_email",
  name: "iw_user_name",
  agentId: "iw_agent_id",
} as const

export type AuthCookieSnapshot = {
  apiKey?: string
  sessionToken?: string
  userId?: string
  email?: string
  name?: string
  agentId?: string
}

const secure = process.env.NODE_ENV === "production"

const httpOnlyCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure,
  path: "/",
  maxAge: 60 * 60 * 24 * 45,
}

const readableCookie = {
  httpOnly: false,
  sameSite: "lax" as const,
  secure,
  path: "/",
  maxAge: 60 * 60 * 24 * 45,
}

export function readAuthCookies(request: NextRequest): AuthCookieSnapshot {
  return {
    apiKey: request.cookies.get(AUTH_COOKIES.apiKey)?.value,
    sessionToken: request.cookies.get(AUTH_COOKIES.sessionToken)?.value,
    userId: request.cookies.get(AUTH_COOKIES.userId)?.value,
    email: request.cookies.get(AUTH_COOKIES.email)?.value,
    name: request.cookies.get(AUTH_COOKIES.name)?.value,
    agentId: request.cookies.get(AUTH_COOKIES.agentId)?.value,
  }
}

export function setAuthCookies(
  response: NextResponse,
  session: Required<Pick<AuthCookieSnapshot, "apiKey" | "userId" | "email">> &
    Pick<AuthCookieSnapshot, "sessionToken" | "name" | "agentId">,
) {
  response.cookies.set(AUTH_COOKIES.apiKey, session.apiKey, httpOnlyCookie)
  if (session.sessionToken) response.cookies.set(AUTH_COOKIES.sessionToken, session.sessionToken, httpOnlyCookie)
  response.cookies.set(AUTH_COOKIES.userId, session.userId, readableCookie)
  response.cookies.set(AUTH_COOKIES.email, session.email, readableCookie)
  if (session.name) response.cookies.set(AUTH_COOKIES.name, session.name, readableCookie)
  if (session.agentId) response.cookies.set(AUTH_COOKIES.agentId, session.agentId, readableCookie)
}

export function clearAuthCookies(response: NextResponse) {
  for (const name of Object.values(AUTH_COOKIES)) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
    })
  }
}
