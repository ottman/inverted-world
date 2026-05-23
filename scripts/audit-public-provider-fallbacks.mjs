import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const APP_DIR = path.join(process.cwd(), "app")

const PROVIDER_CAPABLE_CALLS = new Map([
  ["getDeepArchive", 0],
  ["getArchiveVideo", 1],
  ["getRecommendedArchiveVideos", 2],
  ["fetchLiveArticles", 0],
  ["fetchLiveArticlesForTopic", 2],
  ["fetchViralXPostsForTopic", 1],
  ["fetchViralXPostsByTopic", 0],
  ["getYouTubeLiveStatus", 0],
  ["getYouTubeTranscript", 1],
  ["fetchExpandedMediaLibrary", 0],
  ["fetchMediaLibraryItem", 1],
  ["fetchMediaLibrary", 0],
])

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (fullPath.includes(`${path.sep}api${path.sep}recursiv${path.sep}jobs`)) return []
      return walkFiles(fullPath)
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : []
  })
}

function calleeName(expression) {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  return ""
}

function hasExplicitFalseFallback(arg) {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return false

  return arg.properties.some((property) => {
    if (!ts.isPropertyAssignment(property)) return false
    const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : ""
    return name === "allowProviderFallbacks" && property.initializer.kind === ts.SyntaxKind.FalseKeyword
  })
}

function auditFile(file) {
  const text = fs.readFileSync(file, "utf8")
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const findings = []

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression)
      const optionsIndex = PROVIDER_CAPABLE_CALLS.get(name)
      if (optionsIndex !== undefined && !hasExplicitFalseFallback(node.arguments[optionsIndex])) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source))
        findings.push({
          file: path.relative(process.cwd(), file),
          line: position.line + 1,
          column: position.character + 1,
          call: name,
          message: `${name} must pass allowProviderFallbacks: false from public app routes/pages.`,
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return findings
}

const findings = walkFiles(APP_DIR).flatMap(auditFile)

if (findings.length) {
  console.error(JSON.stringify({ ok: false, findings }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({ ok: true, auditedFiles: walkFiles(APP_DIR).length, findings: [] }, null, 2))
