"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera } from "lucide-react"
import { cn } from "@/lib/utils"

// Cryptid Cam — a themed whack-a-mole. Cryptids pop into a 3x3 DOM grid for a short,
// shrinking window; tap/click a visible cryptid to "photograph" it (+points, combo). Decoys
// (a tree, an owl, a shadow) cost points if snapped. 30s round, difficulty ramps over time.
// DOM grid (not canvas) for reliable touch. No external images — glyph + name only.

const ROUND_MS = 30_000

type Cryptid = {
  name: string
  glyph: string
  // Real, well-documented cryptid/legend references (Wikipedia).
  ref: string
}

type Decoy = {
  name: string
  glyph: string
}

const CRYPTIDS: Cryptid[] = [
  { name: "Mothman", glyph: "🦋", ref: "https://en.wikipedia.org/wiki/Mothman" },
  { name: "Bigfoot", glyph: "🦍", ref: "https://en.wikipedia.org/wiki/Bigfoot" },
  { name: "Nessie", glyph: "🐉", ref: "https://en.wikipedia.org/wiki/Loch_Ness_Monster" },
  { name: "Chupacabra", glyph: "🐺", ref: "https://en.wikipedia.org/wiki/Chupacabra" },
  { name: "Yeti", glyph: "❄", ref: "https://en.wikipedia.org/wiki/Yeti" },
  { name: "Flatwoods Monster", glyph: "👽", ref: "https://en.wikipedia.org/wiki/Flatwoods_monster" },
  { name: "Jersey Devil", glyph: "👹", ref: "https://en.wikipedia.org/wiki/Jersey_Devil" },
  { name: "Thylacine", glyph: "🐅", ref: "https://en.wikipedia.org/wiki/Thylacine" },
]

const DECOYS: Decoy[] = [
  { name: "just a tree", glyph: "🌲" },
  { name: "an owl", glyph: "🦉" },
  { name: "a shadow", glyph: "🌑" },
  { name: "a stray dog", glyph: "🐕" },
]

const SPOTS = 9

type Target =
  | { kind: "cryptid"; data: Cryptid; spot: number; bornAt: number; window: number }
  | { kind: "decoy"; data: Decoy; spot: number; bornAt: number; window: number }

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function CryptidCam() {
  const [started, setStarted] = useState(false)
  const [over, setOver] = useState(false)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [best, setBest] = useState(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_MS)
  const [target, setTarget] = useState<Target | null>(null)
  const [flash, setFlash] = useState(false)
  const [hitSpot, setHitSpot] = useState<{ spot: number; good: boolean } | null>(null)

  // Authoritative game state lives in refs so the rAF/spawn loops stay stable.
  const startRef = useRef(0)
  const targetRef = useRef<Target | null>(null)
  const comboRef = useRef(0)
  const scoreRef = useRef(0)
  const overRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    overRef.current = false
    comboRef.current = 0
    scoreRef.current = 0
    targetRef.current = null
    startRef.current = (typeof performance !== "undefined" ? performance.now() : Date.now())
    setStarted(true)
    setOver(false)
    setScore(0)
    setCombo(0)
    setTimeLeft(ROUND_MS)
    setTarget(null)
  }, [])

  const fireFlash = useCallback(() => {
    setFlash(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(false), 140)
  }, [])

  const markSpot = useCallback((spot: number, good: boolean) => {
    setHitSpot({ spot, good })
    if (hitTimer.current) clearTimeout(hitTimer.current)
    hitTimer.current = setTimeout(() => setHitSpot(null), 260)
  }, [])

  const snap = useCallback(
    (spot: number) => {
      const t = targetRef.current
      if (!t || overRef.current || t.spot !== spot) return
      fireFlash()
      if (t.kind === "cryptid") {
        const nextCombo = comboRef.current + 1
        comboRef.current = nextCombo
        // base 100, +10 per cryptid in the round window, scaled by combo multiplier.
        const gained = (100 + Math.min(nextCombo, 8) * 10) * Math.max(1, nextCombo)
        scoreRef.current += gained
        setScore(scoreRef.current)
        setCombo(nextCombo)
        markSpot(spot, true)
      } else {
        // decoy: break the combo and dock points (floored at 0).
        comboRef.current = 0
        scoreRef.current = Math.max(0, scoreRef.current - 150)
        setScore(scoreRef.current)
        setCombo(0)
        markSpot(spot, false)
      }
      targetRef.current = null
      setTarget(null)
    },
    [fireFlash, markSpot],
  )

  // Spawn + expiry loop, driven by rAF with a delta clamp; difficulty ramps with elapsed time.
  useEffect(() => {
    if (!started || over) return
    let nextSpawnAt = 0

    const tick = () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now()
      const elapsed = now - startRef.current
      const remaining = ROUND_MS - elapsed

      if (remaining <= 0) {
        overRef.current = true
        targetRef.current = null
        setTarget(null)
        setTimeLeft(0)
        setOver(true)
        setBest((b) => {
          const next = Math.max(b, scoreRef.current)
          return next
        })
        return
      }
      setTimeLeft(remaining)

      // progress 0 -> 1 across the round; faster pops + shorter windows as it climbs.
      const progress = Math.min(1, elapsed / ROUND_MS)
      const spawnGap = 900 - progress * 520 // 900ms -> 380ms between pops
      const baseWindow = 1300 - progress * 720 // 1300ms -> 580ms visible window

      const t = targetRef.current
      if (t && now - t.bornAt > t.window) {
        // missed cryptid breaks combo; expired decoy is harmless.
        if (t.kind === "cryptid") {
          comboRef.current = 0
          setCombo(0)
        }
        targetRef.current = null
        setTarget(null)
      }

      if (!targetRef.current && now >= nextSpawnAt) {
        const spot = Math.floor(Math.random() * SPOTS)
        const isDecoy = Math.random() < 0.22 + progress * 0.13 // 22% -> 35% decoy odds
        const jitter = 0.85 + Math.random() * 0.3
        const window = baseWindow * jitter
        const fresh: Target = isDecoy
          ? { kind: "decoy", data: pick(DECOYS), spot, bornAt: now, window }
          : { kind: "cryptid", data: pick(CRYPTIDS), spot, bornAt: now, window }
        targetRef.current = fresh
        setTarget(fresh)
        nextSpawnAt = now + spawnGap * (0.8 + Math.random() * 0.4)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [started, over])

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
      if (hitTimer.current) clearTimeout(hitTimer.current)
    },
    [],
  )

  const seconds = Math.ceil(timeLeft / 1000)
  const timePct = Math.max(0, Math.min(100, (timeLeft / ROUND_MS) * 100))

  // ----- Start screen -----
  if (!started) {
    return (
      <div className="grid place-items-center gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-8 text-center sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Field expedition</p>
        <h3 className="iw-serif text-4xl text-[#fff8e6] sm:text-5xl">Cryptid Cam</h3>
        <p className="max-w-md text-sm leading-6 text-[#f4efe2]/64">
          They only surface for a heartbeat. Tap the cryptid to photograph it before it slips back into the dark —
          build a combo, but do not waste film on a stray owl or a shadow. <span className="text-[#df2f2f]">30 seconds.</span>
        </p>
        <button
          type="button"
          onClick={reset}
          className="iw-serif bg-[#df2f2f] px-6 py-2 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85"
        >
          Start the hunt
        </button>
      </div>
    )
  }

  // ----- End screen -----
  if (over) {
    const verdict =
      score >= 2500
        ? "Cryptozoology has its proof."
        : score >= 1200
          ? "Blurry, but undeniable."
          : "Inconclusive. The woods keep their secrets."
    return (
      <div className="grid place-items-center gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-8 text-center sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Roll developed</p>
        <h3 className="iw-serif text-5xl text-[#fff8e6] sm:text-6xl">{score}</h3>
        <p className="iw-serif text-2xl text-[#f4efe2]/80">{verdict}</p>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/55">Best {Math.max(best, score)}</p>
        <button
          type="button"
          onClick={reset}
          className="iw-serif bg-[#df2f2f] px-6 py-2 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85"
        >
          Play again
        </button>
      </div>
    )
  }

  // ----- Live HUD + grid -----
  return (
    <div className="grid gap-4 border border-[#f4efe2]/14 bg-[#050504]/30 p-5 sm:p-7">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/55">
        <span className="text-[#df2f2f]">Score {score}</span>
        <span className={cn(combo >= 2 && "text-[#fff8e6]")}>
          Combo ×{Math.max(1, combo)}
        </span>
        <span>Best {Math.max(best, score)}</span>
      </div>

      {/* Round timer bar */}
      <div className="flex items-center gap-3">
        <span className="w-7 text-right text-sm font-semibold tabular-nums text-[#fff8e6]">{seconds}</span>
        <div className="h-1.5 flex-1 overflow-hidden bg-[#070706]/60">
          <div
            className="h-full bg-[#df2f2f] transition-[width] duration-100 ease-linear"
            style={{ width: `${timePct}%` }}
          />
        </div>
      </div>

      <div className="relative">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {Array.from({ length: SPOTS }, (_, spot) => {
            const t = target && target.spot === spot ? target : null
            const hit = hitSpot && hitSpot.spot === spot ? hitSpot : null
            return (
              <button
                key={spot}
                type="button"
                aria-label={t ? (t.kind === "cryptid" ? `Photograph ${t.data.name}` : `${t.data.name}`) : "Empty thicket"}
                onPointerDown={(e) => {
                  e.preventDefault()
                  snap(spot)
                }}
                className={cn(
                  "relative grid aspect-square select-none touch-none place-items-center overflow-hidden border border-[#f4efe2]/14 bg-[#050504]/40 transition-colors",
                  t && "border-[#df2f2f]/30",
                  hit?.good && "border-emerald-500/60 bg-emerald-500/15",
                  hit && !hit.good && "border-[#df2f2f]/60 bg-[#df2f2f]/15",
                )}
              >
                {t && (
                  <span className="grid place-items-center gap-1 px-1 text-center">
                    <span
                      className={cn(
                        "text-3xl leading-none sm:text-4xl",
                        "[animation:cc-pop_180ms_ease-out]",
                      )}
                      aria-hidden
                    >
                      {t.data.glyph}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-[0.1em]",
                        t.kind === "cryptid" ? "text-[#fff8e6]" : "text-[#f4efe2]/45",
                      )}
                    >
                      {t.data.name}
                    </span>
                  </span>
                )}
                {hit?.good && (
                  <span className="pointer-events-none absolute right-1 top-1 text-xs font-semibold text-emerald-400">+</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Camera-flash overlay: white fade on a successful (or any) snap */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-[#fff8e6] transition-opacity duration-150",
            flash ? "opacity-70" : "opacity-0",
          )}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[#f4efe2]/40">
          <Camera className="h-3.5 w-3.5" /> Snap cryptids · skip the decoys
        </p>
        {target?.kind === "cryptid" && (
          <a
            href={target.data.ref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f4efe2]/40 transition hover:text-[#df2f2f]"
          >
            Case file
          </a>
        )}
      </div>

      <style>{`@keyframes cc-pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
    </div>
  )
}
