'use client'
import React, { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { Book, colorFor, daysBetween } from './bookUtils'

function fmtDate(d: string) {
  return new Date(d + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function Cover({ book: b, className }: { book: Book; className: string }) {
  const color = colorFor(b.title)
  return (
    <div className={className}>
      {b.cover_url
        ? <img src={b.cover_url} alt="" draggable={false} />
        : (
          <div className="hof-fallback" style={{ background: `linear-gradient(160deg, rgba(255,255,255,0.08), rgba(0,0,0,0.25)), ${color}` }}>
            <span className="hof-fallback-title">{b.title}</span>
            <span className="hof-fallback-author">{b.author}</span>
          </div>
        )}
    </div>
  )
}

/** Hall of Fame: one featured 5-star book (big cover, details, title as a giant backdrop) picked from a strip of covers. */
export default function HallOfFame({ books }: { books: Book[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(books[0]?.id ?? null)
  const stripRef = useRef<HTMLDivElement>(null)

  // Keep the selection valid when the list changes (search, edits)
  const idx = Math.max(0, books.findIndex(b => b.id === selectedId))
  const book = books[idx]
  useEffect(() => {
    if (book && book.id !== selectedId) setSelectedId(book.id)
  }, [book, selectedId])

  // Giant title behind the panel: the old one drifts up and out while the new one rises in
  const [ghost, setGhost] = useState<{ cur?: string; prev?: string; key: number }>({ cur: book?.title, key: 0 })
  useEffect(() => {
    if (!book || book.title === ghost.cur) return
    setGhost(g => ({ cur: book.title, prev: g.cur, key: g.key + 1 }))
    const t = window.setTimeout(() => setGhost(g => ({ ...g, prev: undefined })), 700)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.title])

  // Keep the selected cover in view in the strip
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [idx])

  if (!book) return null
  const go = (d: number) => setSelectedId(books[(idx + d + books.length) % books.length].id)
  const days = book.start_date && book.end_date ? daysBetween(book.start_date, book.end_date) : null
  const stats: [string, string, string?][] = [
    ['Read in', days ? `${days}` : '—', days ? `day${days !== 1 ? 's' : ''}` : 'no dates'],
    ['Started', book.start_date ? fmtDate(book.start_date) : '—'],
    ['Finished', book.end_date ? fmtDate(book.end_date) : '—'],
    ['Genre', book.genre || '—'],
  ]

  return (
    <div className="hof">
      <style>{`
        .hof-feature {
          position: relative; overflow: hidden; border-radius: 22px; background: var(--surface); border: 1px solid var(--border);
          box-shadow: 0 2px 12px rgba(40,28,10,0.08); padding: 28px; display: grid; gap: 36px;
          grid-template-columns: minmax(180px, 280px) minmax(0, 1fr); align-items: start;
        }
        /* Decorative title behind the panel. Its strength is capped per theme (--ghost) so every label on top keeps AA contrast */
        .hof-ghost { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .hof-ghost-text {
          position: absolute; top: -0.14em; right: -0.04em; white-space: nowrap; line-height: 1;
          font-family: 'Lora', serif; font-weight: 600; letter-spacing: -0.025em; font-size: clamp(110px, 15vw, 210px);
          color: color-mix(in srgb, var(--text) var(--ghost), transparent);
          animation: hofGhostIn 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .hof-ghost-text.out { animation: hofGhostOut 0.45s cubic-bezier(0.4, 0, 1, 1) both; }
        @keyframes hofGhostIn  { from { opacity: 0; transform: translateY(0.16em); } to { opacity: 1; transform: none; } }
        @keyframes hofGhostOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(-0.16em); } }

        .hof-cover-lg {
          position: relative; aspect-ratio: 2 / 3; width: 100%; border-radius: 10px; overflow: hidden;
          box-shadow: 0 18px 40px rgba(20,14,6,0.35); animation: hofCoverIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .hof-cover-lg img, .hof-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        @keyframes hofCoverIn { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
        .hof-fallback { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 18% 12% 14%; text-align: center; color: #FFFFFF; }
        .hof-fallback::before { content: ''; position: absolute; inset: 8px; border: 1px solid rgba(240,205,130,0.5); }
        .hof-fallback-title { font-family: 'Lora', serif; font-weight: 600; font-size: 22px; line-height: 1.2; }
        .hof-fallback-author { font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; opacity: 0.92; }

        .hof-details { position: relative; min-width: 0; animation: hofDetailsIn 0.5s 0.08s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes hofDetailsIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
        .hof-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
        .hof-eyebrow { font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text3); display: flex; gap: 12px; flex-wrap: wrap; }
        .hof-eyebrow b { color: var(--accent); font-weight: 600; }
        .hof-nav { display: flex; gap: 8px; flex-shrink: 0; }
        .hof-nav button {
          display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text2);
          border-radius: 20px; padding: 6px 14px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: border-color 0.15s, color 0.15s;
        }
        .hof-nav button:hover { border-color: var(--accent); color: var(--accent); }
        .hof-nav button svg { width: 10px; height: 10px; }
        .hof-title { font-family: 'Lora', serif; font-size: clamp(30px, 4vw, 46px); font-weight: 600; line-height: 1.08; color: var(--text); }
        .hof-author { font-size: 15px; color: var(--text2); margin-top: 6px; }
        .hof-stars { display: flex; gap: 5px; margin: 18px 0 22px; font-size: 26px; line-height: 1; color: var(--star); }
        .hof-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
        .hof-stat { background: var(--surface2); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
        .hof-stat-l { font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text3); margin-bottom: 6px; }
        .hof-stat-v { font-family: 'Lora', serif; font-size: 22px; font-weight: 600; color: var(--text); line-height: 1.15; overflow-wrap: anywhere; }
        .hof-stat-s { font-size: 12px; color: var(--text3); margin-top: 3px; }
        .hof-notes {
          margin-top: 18px; padding: 2px 0 2px 14px; border-left: 3px solid var(--accent); font-family: 'Lora', serif; font-style: italic;
          font-size: 14px; line-height: 1.55; color: var(--text2); white-space: pre-wrap; max-width: 60ch;
        }

        .hof-strip { display: flex; gap: 12px; overflow-x: auto; padding: 18px 4px 10px; margin-top: 6px; scroll-padding: 0 12px; }
        .hof-thumb {
          position: relative; flex: 0 0 auto; width: 84px; aspect-ratio: 2 / 3; border-radius: 8px; overflow: hidden; padding: 0; cursor: pointer;
          border: 1px solid var(--border); background: var(--surface2); box-shadow: 0 2px 8px rgba(20,14,6,0.12);
          transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s, opacity 0.2s; opacity: 0.85;
        }
        .hof-thumb:hover { transform: translateY(-3px); opacity: 1; }
        .hof-thumb[aria-pressed="true"] { transform: translateY(-6px); opacity: 1; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--focus), 0 10px 20px rgba(20,14,6,0.25); }
        .hof-thumb-art { position: absolute; inset: 0; }
        .hof-thumb .hof-fallback { padding: 14% 8%; }
        .hof-thumb .hof-fallback::before { inset: 4px; }
        .hof-thumb .hof-fallback-title { font-size: 10px; }
        .hof-thumb .hof-fallback-author { display: none; }

        @media (max-width: 768px) {
          .hof-feature { grid-template-columns: 1fr; padding: 20px; gap: 22px; }
          .hof-cover-lg { max-width: 220px; margin: 0 auto; }
          .hof-ghost-text { font-size: 96px; }
          .hof-top { flex-wrap: wrap; }
          .hof-stats { grid-template-columns: 1fr 1fr; gap: 10px; }
          .hof-stat-v { font-size: 18px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hof-ghost-text, .hof-cover-lg, .hof-details { animation-duration: 0.01s !important; animation-delay: 0s !important; }
        }
      `}</style>

      <section className="hof-feature" aria-labelledby="hof-title">
        <div className="hof-ghost" aria-hidden>
          {ghost.prev && <span key={`p${ghost.key}`} className="hof-ghost-text out">{ghost.prev}</span>}
          {ghost.cur && <span key={`c${ghost.key}`} className="hof-ghost-text">{ghost.cur}</span>}
        </div>

        <Cover key={`cover-${book.id}`} book={book} className="hof-cover-lg" />

        <div className="hof-details" key={`details-${book.id}`}>
          <div className="hof-top">
            <div className="hof-eyebrow">
              <span><b>{String(idx + 1).padStart(2, '0')}</b> / {String(books.length).padStart(2, '0')}</span>
              {book.end_date && <span>Finished {fmtDate(book.end_date)}</span>}
            </div>
            {books.length > 1 && (
              <div className="hof-nav">
                <button type="button" onClick={() => go(-1)} aria-label="Previous book"><FontAwesomeIcon icon={faChevronLeft} /> Prev</button>
                <button type="button" onClick={() => go(1)} aria-label="Next book">Next <FontAwesomeIcon icon={faChevronRight} /></button>
              </div>
            )}
          </div>
          <h3 id="hof-title" className="hof-title">{book.title}</h3>
          <div className="hof-author">by {book.author}</div>
          <div className="hof-stars" role="img" aria-label="Rated 5 out of 5">★★★★★</div>
          <div className="hof-stats">
            {stats.map(([l, v, sub]) => (
              <div className="hof-stat" key={l}>
                <div className="hof-stat-l">{l}</div>
                <div className="hof-stat-v">{v}</div>
                {sub && <div className="hof-stat-s">{sub}</div>}
              </div>
            ))}
          </div>
          {book.notes && <p className="hof-notes">{book.notes}</p>}
        </div>
      </section>

      <div
        ref={stripRef}
        className="hof-strip"
        role="group"
        aria-label="Hall of Fame books"
        onKeyDown={e => {
          if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
        }}
      >
        {books.map(b => (
          <button
            key={b.id}
            type="button"
            className="hof-thumb"
            aria-pressed={b.id === book.id}
            aria-label={`${b.title} by ${b.author}`}
            tabIndex={b.id === book.id ? 0 : -1}
            onClick={() => setSelectedId(b.id)}
            ref={el => { if (el && b.id === book.id && stripRef.current?.contains(document.activeElement)) el.focus({ preventScroll: true }) }}
          >
            <Cover book={b} className="hof-thumb-art" />
          </button>
        ))}
      </div>
    </div>
  )
}
