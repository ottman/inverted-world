function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function cleanThumbnailTitle(value: string) {
  let title = value
    .replace(/\s+/g, " ")
    .replace(/\s+\|\s+.+$/g, "")
    .trim()
  const labels = ["Skywatch", "Declassified", "Power Web", "High Strangeness", "Machine State", "Off-World Signals", "Inverted World"]
  for (let pass = 0; pass < 4; pass += 1) {
    const before = title
    for (const label of labels) {
      title = title.replace(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i"), "").trim()
    }
    if (title === before) break
  }
  return title
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

function headlineWords(title: string, maxChars: number) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => {
      if (word.length <= maxChars) return word
      const chunks: string[] = []
      for (let index = 0; index < word.length; index += maxChars - 1) {
        chunks.push(word.slice(index, index + maxChars - 1))
      }
      return chunks
    })
}

function wrapHeadline(value: string) {
  const title = cleanThumbnailTitle(value) || "Inverted World report"
  const maxLines = 6
  const maxChars = title.length > 105 ? 17 : title.length > 72 ? 19 : 22
  const words = headlineWords(title, maxChars)
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
  const lineCountSize = lines.length >= 6 ? 40 : lines.length === 5 ? 44 : lines.length === 4 ? 50 : lines.length === 3 ? 58 : 66
  const lengthSize = longest > 22 ? 42 : longest > 19 ? 46 : longest > 16 ? 54 : 62
  return Math.min(lineCountSize, lengthSize)
}

export function isGeneratedSvgThumbnailUrl(value?: string) {
  return Boolean(value?.startsWith("data:image/svg+xml"))
}

export function generatedSvgThumbnail(title: string, slug: string) {
  const lines = wrapHeadline(title)
  const fontSize = headlineFontSize(lines)
  const lineHeight = Math.round(fontSize * 1.12)
  const totalHeight = (lines.length - 1) * lineHeight
  const startY = Math.round(500 - totalHeight / 2)
  const sigil = escapeSvgText(compactSlug(slug))
  const tspans = lines
    .map((line, index) => `<tspan x="94" y="${startY + index * lineHeight}">${escapeSvgText(line)}</tspan>`)
    .join("")

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#050504"/><stop offset=".54" stop-color="#19130d"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient><pattern id="p" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0v64" fill="none" stroke="#f4efe2" stroke-opacity=".075" stroke-width="1"/></pattern></defs><rect width="1024" height="1024" fill="url(#g)"/><rect width="1024" height="1024" fill="url(#p)"/><rect x="70" y="70" width="884" height="884" fill="none" stroke="#df2f2f" stroke-width="10"/><text x="94" y="166" fill="#df2f2f" font-family="Arial, sans-serif" font-size="40" font-weight="700" letter-spacing="7">INVERTED WORLD</text><text fill="#fff8e6" font-family="Georgia, serif" font-size="${fontSize}" font-weight="700">${tspans}</text><text x="94" y="858" fill="#f4efe2" fill-opacity=".62" font-family="Arial, sans-serif" font-size="32" font-weight="700" letter-spacing="5">${sigil} / SOURCE FILE</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
