function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function cleanThumbnailTitle(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+\|\s+.+$/g, "")
    .trim()
}

function compactSlug(value: string) {
  return (
    value
      .replace(/^brief-/, "")
      .replace(/[^a-z0-9]+/gi, "")
      .slice(0, 4)
      .toUpperCase() || "IW"
  )
}

function truncateLine(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(1, maxLength - 1)).trim()}...`
}

function wrapHeadline(value: string) {
  const title = cleanThumbnailTitle(value) || "Inverted World report"
  const words = title.split(/\s+/).filter(Boolean)
  const maxLines = 5
  const maxChars = title.length > 105 ? 19 : title.length > 72 ? 22 : 26
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars || !current) {
      current = next
      continue
    }

    lines.push(current)
    current = word
    if (lines.length === maxLines) break
  }

  if (current && lines.length < maxLines) lines.push(current)

  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length
  if (consumed < words.length && lines.length) {
    lines[lines.length - 1] = truncateLine(lines[lines.length - 1], Math.max(10, maxChars - 2))
  }

  return lines.length ? lines : ["Inverted World report"]
}

function headlineFontSize(lines: string[]) {
  const longest = Math.max(...lines.map((line) => line.length))
  const lineCountSize = lines.length >= 5 ? 48 : lines.length === 4 ? 54 : lines.length === 3 ? 62 : 72
  const lengthSize = longest > 26 ? 48 : longest > 22 ? 54 : longest > 18 ? 62 : 72
  return Math.min(lineCountSize, lengthSize)
}

export function isGeneratedSvgThumbnailUrl(value?: string) {
  return Boolean(value?.startsWith("data:image/svg+xml"))
}

export function generatedSvgThumbnail(title: string, slug: string) {
  const lines = wrapHeadline(title)
  const fontSize = headlineFontSize(lines)
  const lineHeight = Math.round(fontSize * 1.15)
  const totalHeight = (lines.length - 1) * lineHeight
  const startY = Math.round(520 - totalHeight / 2)
  const sigil = escapeSvgText(compactSlug(slug))
  const tspans = lines
    .map((line, index) => `<tspan x="94" y="${startY + index * lineHeight}">${escapeSvgText(line)}</tspan>`)
    .join("")

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#050504"/><stop offset=".54" stop-color="#19130d"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient><pattern id="p" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0v64" fill="none" stroke="#f4efe2" stroke-opacity=".075" stroke-width="1"/></pattern></defs><rect width="1024" height="1024" fill="url(#g)"/><rect width="1024" height="1024" fill="url(#p)"/><rect x="70" y="70" width="884" height="884" fill="none" stroke="#df2f2f" stroke-width="10"/><text x="94" y="166" fill="#df2f2f" font-family="Arial, sans-serif" font-size="40" font-weight="700" letter-spacing="7">INVERTED WORLD</text><text fill="#fff8e6" font-family="Georgia, serif" font-size="${fontSize}" font-weight="700">${tspans}</text><text x="94" y="858" fill="#f4efe2" fill-opacity=".62" font-family="Arial, sans-serif" font-size="32" font-weight="700" letter-spacing="5">${sigil} / SOURCE FILE</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
