"use client"

import { useState } from "react"
import { ArrowUpRight, Check, X } from "lucide-react"
import { conspiracyTrivia, type TriviaQuestion } from "@/data/conspiracy-trivia"
import { cn } from "@/lib/utils"

const ROUND = 10

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function ConspiracyTrivia() {
  const [deck, setDeck] = useState<TriviaQuestion[] | null>(null)
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)

  const start = () => {
    setDeck(shuffle(conspiracyTrivia).slice(0, ROUND))
    setIndex(0)
    setPicked(null)
    setScore(0)
  }

  if (!deck) {
    return (
      <div className="grid place-items-center gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-8 text-center sm:p-12">
        <h3 className="iw-serif text-4xl text-[#fff8e6] sm:text-5xl">Conspiracy or Fact?</h3>
        <p className="max-w-md text-sm leading-6 text-[#f4efe2]/70">
          {conspiracyTrivia.length} questions on conspiracies that turned out to be <span className="text-[#df2f2f]">true</span> —
          declassified files, Senate reports, court rulings. {ROUND} per round.
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

  if (index >= deck.length) {
    const verdict = score >= 9 ? "Watcher of the watchers." : score >= 6 ? "Suitably paranoid." : "Trust restored… for now."
    return (
      <div className="grid place-items-center gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-8 text-center sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Round complete</p>
        <h3 className="iw-serif text-5xl text-[#fff8e6] sm:text-6xl">
          {score}/{deck.length}
        </h3>
        <p className="iw-serif text-2xl text-[#f4efe2]/80">{verdict}</p>
        <button
          type="button"
          onClick={start}
          className="iw-serif bg-[#df2f2f] px-6 py-2 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85"
        >
          Play again
        </button>
      </div>
    )
  }

  const q = deck[index]
  const answered = picked !== null
  const correct = answered && picked === q.correctIndex

  const choose = (i: number) => {
    if (answered) return
    setPicked(i)
    if (i === q.correctIndex) setScore((s) => s + 1)
  }

  return (
    <div className="grid gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-5 sm:p-7">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/55">
        <span>
          Question {index + 1} / {deck.length}
        </span>
        <span className="text-[#df2f2f]">Score {score}</span>
      </div>
      <h3 className="iw-serif text-2xl leading-snug text-[#fff8e6] sm:text-3xl">{q.question}</h3>
      <div className="grid gap-2">
        {q.options.map((option, i) => {
          const isCorrect = i === q.correctIndex
          const isPicked = i === picked
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={answered}
              className={cn(
                "flex items-center justify-between gap-3 border px-4 py-3 text-left text-base transition",
                !answered && "border-[#f4efe2]/14 bg-[#070706]/40 hover:border-[#df2f2f]/50 hover:bg-[#df2f2f]/10",
                answered && isCorrect && "border-emerald-500/60 bg-emerald-500/15 text-[#fff8e6]",
                answered && isPicked && !isCorrect && "border-[#df2f2f]/60 bg-[#df2f2f]/15 text-[#fff8e6]",
                answered && !isCorrect && !isPicked && "border-[#f4efe2]/8 text-[#f4efe2]/45",
              )}
            >
              <span>{option}</span>
              {answered && isCorrect && <Check className="h-5 w-5 shrink-0 text-emerald-400" />}
              {answered && isPicked && !isCorrect && <X className="h-5 w-5 shrink-0 text-[#df2f2f]" />}
            </button>
          )
        })}
      </div>
      {answered && (
        <div className="grid gap-3 border-t border-[#f4efe2]/10 pt-4">
          <p className="text-sm font-semibold uppercase tracking-[0.12em]">
            <span className={correct ? "text-emerald-400" : "text-[#df2f2f]"}>{correct ? "Correct" : "True story"}</span>
            <span className="text-[#f4efe2]/45"> · {q.conspiracy}</span>
          </p>
          <p className="text-sm leading-6 text-[#f4efe2]/80">{q.explanation}</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={q.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/55 transition hover:text-[#df2f2f]"
            >
              See the evidence <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={() => {
                setIndex((n) => n + 1)
                setPicked(null)
              }}
              className="iw-serif bg-[#df2f2f] px-5 py-1.5 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85"
            >
              {index + 1 >= deck.length ? "See score" : "Next"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
