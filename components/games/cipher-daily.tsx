"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowUpRight, Eye, ListChecks, RefreshCw } from "lucide-react"
import { cipherMessages, type CipherMessage } from "@/data/games/cipher-messages"
import { cn } from "@/lib/utils"

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const DAY_MS = 86_400_000
const STARTING_HINTS = 3

// Deterministic PRNG (mulberry32) so a given seed always yields the same scramble.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Build a monoalphabetic substitution that is a derangement (no letter maps to itself).
// Returns encode: plaintext letter -> cipher letter.
function buildCipher(seed: number): Record<string, string> {
  const rand = mulberry32(seed)
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const letters = ALPHABET.split("")
    for (let i = letters.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1))
      ;[letters[i], letters[j]] = [letters[j], letters[i]]
    }
    let ok = true
    for (let i = 0; i < 26; i += 1) {
      if (letters[i] === ALPHABET[i]) {
        ok = false
        break
      }
    }
    if (ok) {
      const map: Record<string, string> = {}
      for (let i = 0; i < 26; i += 1) map[ALPHABET[i]] = letters[i]
      return map
    }
  }
  // Fallback: simple rotation by 1 (still a derangement) if the loop somehow never lands one.
  const map: Record<string, string> = {}
  for (let i = 0; i < 26; i += 1) map[ALPHABET[i]] = ALPHABET[(i + 1) % 26]
  return map
}

type Token = { cipher: string; plain: string; isLetter: boolean }

type Puzzle = {
  message: CipherMessage
  tokens: Token[]
  // cipher letter -> correct plaintext letter
  solution: Record<string, string>
  // distinct cipher letters that actually appear in this message
  cipherLetters: string[]
}

function buildPuzzle(message: CipherMessage, seed: number): Puzzle {
  const encode = buildCipher(seed)
  const solution: Record<string, string> = {}
  for (const plain of ALPHABET) solution[encode[plain]] = plain

  const tokens: Token[] = []
  const seen = new Set<string>()
  for (const ch of message.text) {
    if (ch >= "A" && ch <= "Z") {
      const cipher = encode[ch]
      tokens.push({ cipher, plain: ch, isLetter: true })
      seen.add(cipher)
    } else {
      tokens.push({ cipher: ch, plain: ch, isLetter: false })
    }
  }
  return { message, tokens, solution, cipherLetters: [...seen] }
}

// Pick a stable starting set of correctly-revealed cipher letters from the seed.
function pickHints(cipherLetters: string[], seed: number, count: number): string[] {
  const rand = mulberry32(seed ^ 0x9e3779b9)
  const pool = [...cipherLetters]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(count, pool.length))
}

export function CipherDaily() {
  // Daily index + an offset for "next puzzle"/practice; both client-only to avoid hydration mismatch.
  const [dayIndex, setDayIndex] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)

  // Player's assignments: cipher letter -> guessed plaintext letter ("" = unset).
  const [assign, setAssign] = useState<Record<string, string>>({})
  // Cipher letters locked in as hints/reveals (cannot be edited by typing).
  const [locked, setLocked] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const checkTimer = useRef<number | null>(null)

  useEffect(() => {
    setDayIndex(Math.floor(Date.now() / DAY_MS))
  }, [])

  const puzzleIndex = dayIndex === null ? null : (dayIndex + offset) % cipherMessages.length
  const seed = dayIndex === null ? 0 : (dayIndex + offset) * 2654435761

  const puzzle = useMemo<Puzzle | null>(() => {
    if (puzzleIndex === null) return null
    const idx = ((puzzleIndex % cipherMessages.length) + cipherMessages.length) % cipherMessages.length
    return buildPuzzle(cipherMessages[idx], seed)
  }, [puzzleIndex, seed])

  // (Re)initialise assignments + hints whenever the puzzle changes.
  const initPuzzle = useCallback((p: Puzzle, s: number) => {
    const hintLetters = pickHints(p.cipherLetters, s, STARTING_HINTS)
    const nextAssign: Record<string, string> = {}
    const nextLocked = new Set<string>()
    for (const c of hintLetters) {
      nextAssign[c] = p.solution[c]
      nextLocked.add(c)
    }
    setAssign(nextAssign)
    setLocked(nextLocked)
    setSelected(null)
    setChecking(false)
  }, [])

  useEffect(() => {
    if (puzzle) initPuzzle(puzzle, seed)
  }, [puzzle, seed, initPuzzle])

  useEffect(() => {
    return () => {
      if (checkTimer.current) window.clearTimeout(checkTimer.current)
    }
  }, [])

  const solved = useMemo(() => {
    if (!puzzle) return false
    return puzzle.cipherLetters.every((c) => assign[c] === puzzle.solution[c])
  }, [puzzle, assign])

  const assignLetter = useCallback(
    (plain: string) => {
      if (!selected || !puzzle || solved) return
      if (locked.has(selected)) return
      setAssign((prev) => {
        const next = { ...prev }
        if (plain === "") {
          delete next[selected]
        } else {
          next[selected] = plain
        }
        return next
      })
    },
    [selected, puzzle, solved, locked],
  )

  // Physical keyboard: type a letter to assign to the selected cipher cell; Backspace clears.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected || solved) return
      const k = e.key
      if (k === "Backspace" || k === "Delete") {
        assignLetter("")
        e.preventDefault()
      } else if (k.length === 1 && /[a-zA-Z]/.test(k)) {
        assignLetter(k.toUpperCase())
        e.preventDefault()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected, solved, assignLetter])

  const revealOne = useCallback(() => {
    if (!puzzle || solved) return
    const remaining = puzzle.cipherLetters.filter((c) => assign[c] !== puzzle.solution[c])
    if (remaining.length === 0) return
    const target = selected && remaining.includes(selected) ? selected : remaining[0]
    setAssign((prev) => ({ ...prev, [target]: puzzle.solution[target] }))
    setLocked((prev) => new Set(prev).add(target))
  }, [puzzle, solved, assign, selected])

  const runCheck = useCallback(() => {
    if (checkTimer.current) window.clearTimeout(checkTimer.current)
    setChecking(true)
    checkTimer.current = window.setTimeout(() => setChecking(false), 1200)
  }, [])

  const newPuzzle = useCallback(() => {
    setOffset((o) => o + 1)
  }, [])

  // ----- placeholder until mounted (stable for SSR/first paint) -----
  if (dayIndex === null || !puzzle) {
    return (
      <div className="grid gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Daily Cryptogram</p>
        <h3 className="iw-serif text-4xl text-[#fff8e6] sm:text-5xl">Decoding today&rsquo;s message&hellip;</h3>
        <p className="text-sm leading-6 text-[#f4efe2]/64">
          A famous cipher, rescrambled. Click a letter, type its plaintext, and break the code.
        </p>
      </div>
    )
  }

  const lettersUsed = new Set(Object.values(assign).filter(Boolean))
  const remainingCount = puzzle.cipherLetters.filter((c) => assign[c] !== puzzle.solution[c]).length

  return (
    <div className="grid gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">
          {offset === 0 ? "Daily Cryptogram" : "Practice Cryptogram"}
        </p>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/55">
          {solved ? "Decoded" : `${remainingCount} left`}
        </span>
      </div>

      <h3 className="iw-serif text-3xl leading-tight text-[#fff8e6] sm:text-4xl">
        {solved ? "Cipher broken." : "Break the cipher."}
      </h3>

      <p className="text-sm leading-6 text-[#f4efe2]/64">
        Click a coded letter to select it, then type a letter to map every match. Punctuation passes through.
        {STARTING_HINTS} letters are revealed to start you off.
      </p>

      {/* Cipher grid */}
      <div className="flex flex-wrap gap-x-2 gap-y-3 font-mono">
        {puzzle.tokens.map((tok, i) => {
          if (!tok.isLetter) {
            if (tok.cipher === " ") return <span key={i} className="w-3" aria-hidden />
            return (
              <span key={i} className="flex flex-col items-center justify-end text-lg text-[#f4efe2]/45">
                <span className="leading-none">{tok.cipher}</span>
                <span className="mt-1 h-[2px] w-5" />
              </span>
            )
          }
          const guess = assign[tok.cipher] ?? ""
          const isSelected = selected === tok.cipher
          const isLocked = locked.has(tok.cipher)
          const isWrong = checking && guess !== "" && guess !== puzzle.solution[tok.cipher]
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(tok.cipher)}
              className={cn(
                "flex select-none flex-col items-center gap-1 outline-none",
                solved && "pointer-events-none",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-7 place-items-center border text-lg font-semibold transition sm:h-10 sm:w-8",
                  "bg-[#070706]/40 text-[#fff8e6]",
                  solved
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                    : isWrong
                      ? "border-[#df2f2f]/70 bg-[#df2f2f]/20 text-[#fff8e6]"
                      : isSelected
                        ? "border-[#df2f2f] bg-[#df2f2f]/15"
                        : isLocked
                          ? "border-emerald-500/40 text-emerald-300"
                          : guess
                            ? "border-[#f4efe2]/40"
                            : "border-[#f4efe2]/14",
                )}
              >
                {guess || ""}
              </span>
              <span
                className={cn(
                  "text-xs uppercase tracking-wide",
                  isSelected ? "text-[#df2f2f]" : "text-[#f4efe2]/45",
                )}
              >
                {tok.cipher}
              </span>
            </button>
          )
        })}
      </div>

      {/* On-screen letter keyboard (works on mobile + as a click affordance) */}
      {!solved && (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            {ALPHABET.split("").map((letter) => {
              const used = lettersUsed.has(letter)
              return (
                <button
                  key={letter}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    assignLetter(letter)
                  }}
                  disabled={!selected || (selected !== null && locked.has(selected))}
                  className={cn(
                    "h-9 w-8 select-none border font-mono text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                    used
                      ? "border-[#f4efe2]/30 bg-[#050504]/50 text-[#f4efe2]/55"
                      : "border-[#f4efe2]/16 bg-[#070706]/40 text-[#fff8e6] hover:border-[#df2f2f]/60 hover:bg-[#df2f2f]/15 active:bg-[#df2f2f]/30",
                  )}
                >
                  {letter}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault()
              assignLetter("")
            }}
            disabled={!selected || (selected !== null && locked.has(selected))}
            className="w-fit select-none border border-[#f4efe2]/16 bg-[#070706]/40 px-4 py-1.5 font-mono text-sm uppercase tracking-[0.14em] text-[#f4efe2]/64 transition hover:border-[#df2f2f]/60 hover:text-[#fff8e6] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear cell
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#f4efe2]/10 pt-4">
        {!solved && (
          <>
            <button
              type="button"
              onClick={revealOne}
              className="inline-flex items-center gap-1.5 border border-[#f4efe2]/16 bg-[#070706]/40 px-3 py-2 text-sm font-semibold text-[#f4efe2]/80 transition hover:border-[#df2f2f]/60 hover:text-[#fff8e6]"
            >
              <Eye className="h-4 w-4" /> Reveal a letter
            </button>
            <button
              type="button"
              onClick={runCheck}
              className="inline-flex items-center gap-1.5 border border-[#f4efe2]/16 bg-[#070706]/40 px-3 py-2 text-sm font-semibold text-[#f4efe2]/80 transition hover:border-[#df2f2f]/60 hover:text-[#fff8e6]"
            >
              <ListChecks className="h-4 w-4" /> Check
            </button>
          </>
        )}
        <button
          type="button"
          onClick={newPuzzle}
          className="inline-flex items-center gap-1.5 border border-[#f4efe2]/16 bg-[#070706]/40 px-3 py-2 text-sm font-semibold text-[#f4efe2]/80 transition hover:border-[#df2f2f]/60 hover:text-[#fff8e6]"
        >
          <RefreshCw className="h-4 w-4" /> New puzzle
        </button>
      </div>

      {/* Solved reveal */}
      {solved && (
        <div className="grid gap-3 border-t border-[#f4efe2]/10 pt-4">
          <p className="iw-serif text-2xl leading-snug text-[#fff8e6]">
            &ldquo;{puzzle.message.text}&rdquo;
          </p>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-400">
            {puzzle.message.attribution}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={puzzle.message.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/55 transition hover:text-[#df2f2f]"
            >
              Read the case <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={newPuzzle}
              className="iw-serif bg-[#df2f2f] px-6 py-2 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85"
            >
              Next cipher
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
