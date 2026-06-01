"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// A compact Space Invaders rendered on a TRANSPARENT canvas so the page's animated Waves background
// shows through. Entities are drawn in the site palette (cream invaders, red ship + fire). Keyboard
// (← → / A D, Space) on desktop; touch buttons on mobile.
const CREAM = "#f4efe2"
const RED = "#df2f2f"
const GOLD = "#fff8e6"

type Entity = { x: number; y: number; w: number; h: number; alive: boolean }
type Bullet = { x: number; y: number; vy: number }

type GameState = {
  player: Entity
  invaders: Entity[]
  bullets: Bullet[]
  enemyBullets: Bullet[]
  dir: 1 | -1
  speed: number
  left: boolean
  right: boolean
  fire: boolean
  lastShot: number
  lastEnemyShot: number
  score: number
  lives: number
  over: boolean
  won: boolean
}

const W = 640
const H = 460

function makeInvaders(): Entity[] {
  const rows = 4
  const cols = 9
  const invaders: Entity[] = []
  const gapX = 56
  const gapY = 44
  const offsetX = (W - (cols - 1) * gapX) / 2
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      invaders.push({ x: offsetX + c * gapX, y: 60 + r * gapY, w: 30, h: 22, alive: true })
    }
  }
  return invaders
}

function freshState(): GameState {
  return {
    player: { x: W / 2, y: H - 36, w: 42, h: 18, alive: true },
    invaders: makeInvaders(),
    bullets: [],
    enemyBullets: [],
    dir: 1,
    speed: 0.5,
    left: false,
    right: false,
    fire: false,
    lastShot: 0,
    lastEnemyShot: 0,
    score: 0,
    lives: 3,
    over: false,
    won: false,
  }
}

export function SpaceInvaders() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef<GameState>(freshState())
  const rafRef = useRef<number | null>(null)
  const [hud, setHud] = useState({ score: 0, lives: 3, over: false, won: false, started: false })

  const setInput = useCallback((key: "left" | "right" | "fire", value: boolean) => {
    stateRef.current[key] = value
  }, [])

  const reset = useCallback(() => {
    stateRef.current = freshState()
    setHud({ score: 0, lives: 3, over: false, won: false, started: true })
  }, [])

  useEffect(() => {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === "arrowleft" || k === "a") { setInput("left", down); e.preventDefault() }
      else if (k === "arrowright" || k === "d") { setInput("right", down); e.preventDefault() }
      else if (k === " " || k === "spacebar") { setInput("fire", down); e.preventDefault() }
    }
    const dn = onKey(true)
    const up = onKey(false)
    window.addEventListener("keydown", dn)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", dn)
      window.removeEventListener("keyup", up)
    }
  }, [setInput])

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

      if (!s.over && !s.won) {
        // player movement
        const pv = 0.42 * dt
        if (s.left) s.player.x = Math.max(s.player.w / 2, s.player.x - pv)
        if (s.right) s.player.x = Math.min(W - s.player.w / 2, s.player.x + pv)
        // player fire
        if (s.fire && t - s.lastShot > 320) {
          s.bullets.push({ x: s.player.x, y: s.player.y - 12, vy: -0.7 })
          s.lastShot = t
        }
        // invader block movement
        let minX = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        const liveInv = s.invaders.filter((i) => i.alive)
        for (const i of liveInv) { minX = Math.min(minX, i.x); maxX = Math.max(maxX, i.x + i.w); maxY = Math.max(maxY, i.y + i.h) }
        const step = (s.speed + (s.invaders.length - liveInv.length) * 0.02) * dt * 0.08
        let drop = false
        if (s.dir === 1 && maxX + step >= W - 8) drop = true
        if (s.dir === -1 && minX - step <= 8) drop = true
        for (const i of liveInv) {
          if (drop) { i.y += 16 } else { i.x += s.dir * step }
        }
        if (drop) s.dir = (s.dir === 1 ? -1 : 1)
        // enemy fire
        if (liveInv.length && t - s.lastEnemyShot > 700) {
          const shooter = liveInv[Math.floor((t / 97) % liveInv.length)]
          s.enemyBullets.push({ x: shooter.x + shooter.w / 2, y: shooter.y + shooter.h, vy: 0.4 })
          s.lastEnemyShot = t
        }
        // bullets
        s.bullets.forEach((b) => { b.y += b.vy * dt })
        s.enemyBullets.forEach((b) => { b.y += b.vy * dt })
        s.bullets = s.bullets.filter((b) => b.y > -10)
        s.enemyBullets = s.enemyBullets.filter((b) => b.y < H + 10)
        // collisions: player bullets vs invaders
        for (const b of s.bullets) {
          for (const i of liveInv) {
            if (i.alive && b.x > i.x && b.x < i.x + i.w && b.y > i.y && b.y < i.y + i.h) {
              i.alive = false
              b.y = -100
              s.score += 10
            }
          }
        }
        // enemy bullets vs player
        for (const b of s.enemyBullets) {
          if (b.x > s.player.x - s.player.w / 2 && b.x < s.player.x + s.player.w / 2 && b.y > s.player.y - s.player.h / 2 && b.y < s.player.y + s.player.h / 2) {
            b.y = H + 100
            s.lives -= 1
            if (s.lives <= 0) s.over = true
          }
        }
        // win / lose conditions
        if (liveInv.length === 0) s.won = true
        if (maxY >= s.player.y - 6 && liveInv.length) s.over = true
        if (hud.score !== s.score || hud.lives !== s.lives || hud.over !== s.over || hud.won !== s.won) {
          setHud({ score: s.score, lives: s.lives, over: s.over, won: s.won, started: true })
        }
      }

      // ---- render (transparent canvas; waves show through) ----
      ctx.clearRect(0, 0, W, H)
      // invaders
      ctx.fillStyle = CREAM
      for (const i of s.invaders) {
        if (!i.alive) continue
        ctx.globalAlpha = 0.92
        ctx.fillRect(i.x, i.y, i.w, i.h)
        ctx.fillStyle = "#070706"
        ctx.fillRect(i.x + 6, i.y + 7, 5, 5)
        ctx.fillRect(i.x + i.w - 11, i.y + 7, 5, 5)
        ctx.fillStyle = CREAM
      }
      ctx.globalAlpha = 1
      // player ship (red)
      ctx.fillStyle = RED
      ctx.beginPath()
      ctx.moveTo(s.player.x, s.player.y - s.player.h / 2)
      ctx.lineTo(s.player.x + s.player.w / 2, s.player.y + s.player.h / 2)
      ctx.lineTo(s.player.x - s.player.w / 2, s.player.y + s.player.h / 2)
      ctx.closePath()
      ctx.fill()
      // bullets
      ctx.fillStyle = GOLD
      for (const b of s.bullets) ctx.fillRect(b.x - 1.5, b.y - 8, 3, 12)
      ctx.fillStyle = RED
      for (const b of s.enemyBullets) ctx.fillRect(b.x - 1.5, b.y, 3, 11)

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [hud.score, hud.lives, hud.over, hud.won])

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-[#f4efe2]/70">
        <span className="text-[#df2f2f]">Score {hud.score}</span>
        <span>Lives {"▮".repeat(Math.max(0, hud.lives))}</span>
      </div>
      <div className="relative overflow-hidden border border-[#f4efe2]/14 bg-[#050504]/30">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block h-auto w-full touch-none"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
        {(!hud.started || hud.over || hud.won) && (
          <div className="absolute inset-0 grid place-items-center bg-[#070706]/70 backdrop-blur-[1px]">
            <div className="grid gap-3 text-center">
              <h3 className="iw-serif text-4xl text-[#fff8e6] sm:text-5xl">
                {hud.won ? "You held the line." : hud.over ? "Game over" : "Invaders"}
              </h3>
              {(hud.over || hud.won) && <p className="text-sm text-[#f4efe2]/70">Score {hud.score}</p>}
              <button
                type="button"
                onClick={reset}
                className="iw-serif mx-auto bg-[#df2f2f] px-5 py-2 text-lg text-[#fff8e6] transition hover:bg-[#df2f2f]/85"
              >
                {hud.started && (hud.over || hud.won) ? "Play again" : "Start"}
              </button>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#f4efe2]/40">← → move · Space fire</p>
            </div>
          </div>
        )}
      </div>
      {/* Mobile touch controls */}
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div className="flex gap-2">
          <TouchBtn label="◄" onDown={() => setInput("left", true)} onUp={() => setInput("left", false)} />
          <TouchBtn label="►" onDown={() => setInput("right", true)} onUp={() => setInput("right", false)} />
        </div>
        <TouchBtn label="FIRE" wide onDown={() => setInput("fire", true)} onUp={() => setInput("fire", false)} />
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
        wide ? "flex-1 px-8 text-[#df2f2f]" : "w-14",
      )}
    >
      {label}
    </button>
  )
}
