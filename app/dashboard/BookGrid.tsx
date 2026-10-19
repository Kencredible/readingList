'use client'
import React from 'react'
import { Book, colorFor, daysBetween } from './bookUtils'

const BADGE: Record<Book['status'], { txt: string; color: string; bg: string }> = {
  read:    { txt: '✓ Read',    color: 'var(--accent)', bg: 'var(--accent-light)' },
  reading: { txt: '● Reading', color: 'var(--blue)',   bg: 'var(--blue-light)' },
  want:    { txt: '🔖 Want',   color: 'var(--amber)',  bg: 'var(--amber-light)' },
}

export default function BookGrid({ books, grouped, showBadges, editingId, onEdit, onDelete }: {
  books: Book[]
  grouped: boolean          // All tab: split into reading / finished / wishlist sections
  showBadges: boolean
  editingId: number | null   // highlights the card being edited
  onEdit: (b: Book) => void
  onDelete: (id: number) => void
}) {
  const groups: [string, Book[]][] = grouped
    ? [['Currently reading', books.filter(b => b.status === 'reading')], ['Finished', books.filter(b => b.status === 'read')], ['Want to read', books.filter(b => b.status === 'want')]]
    : [['', books]]

  let cardIndex = 0   // running index across groups, staggers the cards' entrance

  return (
    <>
      <style>{`
        .section-hd { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text3); margin: 1.5rem 0 0.75rem; }
        .book-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
        .book-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 2px 12px rgba(40,28,10,0.08); }
        .book-card.ed { outline: 2px solid var(--accent); }
        .book-cover { position: relative; width: 100%; padding-bottom: 140%; border-radius: 8px; overflow: hidden; background: var(--surface2); }
        .book-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .book-cover-fb {
          position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between;
          padding: 20% 12% 14%; text-align: center; color: #FFFFFF;
        }
        .book-cover-fb::before { content: ''; position: absolute; inset: 7px; border: 1px solid rgba(240,205,130,0.5); }
        .book-cover-fb-title { font-family: 'Lora', serif; font-weight: 600; font-size: 15px; line-height: 1.2; }
        .book-cover-fb-author { font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em; opacity: 0.92; }
        .book-badge { position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 500; padding: 3px 8px; border-radius: 20px; z-index: 1; }
        .book-title { font-family: 'Lora', serif; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); max-width: 100%; }
        .book-author { font-size: 12px; color: var(--text2); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
        .book-meta { font-size: 11px; color: var(--text3); margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .genre-pill { background: var(--surface2); color: var(--text2); font-size: 10px; padding: 1px 7px; border-radius: 20px; }
        .book-btns { display: flex; gap: 4px; justify-content: flex-end; margin-top: auto; }
        .icon-btn { background: none; border: none; cursor: pointer; color: var(--text3); padding: 6px; border-radius: 7px; font-size: 14px; line-height: 1; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
        .icon-btn:hover { background: var(--surface2); color: var(--text); }
        .icon-btn.on { background: var(--accent-light); color: var(--accent); }

        @media (max-width: 768px) {
          .book-grid { grid-template-columns: 1fr; gap: 8px; }
          .book-card { flex-direction: row; gap: 12px; align-items: flex-start; overflow: hidden; min-width: 0; max-width: 100%; }
          .book-cover { width: 72px !important; min-width: 72px; padding-bottom: 0 !important; height: 104px !important; flex-shrink: 0; }
          .book-cover-fb { padding: 14% 8%; }
          .book-cover-fb-title { font-size: 10px; }
          .book-cover-fb-author { display: none; }
          .book-btns { flex-direction: column; align-self: flex-start; margin-top: 0; flex-shrink: 0; }
          .icon-btn { padding: 8px; min-width: 36px; min-height: 36px; font-size: 16px; }
        }
      `}</style>

      {groups.filter(([, items]) => items.length > 0).map(([label, items]) => (
        <div key={label || 'group'}>
          {label && <div className="section-hd">{label}</div>}
          <div className="book-grid">
            {items.map(b => {
              const color = colorFor(b.title)
              const isEd  = editingId === b.id
              let meta = ''
              if (b.status === 'read' && b.start_date && b.end_date) meta = `${daysBetween(b.start_date, b.end_date)} days`
              else if (b.status === 'reading' && b.start_date) meta = `${daysBetween(b.start_date)}d in`
              const badge = BADGE[b.status]
              return (
                <React.Fragment key={b.id}>
                  <div className={`book-card${isEd ? ' ed' : ''}`} style={{ ['--i' as string]: cardIndex++ } as React.CSSProperties}>
                    <div className="book-cover" data-fly-id={b.id}>
                      {b.cover_url
                        ? <img src={b.cover_url} alt={b.title} />
                        : (
                          <div className="book-cover-fb" style={{ background: `linear-gradient(160deg, rgba(255,255,255,0.08), rgba(0,0,0,0.25)), ${color}` }}>
                            <div className="book-cover-fb-title">{b.title}</div>
                            <div className="book-cover-fb-author">{b.author}</div>
                          </div>
                        )}
                      {showBadges && <span className="book-badge" style={{ background: badge.bg, color: badge.color }}>{badge.txt}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="book-title">{b.title}</div>
                      <div className="book-author">{b.author}</div>
                      <div className="book-meta">
                        {b.genre && <span className="genre-pill">{b.genre}</span>}
                        {meta && <span>{meta}</span>}
                        {b.rating && <span style={{ color: 'var(--amber)' }} aria-label={`Rated ${b.rating} out of 5`}>{'★'.repeat(b.rating)}</span>}
                      </div>
                    </div>
                    <div className="book-btns">
                      <button onClick={() => onEdit(b)} className={`icon-btn${isEd ? ' on' : ''}`} title="Edit" aria-label={`Edit ${b.title}`}>✎</button>
                      <button onClick={() => onDelete(b.id)} className="icon-btn" title="Remove" aria-label={`Remove ${b.title}`}>✕</button>
                    </div>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
