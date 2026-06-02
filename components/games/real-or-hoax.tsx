"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowUpRight, Check, X } from "lucide-react"
import { realOrHoaxItems, type RealOrHoaxItem } from "@/data/games/real-or-hoax"
import { cn } from "@/lib/utils"

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type Verdict = "real" | "hoax"

export function RealOrHoax() {
  const [started, setStarted] = useState(false)
  const [deck, setDeck] = useState<RealOrHoaxItem[]>([])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<Verdict | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)

  const start = useCallback(() => {
    setDeck(shuffle(realOrHoaxItems))
    setIndex(0)
    setPicked(null)
    setScore(0)
    setStreak(0)
    setBest(0)
    setStarted(true)
  }, [])

  const item = deck[index]
  const answered = picked !== null
  const correct = answered && item ? picked === item.verdict : false

  const judge = useCallback(
    (choice: Verdict) => {
      if (!item || picked !== null) return
      setPicked(choice)
      if (choice === item.verdict) {
        setScore((s) => s + 1)
        setStreak((s) => {
          const next = s + 1
          setBest((b) => (next > b ? next : b))
          return next
        })
      } else {
        setStreak(0)
      }
    },
    [item, picked],
  )

  const next = useCallback(() => {
    setPicked(null)
    setIndex((n) => {
      const m = n + 1
      if (m >= deck.length) {
        setDeck((d) => shuffle(d))
        return 0
      }
      return m
    })
  }, [deck.length])

  useEffect(() => {
    if (!started) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (!answered) {
        if (e.key === "ArrowLeft") judge("hoax")
        else if (e.key === "ArrowRight") judge("real")
      } else if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [started, answered, judge, next])

  if (!started) {
    return (
      <div className="grid place-items-center gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-8 text-center sm:p-12">
        <h3 className="iw-serif text-4xl text-[#fff8e6] sm:text-5xl">Real or Hoax?</h3>
        <p className="max-w-md text-sm leading-6 text-[#f4efe2]/70">
          A claim flashes up. Snap-judge it: declassified <span className="text-emerald-400">REAL</span> or debunked{" "}
          <span className="text-[#df2f2f]">HOAX</span>. Endless deck, {realOrHoaxItems.length} cases. Chase the streak.
        </p>
        <p className="text-xs uppercase tracking-[0.16em] text-[#f4efe2]/45">
          Keys: ← Hoax&nbsp;&nbsp;·&nbsp;&nbsp;→ Real
        </p>
        <button
          type="button"
          onClick={start}
          className="iw-serif bg-[#df2f2f] px-6 py-2 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85"
        >
          Begin
        </button>
      </div>
    )
  }

  if (!item) return null

  return (
    <div className="grid gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-5 sm:p-7">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/55">
        <span className="text-[#df2f2f]">Score {score}</span>
        <span>
          Streak {streak}
          <span className="text-[#f4efe2]/40"> · Best {best}</span>
        </span>
      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Case file</p>
      <h3 className="iw-serif min-h-[5rem] text-2xl leading-snug text-[#fff8e6] sm:text-3xl">{item.claim}</h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => judge("hoax")}
          disabled={answered}
          className={cn(
            "iw-serif border py-3 text-xl transition",
            !answered && "border-[#df2f2f]/40 bg-[#df2f2f]/10 text-[#fff8e6] hover:border-[#df2f2f]/70 hover:bg-[#df2f2f]/20",
            answered && item.verdict === "hoax" && "border-[#df2f2f]/60 bg-[#df2f2f]/20 text-[#fff8e6]",
            answered && item.verdict !== "hoax" && picked === "hoax" && "border-[#df2f2f]/40 bg-[#df2f2f]/10 text-[#fff8e6]/70 line-through",
            answered && item.verdict !== "hoax" && picked !== "hoax" && "border-[#f4efe2]/8 text-[#f4efe2]/35",
          )}
        >
          <span className="inline-flex items-center gap-2">
            {answered && item.verdict === "hoax" && <Check className="h-5 w-5 text-emerald-400" />}
            {answered && item.verdict !== "hoax" && picked === "hoax" && <X className="h-5 w-5 text-[#df2f2f]" />}
            Hoax
          </span>
        </button>
        <button
          type="button"
          onClick={() => judge("real")}
          disabled={answered}
          className={cn(
            "iw-serif border py-3 text-xl transition",
            !answered && "border-emerald-500/40 bg-emerald-500/10 text-[#fff8e6] hover:border-emerald-400/70 hover:bg-emerald-500/20",
            answered && item.verdict === "real" && "border-emerald-500/60 bg-emerald-500/20 text-[#fff8e6]",
            answered && item.verdict !== "real" && picked === "real" && "border-emerald-500/30 bg-emerald-500/10 text-[#fff8e6]/70 line-through",
            answered && item.verdict !== "real" && picked !== "real" && "border-[#f4efe2]/8 text-[#f4efe2]/35",
          )}
        >
          <span className="inline-flex items-center gap-2">
            {answered && item.verdict === "real" && <Check className="h-5 w-5 text-emerald-400" />}
            {answered && item.verdict !== "real" && picked === "real" && <X className="h-5 w-5 text-[#df2f2f]" />}
            Real
          </span>
        </button>
      </div>

      {answered && (
        <div className="grid gap-3 border-t border-[#f4efe2]/10 pt-4">
          <p className="text-sm font-semibold uppercase tracking-[0.12em]">
            <span className={correct ? "text-emerald-400" : "text-[#df2f2f]"}>{correct ? "Correct" : "Wrong"}</span>
            <span className="text-[#f4efe2]/45">
              {" · "}
              {item.verdict === "real" ? "This one is real" : "This one is a hoax"}
            </span>
          </p>
          <p className="text-sm leading-6 text-[#f4efe2]/80">{item.blurb}</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={item.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/55 transition hover:text-[#df2f2f]"
            >
              See the evidence <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={next}
              className="iw-serif bg-[#df2f2f] px-5 py-1.5 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
