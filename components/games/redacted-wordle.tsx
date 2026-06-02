"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, Check, Delete, CornerDownLeft } from "lucide-react"
import { redactedWords } from "@/data/games/redacted-words"
import { cn } from "@/lib/utils"

// REDACTED — a daily Wordle clone where the answer is a "classified codeword". The puzzle of the day
// is derived ONLY on the client (after mount) from the browser clock to avoid hydration mismatch on
// the statically rendered games page. Letter feedback: green = correct spot, gold = in word / wrong
// spot, dark = absent. On-screen QWERTY + physical keyboard both work. After win/lose the codeword is
// revealed with on-brand framing and a copyable emoji share grid.
const WORD_LEN = 5
const MAX_ROWS = 6
const DAY_MS = 86_400_000

type LetterState = "correct" | "present" | "absent"
type RowEval = LetterState[]

const KEY_ROWS: string[][] = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
]

// Score one guess against the answer using classic Wordle two-pass logic so duplicate letters resolve
// correctly (greens first, then presents drawn from the remaining pool).
function evaluate(guess: string, answer: string): RowEval {
  const result: RowEval = Array<LetterState>(WORD_LEN).fill("absent")
  const pool: Record<string, number> = {}
  for (let i = 0; i < WORD_LEN; i += 1) {
    if (guess[i] === answer[i]) {
      result[i] = "correct"
    } else {
      pool[answer[i]] = (pool[answer[i]] ?? 0) + 1
    }
  }
  for (let i = 0; i < WORD_LEN; i += 1) {
    if (result[i] === "correct") continue
    const ch = guess[i]
    if ((pool[ch] ?? 0) > 0) {
      result[i] = "present"
      pool[ch] -= 1
    }
  }
  return result
}

const STATE_RANK: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 }

const SQUARE: Record<LetterState, string> = { correct: "🟩", present: "🟨", absent: "⬛" }

const cellTone: Record<LetterState, string> = {
  correct: "border-emerald-500/60 bg-emerald-500/20 text-[#fff8e6]",
  present: "border-[#df2f2f]/40 bg-[#fff8e6]/15 text-[#fff8e6]",
  absent: "border-[#f4efe2]/10 bg-[#050504]/60 text-[#f4efe2]/45",
}

const keyTone: Record<LetterState, string> = {
  correct: "border-emerald-500/60 bg-emerald-500/25 text-[#fff8e6]",
  present: "border-[#df2f2f]/40 bg-[#fff8e6]/20 text-[#fff8e6]",
  absent: "border-[#f4efe2]/8 bg-[#050504]/70 text-[#f4efe2]/35",
}

export function RedactedWordle() {
  const [answer, setAnswer] = useState<string | null>(null)
  const [practice, setPractice] = useState(false)
  const [guesses, setGuesses] = useState<string[]>([])
  const [current, setCurrent] = useState("")
  const [shake, setShake] = useState(false)
  const [copied, setCopied] = useState(false)

  // Client-only puzzle selection (DAILY rule): never compute "today" during render/SSR.
  useEffect(() => {
    const dayIndex = Math.floor(Date.now() / DAY_MS)
    setAnswer(redactedWords[dayIndex % redactedWords.length])
  }, [])

  const won = answer !== null && guesses[guesses.length - 1] === answer
  const finished = won || guesses.length >= MAX_ROWS

  const evaluations = useMemo(
    () => (answer === null ? [] : guesses.map((g) => evaluate(g, answer))),
    [guesses, answer],
  )

  // Best-known state per letter across all guesses, for the on-screen keyboard coloring.
  const keyStates = useMemo(() => {
    const map: Record<string, LetterState> = {}
    guesses.forEach((g, row) => {
      const ev = evaluations[row]
      if (!ev) return
      for (let i = 0; i < WORD_LEN; i += 1) {
        const ch = g[i]
        const next = ev[i]
        if (!map[ch] || STATE_RANK[next] > STATE_RANK[map[ch]]) map[ch] = next
      }
    })
    return map
  }, [guesses, evaluations])

  const reset = useCallback((random: boolean) => {
    setGuesses([])
    setCurrent("")
    setCopied(false)
    setShake(false)
    if (random) {
      setPractice(true)
      setAnswer(redactedWords[Math.floor(Math.random() * redactedWords.length)])
    } else {
      setPractice(false)
      const dayIndex = Math.floor(Date.now() / DAY_MS)
      setAnswer(redactedWords[dayIndex % redactedWords.length])
    }
  }, [])

  const submit = useCallback(() => {
    if (answer === null || finished) return
    if (current.length !== WORD_LEN) {
      setShake(true)
      window.setTimeout(() => setShake(false), 420)
      return
    }
    setGuesses((g) => [...g, current])
    setCurrent("")
  }, [answer, current, finished])

  const onKey = useCallback(
    (raw: string) => {
      if (answer === null || finished) return
      const key = raw.toUpperCase()
      if (key === "ENTER" || key === "BACK") {
        if (key === "ENTER") submit()
        else setCurrent((c) => c.slice(0, -1))
        return
      }
      if (/^[A-Z]$/.test(key)) {
        setCurrent((c) => (c.length < WORD_LEN ? c + key : c))
      }
    },
    [answer, finished, submit],
  )

  // Physical keyboard support.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "Enter") {
        e.preventDefault()
        onKey("ENTER")
      } else if (e.key === "Backspace") {
        e.preventDefault()
        onKey("BACK")
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        onKey(e.key)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onKey])

  const shareGrid = useMemo(() => {
    if (answer === null) return ""
    const label = practice ? "REDACTED · practice" : `REDACTED ${Math.floor(Date.now() / DAY_MS)}`
    const head = `${label}  ${won ? guesses.length : "X"}/${MAX_ROWS}`
    const rows = evaluations.map((ev) => ev.map((s) => SQUARE[s]).join("")).join("\n")
    return `${head}\n${rows}`
  }, [answer, evaluations, guesses.length, won, practice])

  const copyShare = useCallback(() => {
    if (!shareGrid) return
    void navigator.clipboard?.writeText(shareGrid).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    })
  }, [shareGrid])

  // Stable placeholder until the client has chosen the daily codeword.
  if (answer === null) {
    return (
      <div className="grid place-items-center gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-8 text-center sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Decrypting</p>
        <h3 className="iw-serif text-4xl text-[#fff8e6] sm:text-5xl">REDACTED</h3>
        <p className="max-w-md text-sm leading-6 text-[#f4efe2]/70">
          Loading today&apos;s classified codeword…
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 border border-[#f4efe2]/14 bg-[#050504]/30 p-5 sm:p-7">
      <div className="flex items-center justify-between">
        <div className="grid gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">
            {practice ? "Practice file" : "Daily codeword"}
          </p>
          <h3 className="iw-serif text-3xl text-[#fff8e6] sm:text-4xl">REDACTED</h3>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/55">
          {Math.min(guesses.length + (finished ? 0 : 1), MAX_ROWS)} / {MAX_ROWS}
        </p>
      </div>

      <p className="text-sm leading-6 text-[#f4efe2]/64">
        Decrypt the five-letter codeword in {MAX_ROWS} attempts.
      </p>

      {/* Grid */}
      <div className="mx-auto grid gap-1.5">
        {Array.from({ length: MAX_ROWS }).map((_, row) => {
          const guess = guesses[row]
          const isCurrentRow = row === guesses.length && !finished
          const text = guess ?? (isCurrentRow ? current : "")
          const ev = evaluations[row]
          return (
            <div
              key={row}
              className={cn(
                "grid grid-cols-5 gap-1.5",
                isCurrentRow && shake && "animate-[redacted-shake_0.4s_ease-in-out]",
              )}
            >
              {Array.from({ length: WORD_LEN }).map((__, col) => {
                const ch = text[col] ?? ""
                const tone = ev ? cellTone[ev[col]] : ""
                return (
                  <div
                    key={col}
                    className={cn(
                      "grid h-12 w-12 place-items-center border text-2xl font-semibold uppercase iw-serif sm:h-14 sm:w-14",
                      ev
                        ? tone
                        : ch
                          ? "border-[#df2f2f]/40 bg-[#070706]/50 text-[#fff8e6]"
                          : "border-[#f4efe2]/14 bg-[#070706]/40 text-[#fff8e6]",
                    )}
                  >
                    {ch}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* End state */}
      {finished && (
        <div className="grid gap-3 border-t border-[#f4efe2]/10 pt-4 text-center">
          <p
            className={cn(
              "iw-serif text-2xl sm:text-3xl",
              won ? "text-emerald-400" : "text-[#df2f2f]",
            )}
          >
            {won ? "CODEWORD DECRYPTED" : "FILE STAYS SEALED"}
          </p>
          {!won && (
            <p className="text-sm uppercase tracking-[0.16em] text-[#f4efe2]/64">
              The codeword was <span className="text-[#fff8e6]">{answer}</span>
            </p>
          )}
          <pre className="mx-auto whitespace-pre text-base leading-5 tracking-[0.18em]">
            {evaluations.map((row) => row.map((s) => SQUARE[s]).join("")).join("\n")}
          </pre>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={copyShare}
              className="inline-flex items-center gap-2 border border-[#f4efe2]/16 bg-[#050504]/50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#fff8e6] transition hover:border-[#df2f2f]/50"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Share grid"}
            </button>
            <button
              type="button"
              onClick={() => reset(true)}
              className="iw-serif bg-[#df2f2f] px-6 py-2 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85"
            >
              Practice (random)
            </button>
          </div>
        </div>
      )}

      {/* On-screen keyboard */}
      {!finished && (
        <div className="grid gap-1.5">
          {KEY_ROWS.map((krow, i) => (
            <div key={i} className="flex justify-center gap-1.5">
              {krow.map((key) => {
                const wide = key === "ENTER" || key === "BACK"
                const state = key.length === 1 ? keyStates[key] : undefined
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onKey(key)}
                    className={cn(
                      "select-none border py-3 text-sm font-semibold uppercase text-[#fff8e6] transition active:bg-[#df2f2f]/30",
                      wide ? "flex-1 px-2 text-xs" : "min-w-7 flex-1 px-0",
                      state ? keyTone[state] : "border-[#f4efe2]/16 bg-[#050504]/50",
                    )}
                  >
                    {key === "BACK" ? (
                      <Delete className="mx-auto h-4 w-4" />
                    ) : key === "ENTER" ? (
                      <CornerDownLeft className="mx-auto h-4 w-4" />
                    ) : (
                      key
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {!practice && finished && (
        <p className="text-center text-xs uppercase tracking-[0.14em] text-[#f4efe2]/45">
          New codeword declassified every day.
        </p>
      )}

      <style>{`@keyframes redacted-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>
    </div>
  )
}
