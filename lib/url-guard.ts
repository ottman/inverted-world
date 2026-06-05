import { lookup } from "node:dns/promises"
import net from "node:net"

// SSRF guard: is a URL safe to fetch server-side? Blocks non-http(s) schemes, private/loopback/
// link-local/CGNAT/unique-local IP ranges, the cloud metadata IP, and internal-looking hostnames —
// and resolves the hostname so a public name pointing at a private IP (DNS rebinding) is also caught.

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const p = ip.split(".").map(Number)
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true
    if (p[0] === 169 && p[1] === 254) return true // link-local + 169.254.169.254 metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true
    if (p[0] === 192 && p[1] === 168) return true
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true // CGNAT 100.64/10
    if (p[0] >= 224) return true // multicast/reserved
    return false
  }
  const low = ip.toLowerCase()
  if (low === "::1" || low === "::" || low === "::0") return true
  if (low.startsWith("::ffff:")) return isPrivateIp(low.slice(7)) // IPv4-mapped IPv6
  if (low.startsWith("fc") || low.startsWith("fd")) return true // unique-local fc00::/7
  if (low.startsWith("fe80")) return true // link-local
  return false
}

const BLOCKED_HOST = /(^|\.)(localhost|local|internal|lan|home|corp|intranet|svc|cluster)$/i

export async function isSafePublicUrl(raw: string): Promise<boolean> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (!host || BLOCKED_HOST.test(host)) return false
  if (net.isIP(host)) return !isPrivateIp(host)
  try {
    const resolved = await lookup(host, { all: true })
    return resolved.length > 0 && resolved.every((entry) => !isPrivateIp(entry.address))
  } catch {
    return false
  }
}
