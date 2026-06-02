"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// A compact Flappy-Bird-style game rendered on a TRANSPARENT canvas so the page's animated Waves
// background shows through. The player guides the Point Pleasant Mothman between the girders of the
// Silver Bridge. Entities are drawn in the site palette (near-black winged silhouette with glowing
// red eyes; red/cream girders). Space / ArrowUp / click / tap all flap.
const CREAM = "#f4efe2"
const RED = "#df2f2f"
const GOLD = "#fff8e6"
const DARK = "#070706"

const W = 420
const H = 560

const GAP = 150 // vertical gap the Mothman flies through
const GIRDER_W = 64
const GRAVITY = 0.0011 // px per ms^2 — gentle
const FLAP_V = -0.42 // px per ms
const MAX_FALL = 0.55
const BIRD_R = 14
const SPAWN_X_GAP = 230 // horizontal spacing between girder pairs

type Girder = { x: number; gapY: number; passed: boolean; cream: boolean }

type GameState = {
  birdY: number
  birdVy: number
  girders: Girder[]
  speed: number // px per ms
  flapTime: number // timestamp of last flap, for wing animation
  score: number
  started: boolean // false until the player hits Start — world stays still behind the overlay
  over: boolean
}

function freshState(): GameState {
  return {
    birdY: H / 2,
    birdVy: 0,
    girders: [],
    speed: 0.16,
    flapTime: 0,
    score: 0,
    started: false,
    over: false,
  }
}

function randGapY(): number {
  const margin = 70
  return margin + Math.random() * (H - GAP - margin * 2)
}

export function MothmanFlap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef<GameState>(freshState())
  const rafRef = useRef<number | null>(null)
  const [hud, setHud] = useState({ score: 0, over: false, started: false, best: 0 })

  const flap = useCallback(() => {
    const s = stateRef.current
    if (s.started && !s.over) {
      s.birdVy = FLAP_V
      s.flapTime = performance.now()
    }
  }, [])

  const reset = useCallback(() => {
    const s = freshState()
    s.started = true
    stateRef.current = s
    setHud((prev) => ({ score: 0, over: false, started: true, best: prev.best }))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === " " || k === "spacebar" || k === "arrowup" || k === "w") {
        e.preventDefault()
        flap()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flap])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let last = 0

    const loop = (t: number) => {
      const dt = Math.min(40, t - last || 16)
      last = t
      const s = stateRef.current
      const birdX = W * 0.3

      if (s.started && !s.over) {
        // physics
        s.birdVy = Math.min(MAX_FALL, s.birdVy + GRAVITY * dt)
        s.birdY += s.birdVy * dt

        // scroll girders
        const move = s.speed * dt
        for (const g of s.girders) g.x -= move
        s.girders = s.girders.filter((g) => g.x + GIRDER_W > -4)

        // spawn: keep a girder ahead at a steady horizontal cadence
        const furthest = s.girders.reduce((m, g) => Math.max(m, g.x), -Infinity)
        if (s.girders.length === 0 || furthest <= W - SPAWN_X_GAP) {
          const startX = s.girders.length === 0 ? W + 40 : furthest + SPAWN_X_GAP
          s.girders.push({ x: startX, gapY: randGapY(), passed: false, cream: Math.random() < 0.5 })
        }

        // score + speed up
        for (const g of s.girders) {
          if (!g.passed && g.x + GIRDER_W < birdX - BIRD_R) {
            g.passed = true
            s.score += 1
            s.speed = Math.min(0.34, s.speed + 0.006)
          }
        }

        // collisions: edges
        if (s.birdY - BIRD_R <= 0 || s.birdY + BIRD_R >= H) {
          s.over = true
        }
        // collisions: girders (top rect = 0..gapY, bottom rect = gapY+GAP..H)
        for (const g of s.girders) {
          const inX = birdX + BIRD_R > g.x && birdX - BIRD_R < g.x + GIRDER_W
          if (inX) {
            if (s.birdY - BIRD_R < g.gapY || s.birdY + BIRD_R > g.gapY + GAP) {
              s.over = true
            }
          }
        }

        if (s.over) {
          setHud((prev) => ({
            score: s.score,
            over: true,
            started: true,
            best: Math.max(prev.best, s.score),
          }))
        } else {
          // Bail out (return prev) when nothing changed so React skips the re-render.
          setHud((prev) => (prev.score === s.score ? prev : { ...prev, score: s.score, started: true }))
        }
      }

      // ---- render (transparent canvas; waves show through) ----
      ctx.clearRect(0, 0, W, H)

      // girders (bridge-like vertical pairs)
      for (const g of s.girders) {
        const col = g.cream ? CREAM : RED
        ctx.fillStyle = col
        ctx.globalAlpha = 0.9
        // top
        ctx.fillRect(g.x, 0, GIRDER_W, g.gapY)
        // bottom
        ctx.fillRect(g.x, g.gapY + GAP, GIRDER_W, H - (g.gapY + GAP))
        // girder cross-hatch detail (rivet lines)
        ctx.globalAlpha = 0.28
        ctx.fillStyle = DARK
        for (let yy = 10; yy < g.gapY; yy += 24) ctx.fillRect(g.x + 6, yy, GIRDER_W - 12, 3)
        for (let yy = g.gapY + GAP + 10; yy < H; yy += 24) ctx.fillRect(g.x + 6, yy, GIRDER_W - 12, 3)
        // gap-edge caps
        ctx.globalAlpha = 0.95
        ctx.fillStyle = col
        ctx.fillRect(g.x - 4, g.gapY - 8, GIRDER_W + 8, 8)
        ctx.fillRect(g.x - 4, g.gapY + GAP, GIRDER_W + 8, 8)
      }
      ctx.globalAlpha = 1

      // ---- Mothman ----
      const tilt = Math.max(-0.5, Math.min(0.9, s.birdVy * 1.6))
      // wing flap phase: spread right after a flap, folded as it falls
      const sinceFlap = performance.now() - s.flapTime
      const wingUp = sinceFlap < 160
      ctx.save()
      ctx.translate(birdX, s.birdY)
      ctx.rotate(tilt)

      // wings (dark silhouette)
      ctx.fillStyle = DARK
      ctx.globalAlpha = 0.95
      const wingSpread = wingUp ? 26 : 16
      const wingLift = wingUp ? -16 : -4
      // left wing
      ctx.beginPath()
      ctx.moveTo(-2, -2)
      ctx.quadraticCurveTo(-wingSpread - 8, wingLift, -wingSpread - 14, 6)
      ctx.quadraticCurveTo(-wingSpread, 8, -4, 8)
      ctx.closePath()
      ctx.fill()
      // right wing
      ctx.beginPath()
      ctx.moveTo(2, -2)
      ctx.quadraticCurveTo(wingSpread + 8, wingLift, wingSpread + 14, 6)
      ctx.quadraticCurveTo(wingSpread, 8, 4, 8)
      ctx.closePath()
      ctx.fill()

      // body (near-black with a faint cream rim)
      ctx.fillStyle = DARK
      ctx.beginPath()
      ctx.ellipse(0, 2, BIRD_R - 2, BIRD_R + 2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = CREAM
      ctx.globalAlpha = 0.22
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.globalAlpha = 1

      // glowing red eyes
      ctx.fillStyle = RED
      ctx.shadowColor = RED
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(-5, -4, 3.2, 0, Math.PI * 2)
      ctx.arc(5, -4, 3.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      // eye highlight
      ctx.fillStyle = GOLD
      ctx.globalAlpha = 0.7
      ctx.beginPath()
      ctx.arc(-6, -5, 1, 0, Math.PI * 2)
      ctx.arc(4, -5, 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1

      ctx.restore()

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // Set up the RAF loop ONCE; it reads live state via stateRef and pushes HUD updates with a
    // functional setHud, so it must not be re-created on score changes.
  }, [])

  const onCanvasPointer = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    if (!hud.started || hud.over) return
    flap()
  }, [flap, hud.started, hud.over])

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/70">
        <span className="text-[#df2f2f]">Score {hud.score}</span>
        <span>Best {hud.best}</span>
      </div>
      <div className="relative overflow-hidden border border-[#f4efe2]/14 bg-[#050504]/30">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onCanvasPointer}
          className="block h-auto w-full touch-none"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
        {(!hud.started || hud.over) && (
          <div className="absolute inset-0 grid place-items-center bg-[#070706]/70 backdrop-blur-[1px]">
            <div className="grid gap-3 px-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#df2f2f]">Point Pleasant, WV</p>
              <h3 className="iw-serif text-4xl text-[#fff8e6] sm:text-5xl">
                {hud.over ? "The bridge took you" : "Mothman Flap"}
              </h3>
              {hud.over ? (
                <p className="text-sm text-[#f4efe2]/70">Score {hud.score} · Best {hud.best}</p>
              ) : (
                <p className="text-sm text-[#f4efe2]/64">Glide the harbinger between the Silver Bridge girders.</p>
              )}
              <button
                type="button"
                onClick={reset}
                className="iw-serif mx-auto bg-[#df2f2f] px-6 py-2 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85"
              >
                {hud.started && hud.over ? "Play again" : "Start"}
              </button>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#f4efe2]/40">Tap / Space to flap</p>
            </div>
          </div>
        )}
      </div>
      {/* Mobile touch control */}
      <div className="sm:hidden">
        <TouchBtn label="FLAP" wide onDown={flap} onUp={() => {}} />
      </div>
    </div>
  )
}

function TouchBtn({ label, wide, onDown, onUp }: { label: string; wide?: boolean; onDown: () => void; onUp: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onDown() }}
      onPointerUp={(e) => { e.preventDefault(); onUp() }}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
      className={cn(
        "select-none border border-[#f4efe2]/16 bg-[#050504]/50 py-3 text-lg font-semibold text-[#fff8e6] active:bg-[#df2f2f]/30",
        wide ? "w-full px-8 text-[#df2f2f]" : "w-14",
      )}
    >
      {label}
    </button>
  )
}
