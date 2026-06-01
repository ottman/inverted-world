"use client"

import { cn } from "@/lib/utils"

// A serif category navigation in the same understated style as the main header nav (Tales /
// Breaking News): plain text links, muted by default, red on hover/active, with an optional tiny
// count. Modern and non-invasive — no cards, boxes, or loud chips. Items can be filter buttons
// (onClick) or anchor links (href). Themed/secondary items get a subtle red accent.
export type CategoryNavItem = {
  key: string
  label: string
  count?: number
  active?: boolean
  accent?: boolean
  href?: string
  onClick?: () => void
}

export function CategoryNav({
  items,
  className,
  ariaLabel,
  scroll,
}: {
  items: CategoryNavItem[]
  className?: string
  ariaLabel?: string
  scroll?: boolean // single-line, side-to-side scroll (used for the mobile strip)
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "iw-serif flex items-baseline gap-x-5 gap-y-1.5 text-lg font-normal tracking-normal sm:text-xl",
        scroll
          ? "flex-nowrap overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex-wrap leading-tight",
        className,
      )}
    >
      {items.map((item) => {
        const cls = cn(
          "whitespace-nowrap transition",
          item.active
            ? "text-[#df2f2f]"
            : item.accent
              ? "text-[#df2f2f]/70 hover:text-[#df2f2f]"
              : "text-[#f4efe2]/55 hover:text-[#fff8e6]",
        )
        const body = (
          <>
            {item.label}
            {typeof item.count === "number" ? (
              <span className="ml-1 align-super font-sans text-[0.56em] tracking-normal text-[#f4efe2]/35">{item.count}</span>
            ) : null}
          </>
        )
        return item.href ? (
          <a key={item.key} href={item.href} className={cls}>
            {body}
          </a>
        ) : (
          <button key={item.key} type="button" onClick={item.onClick} aria-pressed={item.active} className={cls}>
            {body}
          </button>
        )
      })}
    </nav>
  )
}
