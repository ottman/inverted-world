import { NextRequest, NextResponse } from "next/server"

// Canonical host redirect: the bare apex (inverted.world) → www.inverted.world.
// Vercel's edge did this before; once DNS moves to Cloudflare (which proxies the apex to this
// origin), the app itself must canonicalize. Host-EXACT match so www never matches (no redirect loop).
export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0]
  if (host === "inverted.world") {
    const url = request.nextUrl.clone()
    url.protocol = "https:"
    url.host = "www.inverted.world"
    url.port = ""
    return NextResponse.redirect(url, 308)
  }
  return NextResponse.next()
}

// Run on everything except Next internals/static assets (those never need the apex redirect).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
