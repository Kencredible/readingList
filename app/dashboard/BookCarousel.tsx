'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Book, colorFor, daysBetween, hashOf } from './bookUtils'

// Base dimensions (px) — scaled down on narrow screens
const SPINE_W  = 46
const COVER_W  = 176
const MAX_H    = 270
const GAP      = 14    // space between neighbouring spines
const MIN_R    = 380   // smallest ring radius, so a handful of books still forms an arc
const FRICTION = 0.92  // per-frame velocity decay while gliding
const PULL     = 170   // how far the opened book slides out of the ring
const RAISE    = 34    // how far the settled book's spine lifts before it is opened
const INFO_GAP = 40    // space between the open cover and its floating details

const STATUS: Record<Book['status'], { label: string; color: string; bg: string }> = {
  read:    { label: 'Finished',     color: 'var(--accent)', bg: 'var(--accent-light)' },
  reading: { label: 'Reading now',  color: 'var(--blue)',   bg: 'var(--blue-light)' },
  want:    { label: 'Want to read', color: 'var(--amber)',  bg: 'var(--amber-light)' },
}

const norm = (deg: number) => ((deg % 360) + 540) % 360 - 180   // → [-180, 180)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function fmtDate(d: string) {
  return new Date(d + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
function lastName(author: string) {
  const parts = author.trim().split(/\s+/)
  return parts[parts.length - 1]
}

export default function BookCarousel({ books, seekId, onEdit, onDelete }: {
  books: Book[]
  seekId?: number | null   // spin to this book when it changes (driven by the search box)
  onEdit: (b: Book) => void
  onDelete: (id: number) => void
}) {
  const [rot, setRot] = useState(0)
  const [activeId, setActiveId] = useState<number | null>(null)   // settled on: spine raised
  const [opened, setOpened] = useState(false)                       // clicked: turned to show its cover
  const [width, setWidth] = useState(900)

  const wrapRef   = useRef<HTMLDivElement>(null)
  const stageRef  = useRef<HTMLDivElement>(null)
  const rotRef    = useRef(0)
  const velRef    = useRef(0)
  const targetRef = useRef<number | null>(null)
  const rafRef    = useRef<number | null>(null)
  const settleRef = useRef<number | undefined>(undefined)
  const lastIdxRef = useRef(0)
  const dragRef   = useRef<{ x: number; rot: number; lastX: number; lastT: number; v: number; moved: boolean; idx: number | null } | null>(null)

  const wide   = width >= 700                     // details float beside the open book rather than below the ring
  const stageW = width
  const n      = books.length
  const k      = stageW < 520 ? 0.74 : 1
  const spineW = SPINE_W * k
  const coverW = COVER_W * k
  const maxH   = MAX_H * k
  const radius = Math.max(MIN_R * k, (n * (spineW + GAP)) / (2 * Math.PI))   // radius at the spines
  // Spines always sit shoulder to shoulder. A small library forms an open arc with ends;
  // once there are enough books to go all the way round, the ring wraps.
  const step   = Math.min(360 / n, ((spineW + GAP) / radius) * (180 / Math.PI))
  const wrap   = step * n >= 359.9
  const degPerPx = 180 / (Math.PI * radius)
  // With a single book there's nothing to browse: show it open and skip the ring controls
  const single = n === 1
  // Open book slides left so it and its details sit centred together
  const infoW  = clamp(stageW * 0.34, 220, 320)
  const shiftX = wide ? (infoW + INFO_GAP) / 2 : 0
  const coverScale = 1600 / (1600 - (PULL * k - coverW / 2 + spineW / 2))   // perspective enlargement of the open cover
  const infoLeft = stageW / 2 - shiftX + (coverW * coverScale) / 2 + INFO_GAP

  // Values the animation loop reads without re-binding
  const live = useRef({ step, books, wrap })
  live.current = { step, books, wrap }

  // Ring angle → book index (wraps on a full ring, clamps on an open arc)
  const indexAt = useCallback((r: number) => {
    const { step, books, wrap } = live.current
    const i = Math.round(r / step)
    return wrap ? ((i % books.length) + books.length) % books.length : clamp(i, 0, books.length - 1)
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const settle = useCallback((delay = 140) => {
    window.clearTimeout(settleRef.current)
    settleRef.current = window.setTimeout(() => {
      const { books } = live.current
      if (!books.length) return
      const idx = indexAt(rotRef.current)
      lastIdxRef.current = idx
      setActiveId(books[idx].id)
      if (books.length === 1) setOpened(true)
    }, delay)
  }, [indexAt])

  const tick = useCallback(() => {
    if (dragRef.current) { rafRef.current = null; return }
    const { step, books, wrap } = live.current
    let r = rotRef.current
    let done = false
    const outOfRange = !wrap && (r < 0 || r > (books.length - 1) * step)
    if (targetRef.current === null && !outOfRange && Math.abs(velRef.current) > step * 0.015) {
      r += velRef.current
      velRef.current *= FRICTION
    } else {
      velRef.current = 0
      if (targetRef.current === null) targetRef.current = (wrap ? Math.round(r / step) : indexAt(r)) * step
      const d = targetRef.current - r
      if (Math.abs(d) < 0.02) { r = targetRef.current; done = true }
      else r += d * 0.16
    }
    rotRef.current = r
    setRot(r)
    if (done) { rafRef.current = null; targetRef.current = null; settle() }
    else rafRef.current = requestAnimationFrame(tick)
  }, [settle, indexAt])

  const kick = useCallback(() => {
    window.clearTimeout(settleRef.current)
    setActiveId(null)
    setOpened(false)
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const goTo = useCallback((i: number) => {
    const { step, books, wrap } = live.current
    targetRef.current = wrap
      ? rotRef.current + norm(i * step - rotRef.current)
      : clamp(i, 0, books.length - 1) * step
    velRef.current = 0
    kick()
  }, [kick])

  // Keep the current book in place when the list changes (filter, sort, add, delete)
  const idsKey = books.map(b => b.id).join(',')
  const prevActive = useRef<number | null>(null)
  prevActive.current = activeId ?? prevActive.current
  useEffect(() => {
    if (!n) return
    let idx = books.findIndex(b => b.id === prevActive.current)
    if (idx < 0) idx = Math.min(lastIdxRef.current, n - 1)
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    velRef.current = 0
    targetRef.current = null
    rotRef.current = idx * (360 / n)
    setRot(rotRef.current)
    setActiveId(null)
    setOpened(false)
    settle(n === 1 ? 0 : 450)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  useEffect(() => {
    if (seekId == null) return
    const idx = books.findIndex(b => b.id === seekId)
    if (idx >= 0 && !(idx === indexAt(rotRef.current) && activeId === seekId)) goTo(idx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekId])

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    window.clearTimeout(settleRef.current)
  }, [])

  // Wheel / trackpad — needs a non-passive listener so the page doesn't scroll underneath
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (live.current.books.length === 1) return   // nothing to spin; let the page scroll
      e.preventDefault()
      const { step } = live.current
      const d  = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      const px = e.deltaMode === 1 ? d * 33 : d
      targetRef.current = null
      // One ~100px wheel notch glides roughly one book
      velRef.current = clamp(velRef.current + (px / 100) * step * (1 - FRICTION), -step * 0.9, step * 0.9)
      kick()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [kick])

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || single) return
    const hit = (e.target as HTMLElement).closest('[data-index]')
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    velRef.current = 0
    targetRef.current = null
    dragRef.current = { x: e.clientX, rot: rotRef.current, lastX: e.clientX, lastT: performance.now(), v: 0, moved: false, idx: hit ? Number(hit.getAttribute('data-index')) : null }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > 4) {
      d.moved = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      window.clearTimeout(settleRef.current)
      setActiveId(null)
      setOpened(false)
    }
    if (!d.moved) return
    const now = performance.now()
    const frames = Math.max(1, (now - d.lastT) / 16.67)
    d.v = (-(e.clientX - d.lastX) * degPerPx) / frames
    d.lastX = e.clientX
    d.lastT = now
    let r = d.rot - dx * degPerPx
    const max = (n - 1) * step
    if (!wrap && r < 0) r *= 0.3                     // rubber-band past the ends of an open arc
    if (!wrap && r > max) r = max + (r - max) * 0.3
    rotRef.current = r
    setRot(r)
  }

  function onPointerUp() {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (d.moved) {
      velRef.current = performance.now() - d.lastT > 80 ? 0 : clamp(d.v, -step * 0.9, step * 0.9)
      kick()
    } else if (opened) {
      // Any click on the ring puts an open book back. (Chrome doesn't reliably hit-test the
      // turned cover, so a click can land on the stage or a spine behind it.)
      setOpened(false)
    } else if (d.idx !== null && books[d.idx]?.id === activeId) {
      setOpened(true)
    } else if (d.idx !== null) {
      goTo(d.idx)
    } else if (activeId === null) {
      kick()   // resume a snap that the press interrupted
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (single) return
    const cur = Math.round((targetRef.current ?? rotRef.current) / step)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(cur + 1) }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); goTo(cur - 1) }
    if ((e.key === 'Enter' || e.key === ' ') && activeId !== null) { e.preventDefault(); setOpened(o => !o) }
    if (e.key === 'Escape' && opened) setOpened(false)
  }

  const active = books.find(b => b.id === activeId) ?? null
  // The book at the front of the ring right now, highlighted even mid-spin so you can see where it will stop
  const nearIdx = active ? books.indexOf(active) : indexAt(rot)
  const near = books[nearIdx]

  return (
    <div className="bc-wrap" ref={wrapRef}>
      <style>{`
        .bc-wrap { position: relative; margin-top: 0.5rem; }
        .bc-stage {
          position: relative; overflow: hidden; outline: none; touch-action: pan-y;
          perspective: 1600px; perspective-origin: 50% 32%; cursor: grab; user-select: none;
          border-radius: 20px;
          background: radial-gradient(ellipse 70% 55% at 50% 100%, var(--surface2), transparent 70%);
        }
        .bc-stage:active { cursor: grabbing; }
        .bc-stage:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
        .bc-floor {
          position: absolute; left: 50%; bottom: 6%; width: 78%; height: 40px; transform: translateX(-50%);
          background: radial-gradient(ellipse at center, rgba(40,28,10,0.22), transparent 70%); pointer-events: none;
        }
        .bc-scene { position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform-style: preserve-3d; }
        .bc-book {
          position: absolute; left: 0; top: 0; transform-style: preserve-3d;
          transition: transform 0.75s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .bc-face {
          position: absolute; left: 0; top: 0; backface-visibility: hidden;
          opacity: var(--fade, 1);
        }
        /* While a book is open the rest of the ring fades back so its details stay readable in either theme */
        .bc-scene.focus .bc-book:not(.on) .bc-face { opacity: calc(var(--fade, 1) * 0.14); transition: opacity 0.45s ease; }
        .bc-book.near .bc-spine {
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.18), 0 0 0 2px rgba(240,205,130,0.85), 0 0 18px rgba(240,205,130,0.35);
        }
        .bc-book.on:not(.open) .bc-spine {
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.18), 0 0 0 2px rgba(240,205,130,0.85), 0 18px 26px rgba(0,0,0,0.35);
        }
        .bc-marker {
          position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); pointer-events: none;
          width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent;
          border-bottom: 9px solid rgba(240,205,130,0.85); transition: opacity 0.3s;
        }
        .bc-stage.is-open .bc-marker { opacity: 0; }
        .bc-stage.single, .bc-stage.single .bc-spine { cursor: default; }
        .bc-stage.is-open { cursor: pointer; }

        .bc-spine {
          display: flex; flex-direction: column; align-items: center; justify-content: space-between;
          padding: 14px 0 12px; border-radius: 3px 3px 2px 2px; cursor: pointer; overflow: hidden;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.18);
        }
        .bc-spine::before, .bc-spine::after {
          content: ''; position: absolute; left: 5px; right: 5px; height: 2px;
          background: rgba(240,205,130,0.55); box-shadow: 0 4px 0 rgba(240,205,130,0.35);
        }
        .bc-spine::before { top: 7px; }
        .bc-spine::after  { bottom: 11px; }
        .bc-spine-title {
          writing-mode: vertical-rl; font-family: 'Lora', serif; font-weight: 600; color: rgba(255,250,240,0.95);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-height: 0;
          letter-spacing: 0.02em; text-shadow: 0 1px 1px rgba(0,0,0,0.35); padding: 6px 0;
        }
        .bc-spine-author {
          writing-mode: vertical-rl; font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em;
          color: rgba(255,245,225,0.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-height: 34%;
        }
        .bc-spine-mark { font-size: 8px; line-height: 1; color: #F5C842; letter-spacing: -1px; height: 10px; white-space: nowrap; }
        .bc-spine-dot { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 0 2px rgba(255,255,255,0.25); }

        .bc-cover { border-radius: 2px 6px 6px 2px; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15); }
        .bc-cover img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
        .bc-cover::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(90deg, rgba(0,0,0,0.38) 0%, rgba(255,255,255,0.14) 3%, transparent 8%),
                      linear-gradient(115deg, rgba(255,255,255,0.18) 0%, transparent 38%);
        }
        .bc-cover-fb {
          width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between;
          padding: 18% 12% 14%; text-align: center; color: rgba(255,250,240,0.95);
        }
        .bc-cover-fb-inner { border: 1px solid rgba(240,205,130,0.5); position: absolute; inset: 8px; pointer-events: none; }
        .bc-cover-fb-title { font-family: 'Lora', serif; font-weight: 600; line-height: 1.2; }
        .bc-cover-fb-author { font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; opacity: 0.8; }
        .bc-back { border-radius: 6px 2px 2px 6px; }
        .bc-top {
          background: repeating-linear-gradient(90deg, #F4EBD9 0 2px, #E6DAC2 2px 3px);
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
        }

        .bc-info-pos { position: absolute; top: 46%; transform: translateY(-50%); z-index: 5; cursor: default; }
        .bc-info {
          animation: bcPanelIn 0.5s 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
          text-shadow: 0 1px 10px var(--bg);
        }
        .bc-info.stacked { max-width: 520px; margin: 1rem auto 0; padding: 0 0.5rem; text-align: center; animation-name: bcPanelUp; }
        .bc-info.stacked .bc-stars, .bc-info.stacked .bc-actions { justify-content: center; }
        .bc-info.stacked .bc-meta { text-align: left; }
        @keyframes bcPanelIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
        @keyframes bcPanelUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .bc-chip { display: inline-block; font-size: 11px; font-weight: 500; padding: 3px 10px; border-radius: 20px; margin-bottom: 10px; text-shadow: none; }
        .bc-title { font-family: 'Lora', serif; font-size: 26px; font-weight: 600; line-height: 1.25; color: var(--text); }
        .bc-author { font-size: 14px; color: var(--text2); margin-top: 3px; }
        .bc-stars { display: flex; gap: 4px; margin: 14px 0 4px; font-size: 24px; line-height: 1; }
        .bc-star { color: var(--border2); animation: bcStar 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .bc-star.f { color: #E8B923; }
        @keyframes bcStar { from { opacity: 0; transform: scale(0.3) rotate(-30deg); } to { opacity: 1; transform: none; } }
        .bc-unrated { font-size: 13px; color: var(--text3); margin: 14px 0 4px; }
        .bc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-top: 14px; }
        .bc-meta-l { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text3); margin-bottom: 2px; }
        .bc-meta-v { font-size: 13px; color: var(--text); }
        .bc-notes {
          margin-top: 14px; padding: 2px 0 2px 12px; border-left: 3px solid var(--accent); text-align: left;
          font-family: 'Lora', serif; font-style: italic; font-size: 13px;
          color: var(--text2); line-height: 1.5; max-height: 110px; overflow-y: auto; white-space: pre-wrap;
        }
        .bc-actions { display: flex; gap: 8px; margin-top: 16px; }
        .bc-btn { text-shadow: none; border-radius: 10px; padding: 8px 16px; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .bc-btn.edit { background: var(--accent); color: white; border: none; font-weight: 500; }
        .bc-btn.del { background: var(--bg); color: var(--text3); border: 1px solid var(--border2); }
        .bc-btn.del:hover { color: var(--red); border-color: var(--red); }

        .bc-foot { display: flex; justify-content: center; align-items: center; gap: 14px; margin-top: 10px; font-size: 12px; color: var(--text3); }
        .bc-arrow {
          width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border2); background: var(--surface);
          color: var(--text2); cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;
        }
        .bc-arrow:hover { border-color: var(--accent); color: var(--accent); }
        .bc-now { min-width: 0; max-width: min(320px, 60vw); text-align: center; }
        .bc-now-title { font-family: 'Lora', serif; font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bc-now-sub { font-size: 11px; color: var(--text3); margin-top: 1px; font-variant-numeric: tabular-nums; }

        @media (prefers-reduced-motion: reduce) {
          .bc-book { transition-duration: 0.01s; }
          .bc-info, .bc-star { animation-duration: 0.01s; animation-delay: 0s; }
        }
      `}</style>

      <div
        ref={stageRef}
        className={`bc-stage${opened ? ' is-open' : ''}${single ? ' single' : ''}`}
        style={{ height: maxH + 190 * k }}
        tabIndex={0}
        role="listbox"
        aria-label="Your books. Use the arrow keys to browse."
        aria-activedescendant={active ? `bc-book-${active.id}` : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div className="bc-floor" />
        {!single && <div className="bc-marker" />}
        <div className={`bc-scene${active && opened ? ' focus' : ''}`} style={{ transform: `translateZ(${-radius}px) rotateY(${-rot}deg)` }}>
          {books.map((b, i) => {
            const angle = i * step
            const rel   = norm(angle - rot)
            const x     = radius * Math.sin((rel * Math.PI) / 180)
            const on    = b.id === activeId
            const open  = on && opened
            const isNear = i === nearIdx && !open
            if (!on && (Math.abs(rel) > 96 || Math.abs(x) > stageW / 2 + spineW * 2)) return null

            const h     = maxH * (0.86 + (hashOf(b.author + b.title) % 15) / 100)
            const color = colorFor(b.title)
            const fade  = clamp(1 - (Math.abs(rel) - 55) / 41, 0, 1)
            const r0    = radius - coverW / 2          // book centre sits half a cover behind its spine
            const lift  = (maxH - h) / 2                // align all bottoms on the same shelf line
            const transform =
              `rotateY(${angle}deg) translateZ(${r0}px) translateY(${lift}px) ` +
              `translate3d(${open ? -shiftX : 0}px, ${(open ? -18 : on ? -RAISE : 0) * k}px, ${(open ? PULL : on ? 26 : 0) * k}px) rotateY(${open ? -90 : 0}deg)`

            const face = (w: number, hh: number, t: string): React.CSSProperties =>
              ({ width: w, height: hh, marginLeft: -w / 2, marginTop: -hh / 2, transform: t })

            return (
              <div
                key={b.id}
                id={`bc-book-${b.id}`}
                role="option"
                aria-selected={on}
                aria-expanded={on ? opened : undefined}
                aria-label={`${b.title} by ${b.author}`}
                className={`bc-book${on ? ' on' : ''}${open ? ' open' : ''}${isNear ? ' near' : ''}`}
                style={{ transform, ['--fade' as string]: on ? 1 : fade } as React.CSSProperties}
              >
                {/* Spine — faces outward from the ring */}
                <div
                  className="bc-face bc-spine"
                  data-index={i}
                  style={{
                    ...face(spineW, h, `translateZ(${coverW / 2}px)`),
                    background: `linear-gradient(90deg, rgba(0,0,0,0.38), rgba(255,255,255,0.14) 28%, rgba(255,255,255,0) 52%, rgba(0,0,0,0.32)), ${color}`,
                  }}
                >
                  {b.status === 'read' && b.rating
                    ? <span className="bc-spine-mark">{'★'.repeat(b.rating)}</span>
                    : <span className="bc-spine-dot" style={{ background: b.status === 'reading' ? '#7FA8F0' : b.status === 'want' ? '#F0B860' : 'rgba(255,255,255,0.4)' }} />}
                  <span className="bc-spine-title" style={{ fontSize: Math.round(13 * k) }}>{b.title}</span>
                  <span className="bc-spine-author">{lastName(b.author)}</span>
                </div>

                {/* Front cover — on the right-hand side, revealed by the -90° turn */}
                <div className="bc-face bc-cover" data-index={i} style={face(coverW, h, `rotateY(90deg) translateZ(${spineW / 2}px)`)}>
                  {b.cover_url
                    ? <img src={b.cover_url} alt="" draggable={false} />
                    : (
                      <div className="bc-cover-fb" style={{ background: `linear-gradient(160deg, rgba(255,255,255,0.12), rgba(0,0,0,0.25)), ${color}` }}>
                        <div className="bc-cover-fb-inner" />
                        <div className="bc-cover-fb-title" style={{ fontSize: Math.round(17 * k) }}>{b.title}</div>
                        <div className="bc-cover-fb-author">{b.author}</div>
                      </div>
                    )}
                </div>

                {/* Back cover */}
                <div className="bc-face bc-back" style={{ ...face(coverW, h, `rotateY(-90deg) translateZ(${spineW / 2}px)`), background: `linear-gradient(200deg, rgba(0,0,0,0.1), rgba(0,0,0,0.35)), ${color}` }} />

                {/* Page block, seen from above */}
                <div className="bc-face bc-top" style={face(spineW - 4, coverW - 6, `rotateX(90deg) translateZ(${h / 2}px)`)} />
              </div>
            )
          })}
        </div>

        {active && opened && wide && (
          <div className="bc-info-pos" style={{ left: infoLeft, width: Math.min(infoW, stageW - infoLeft - 12) }} onPointerDown={e => e.stopPropagation()}>
            <BookInfo key={active.id} book={active} onEdit={onEdit} onDelete={onDelete} />
          </div>
        )}
      </div>

      {active && opened && !wide && <BookInfo key={active.id} book={active} onEdit={onEdit} onDelete={onDelete} stacked />}

      {!single && <div className="bc-foot">
        <button className="bc-arrow" aria-label="Previous book" onClick={() => goTo(Math.round((targetRef.current ?? rotRef.current) / step) - 1)}>‹</button>
        <div className="bc-now" aria-live="polite">
          <div className="bc-now-title">{near?.title}</div>
          <div className="bc-now-sub">
            {nearIdx + 1} / {n} · {opened ? 'click the ring to put it back' : active ? 'click the book to open it' : 'scroll, drag or use ← →'}
          </div>
        </div>
        <button className="bc-arrow" aria-label="Next book" onClick={() => goTo(Math.round((targetRef.current ?? rotRef.current) / step) + 1)}>›</button>
      </div>}
    </div>
  )
}

function BookInfo({ book: b, onEdit, onDelete, stacked }: {
  book: Book
  onEdit: (b: Book) => void
  onDelete: (id: number) => void
  stacked?: boolean
}) {
  const st = STATUS[b.status]
  const meta: [string, string][] = []
  if (b.genre) meta.push(['Genre', b.genre])
  if (b.start_date) meta.push(['Started', fmtDate(b.start_date)])
  if (b.end_date) meta.push(['Finished', fmtDate(b.end_date)])
  if (b.status === 'read' && b.start_date && b.end_date) {
    const d = daysBetween(b.start_date, b.end_date)
    meta.push(['Read in', `${d} day${d !== 1 ? 's' : ''}`])
  } else if (b.status === 'reading' && b.start_date) {
    meta.push(['Progress', `Day ${daysBetween(b.start_date)}`])
  }

  return (
    <div className={`bc-info${stacked ? ' stacked' : ''}`}>
      <span className="bc-chip" style={{ color: st.color, background: st.bg }}>{st.label}</span>
      <div className="bc-title">{b.title}</div>
      <div className="bc-author">by {b.author}</div>

      {b.rating ? (
        <div className="bc-stars" aria-label={`Rated ${b.rating} out of 5`}>
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className={`bc-star${n <= b.rating! ? ' f' : ''}`} style={{ animationDelay: `${0.5 + n * 0.07}s` }}>★</span>
          ))}
        </div>
      ) : (
        <div className="bc-unrated">{b.status === 'read' ? 'Not rated yet' : b.status === 'reading' ? 'Rate it when you finish' : 'On your wishlist'}</div>
      )}

      {meta.length > 0 && (
        <div className="bc-meta">
          {meta.map(([l, v]) => (
            <div key={l}><div className="bc-meta-l">{l}</div><div className="bc-meta-v">{v}</div></div>
          ))}
        </div>
      )}

      {b.notes && <div className="bc-notes">{b.notes}</div>}

      <div className="bc-actions">
        <button className="bc-btn edit" onClick={() => onEdit(b)}>✎ Edit</button>
        <button className="bc-btn del" onClick={() => onDelete(b.id)}>Remove</button>
      </div>
    </div>
  )
}
