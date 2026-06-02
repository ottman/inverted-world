"use client"

import { useEffect, useMemo, useState } from "react"
import { RotateCcw, Shuffle } from "lucide-react"
import { connectionsPuzzles, type ConnectionsPuzzle } from "@/data/games/connections-puzzles"
import { cn } from "@/lib/utils"

const DAY_MS = 86_400_000
const MAX_LIVES = 4

type Tile = { item: string; groupIndex: number }

// difficulty -> locked-bar styling. 0 gold, 1 cream, 2 emerald, 3 red.
const BAR_STYLES: Record<0 | 1 | 2 | 3, string> = {
  0: "border-[#fff8e6]/40 bg-[#fff8e6]/15 text-[#fff8e6]",
  1: "border-[#f4efe2]/30 bg-[#f4efe2]/10 text-[#f4efe2]",
  2: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
  3: "border-[#df2f2f]/55 bg-[#df2f2f]/15 text-[#fff8e6]",
}

// Deterministic seeded shuffle so the daily layout is stable per seed.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  const next = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildTiles(puzzle: ConnectionsPuzzle, seed: number): Tile[] {
  const all: Tile[] = []
  puzzle.groups.forEach((g, groupIndex) => {
    g.items.forEach((item) => all.push({ item, groupIndex }))
  })
  return seededShuffle(all, seed)
}

export function InvertedConnections() {
  const [dayIndex, setDayIndex] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [shuffleSeed, setShuffleSeed] = useState(0)

  const [selected, setSelected] = useState<string[]>([])
  const [solved, setSolved] = useState<number[]>([])
  const [lives, setLives] = useState(MAX_LIVES)
  const [message, setMessage] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  // Derive "today" only on the client to avoid hydration mismatch.
  useEffect(() => {
    setDayIndex(Math.floor(Date.now() / DAY_MS))
  }, [])

  const puzzleIndex = dayIndex === null ? 0 : (dayIndex + offset) % connectionsPuzzles.length
  const puzzle = connectionsPuzzles[puzzleIndex]

  const resetState = () => {
    setSelected([])
    setSolved([])
    setLives(MAX_LIVES)
    setMessage(null)
    setRevealed(false)
  }

  const tiles = useMemo(() => {
    if (dayIndex === null) return [] as Tile[]
    return buildTiles(puzzle, dayIndex + offset * 101 + shuffleSeed * 7919 + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIndex, offset, shuffleSeed, puzzleIndex])

  const lost = lives <= 0
  const won = solved.length === 4
  const done = won || lost

  const toggle = (item: string) => {
    if (done) return
    setMessage(null)
    setSelected((prev) => {
      if (prev.includes(item)) return prev.filter((i) => i !== item)
      if (prev.length >= 4) return prev
      return [...prev, item]
    })
  }

  const submit = () => {
    if (selected.length !== 4 || done) return
    const groupsHit = selected.map((item) => tiles.find((t) => t.item === item)?.groupIndex ?? -1)
    const first = groupsHit[0]
    const allSame = groupsHit.every((g) => g === first)

    if (allSame && first >= 0) {
      setSolved((prev) => [...prev, first])
      setSelected([])
      if (solved.length + 1 === 4) setMessage("All four cells cracked.")
      else setMessage(`Locked: ${puzzle.groups[first].label}.`)
      return
    }

    // "One away" feedback when 3 of 4 share a group.
    const counts = new Map<number, number>()
    groupsHit.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1))
    const oneAway = [...counts.values()].some((c) => c === 3)
    const nextLives = lives - 1
    setLives(nextLives)
    if (nextLives <= 0) {
      setRevealed(true)
      setMessage("Out of guesses. The connections are revealed.")
    } else {
      setMessage(oneAway ? "One away…" : "Not a connection.")
    }
  }

  const newPuzzle = () => {
    setOffset((o) => o + 1)
    setShuffleSeed(0)
    resetState()
  }

  // Locked groups, ordered by difficulty for a clean stack.
  const lockedOrder = [...solved].sort(
    (a, b) => puzzle.groups[a].difficulty - puzzle.groups[b].difficulty,
  )
  const remainingTiles = tiles.filter((t) => !solved.includes(t.groupIndex))

  // Stable placeholder until the client computes the day index.
  if (dayIndex === null) {
    return (
      <div className="grid gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Daily connections</p>
        <h3 className="iw-serif text-4xl text-[#fff8e6] sm:text-5xl">Find the four cells</h3>
        <p className="text-sm leading-6 text-[#f4efe2]/64">Loading today&rsquo;s grid…</p>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="aspect-[5/3] border border-[#f4efe2]/14 bg-[#070706]/40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Daily connections</p>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                "h-2.5 w-2.5 rounded-full border transition",
                i < lives ? "border-[#df2f2f] bg-[#df2f2f]" : "border-[#f4efe2]/20 bg-transparent",
              )}
            />
          ))}
          <span className="ml-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/55">
            {lives}/{MAX_LIVES}
          </span>
        </div>
      </div>

      <h3 className="iw-serif text-3xl leading-snug text-[#fff8e6] sm:text-4xl">
        Sort the sixteen into four hidden cells.
      </h3>

      {/* Locked / revealed group bars */}
      {(lockedOrder.length > 0 || revealed) && (
        <div className="grid gap-2">
          {(revealed
            ? puzzle.groups.map((_, i) => i).sort((a, b) => puzzle.groups[a].difficulty - puzzle.groups[b].difficulty)
            : lockedOrder
          )
            .filter((gi) => revealed || solved.includes(gi))
            .map((gi) => {
              const g = puzzle.groups[gi]
              const wasSolved = solved.includes(gi)
              return (
                <div
                  key={gi}
                  className={cn(
                    "grid gap-0.5 border px-4 py-2.5 text-center",
                    BAR_STYLES[g.difficulty],
                    revealed && !wasSolved && "opacity-80",
                  )}
                >
                  <p className="iw-serif text-base">{g.label}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-80">
                    {g.items.join(" · ")}
                  </p>
                </div>
              )
            })}
        </div>
      )}

      {/* Active grid */}
      {!revealed && remainingTiles.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {remainingTiles.map((tile) => {
            const isSel = selected.includes(tile.item)
            return (
              <button
                key={tile.item}
                type="button"
                onClick={() => toggle(tile.item)}
                disabled={done}
                className={cn(
                  "flex aspect-[5/3] items-center justify-center px-1 text-center text-[11px] font-semibold leading-tight transition sm:text-sm",
                  "select-none border",
                  isSel
                    ? "border-[#df2f2f] bg-[#df2f2f]/25 text-[#fff8e6]"
                    : "border-[#f4efe2]/14 bg-[#070706]/40 text-[#f4efe2]/85 hover:border-[#df2f2f]/45 hover:bg-[#df2f2f]/10",
                )}
              >
                {tile.item}
              </button>
            )
          })}
        </div>
      )}

      {message && (
        <p
          className={cn(
            "text-center text-sm font-semibold uppercase tracking-[0.14em]",
            won ? "text-emerald-400" : lost ? "text-[#df2f2f]" : "text-[#f4efe2]/70",
          )}
        >
          {message}
        </p>
      )}

      {/* Controls */}
      {!done ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShuffleSeed((s) => s + 1)}
              className="inline-flex items-center gap-1.5 border border-[#f4efe2]/16 bg-[#050504]/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/70 transition hover:text-[#fff8e6]"
            >
              <Shuffle className="h-3.5 w-3.5" /> Shuffle
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              disabled={selected.length === 0}
              className="inline-flex items-center gap-1.5 border border-[#f4efe2]/16 bg-[#050504]/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/70 transition hover:text-[#fff8e6] disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Deselect all
            </button>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={selected.length !== 4}
            className="iw-serif bg-[#df2f2f] px-6 py-2 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85 disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f4efe2]/10 pt-4">
          <p className="iw-serif text-xl text-[#f4efe2]/80">
            {won ? "Every cell cracked. The pattern holds." : "The truth slipped through your fingers."}
          </p>
          <button
            type="button"
            onClick={newPuzzle}
            className="iw-serif bg-[#df2f2f] px-6 py-2 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85"
          >
            New puzzle
          </button>
        </div>
      )}
    </div>
  )
}
