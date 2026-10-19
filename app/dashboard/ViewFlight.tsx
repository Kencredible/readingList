'use client'
import { useLayoutEffect, useRef } from 'react'
import { Book, colorFor } from './bookUtils'

// Animates books between the carousel and the grid. Each book visible in the old view gets a
// stand-in that flies from its old spot to its new one, crossfading between spine and cover.
// Positions come from `data-fly-id` elements: spines/covers in the carousel, covers in the grid.

export type View = 'carousel' | 'grid'

const DURATION = 720
const STAGGER  = 26
const MAX_DELAY = 420
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

type Box = { left: number; top: number; width: number; height: number }

const isSpine = (r: Box) => r.width / r.height < 0.4
const box = (r: DOMRect | Box): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height })
const centre = (r: Box) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

/** Viewport rects of every visible `data-fly-id` element under `root`. */
export function measureBooks(root: ParentNode = document): Map<number, Box> {
  const out = new Map<number, Box>()
  root.querySelectorAll<HTMLElement>('[data-fly-id]').forEach(el => {
    const r = el.getBoundingClientRect()
    if (r.width > 1 && r.bottom > -40 && r.top < window.innerHeight + 40) out.set(Number(el.dataset.flyId), box(r))
  })
  return out
}

function makeStandIn(b: Book, at: Box) {
  const color = colorFor(b.title)
  const el = document.createElement('div')
  el.className = 'vf-book'
  Object.assign(el.style, { left: `${at.left}px`, top: `${at.top}px`, width: `${at.width}px`, height: `${at.height}px` })

  const spine = document.createElement('div')
  spine.className = 'vf-spine'
  spine.style.background = `linear-gradient(90deg, rgba(0,0,0,0.38), rgba(255,255,255,0.08) 28%, rgba(255,255,255,0) 52%, rgba(0,0,0,0.32)), ${color}`
  const st = document.createElement('span')
  st.textContent = b.title
  spine.appendChild(st)

  const cover = document.createElement('div')
  cover.className = 'vf-cover'
  if (b.cover_url) {
    const img = document.createElement('img')
    img.src = b.cover_url
    img.alt = ''
    cover.appendChild(img)
  } else {
    cover.style.background = `linear-gradient(160deg, rgba(255,255,255,0.08), rgba(0,0,0,0.25)), ${color}`
    const t = document.createElement('span')
    t.textContent = b.title
    cover.appendChild(t)
  }

  el.append(cover, spine)
  return { el, spine, cover }
}

export default function ViewFlight({ books, from, to, targetRoot, onDone }: {
  books: Book[]
  from: Map<number, Box>     // where each book was in the old view (measured just before switching)
  to: View
  targetRoot: React.RefObject<HTMLElement | null>
  onDone: () => void
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useLayoutEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const byId = new Map(books.map(b => [b.id, b]))
    const standIns = new Map<number, ReturnType<typeof makeStandIn>>()

    // Put stand-ins over the old positions before the first paint, so nothing flickers
    from.forEach((r, id) => {
      const b = byId.get(id)
      if (!b) return
      const s = makeStandIn(b, r)
      s.spine.style.opacity = isSpine(r) ? '1' : '0'
      layer.appendChild(s.el)
      standIns.set(id, s)
    })

    let cancelled = false
    let raf2 = 0
    // Two frames: let the new view lay out (and the carousel measure its width) before reading targets
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => {
      if (cancelled) return
      const targets = measureBooks(targetRoot.current ?? document)
      const area = targetRoot.current?.getBoundingClientRect()
      const mid = area
        ? { x: area.left + area.width / 2, y: Math.max(0, area.top) + Math.min(area.height, window.innerHeight - Math.max(0, area.top)) / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 }

      const ids = [...new Set([...from.keys(), ...targets.keys()])].filter(id => byId.has(id))
      // Spreading into the grid goes row by row; lining up into the ring goes outward from the front
      ids.sort((a, b) => {
        const ta = targets.get(a), tb = targets.get(b)
        if (!ta || !tb) return ta ? -1 : tb ? 1 : 0
        if (to === 'grid') return Math.round(ta.top - tb.top) || ta.left - tb.left
        return Math.abs(centre(ta).x - mid.x) - Math.abs(centre(tb).x - mid.x)
      })

      const anims: Animation[] = []
      ids.forEach((id, i) => {
        const f = from.get(id)
        const t = targets.get(id)
        let s = standIns.get(id)
        if (!s) {   // newly visible: grows in place
          s = makeStandIn(byId.get(id)!, t!)
          layer.appendChild(s.el)
        }
        const start: Box = f ?? { left: t!.left + t!.width * 0.3, top: t!.top + t!.height * 0.3, width: t!.width * 0.4, height: t!.height * 0.4 }
        const end: Box   = t ?? { left: mid.x - f!.width * 0.2, top: mid.y - f!.height * 0.2, width: f!.width * 0.4, height: f!.height * 0.4 }
        const spineStart = f ? isSpine(f) : isSpine(t!)
        const spineEnd   = t ? isSpine(t) : spineStart
        const timing: KeyframeAnimationOptions = { duration: DURATION, delay: Math.min(i * STAGGER, MAX_DELAY), easing: EASE, fill: 'both' }
        const lift = Math.min(60, Math.abs(end.top - start.top) * 0.25 + 18)   // slight arc

        anims.push(s.el.animate([
          { left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`, opacity: f ? 1 : 0 },
          { offset: 0.5, top: `${Math.min(start.top, end.top) - lift}px` },
          { left: `${end.left}px`, top: `${end.top}px`, width: `${end.width}px`, height: `${end.height}px`, opacity: t ? 1 : 0 },
        ], timing))
        anims.push(s.spine.animate([{ opacity: spineStart ? 1 : 0 }, { opacity: spineEnd ? 1 : 0 }], timing))
      })

      if (!anims.length) { doneRef.current(); return }
      Promise.all(anims.map(a => a.finished)).then(() => { if (!cancelled) doneRef.current() }, () => {})
    }) })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      layer.replaceChildren()
    }
    // Runs once per flight; the parent remounts this component for each switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <style>{`
        .vf-layer { position: fixed; inset: 0; pointer-events: none; z-index: 60; }
        .vf-book { position: fixed; border-radius: 4px; overflow: hidden; box-shadow: 0 10px 24px rgba(20,14,6,0.28); will-change: left, top, width, height; }
        .vf-cover, .vf-spine { position: absolute; inset: 0; }
        .vf-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .vf-cover > span {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 12%;
          text-align: center; font-family: 'Lora', serif; font-weight: 600; font-size: 13px; color: #FFFFFF;
        }
        .vf-spine { display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .vf-spine > span {
          writing-mode: vertical-rl; font-family: 'Lora', serif; font-weight: 600; font-size: 12px; color: #FFFFFF;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-height: 85%;
        }
      `}</style>
      <div ref={layerRef} className="vf-layer" aria-hidden />
    </>
  )
}
