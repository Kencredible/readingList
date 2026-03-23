'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Book = {
  id: number
  title: string
  author: string
  status: 'want' | 'reading' | 'read'
  genre: string | null
  start_date: string | null
  end_date: string | null
  rating: number | null
  notes: string | null
  cover_url: string | null
}

type Tab = 'all' | 'reading' | 'read' | 'want'

const COLORS = ['#2D5A3D','#2B4FA0','#9B4A1A','#6B3A8F','#1A6B6B','#7A3535','#4A6B1A','#2A5A7A']

function colorFor(t: string) {
  let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF
  return COLORS[h % COLORS.length]
}
function daysBetween(d1: string, d2?: string) {
  return Math.max(1, Math.round((new Date(d2 || Date.now()).getTime() - new Date(d1).getTime()) / 86400000))
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}
function stars(n: number) { return '★'.repeat(n) + '☆'.repeat(5 - n) }

const S: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh' },
  sidebar: { width: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '2rem 0', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10 },
  logo: { padding: '0 1.5rem 1.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' },
  logoH1: { fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 },
  nav: { flex: 1, padding: '0 0.75rem' },
  main: { marginLeft: 240, flex: 1, padding: '2.5rem 2.5rem 4rem', maxWidth: 'calc(100% - 240px)' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: '2rem' },
  statCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 12px rgba(40,28,10,0.08)' },
  statCardHL: { background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 12px rgba(40,28,10,0.08)' },
  formPanel: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem', marginBottom: '1.75rem', boxShadow: '0 8px 32px rgba(40,28,10,0.12)' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  input: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 14, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', outline: 'none', width: '100%' },
  bookCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px', display: 'flex', flexDirection: 'column' as const, gap: 10, boxShadow: '0 2px 12px rgba(40,28,10,0.08)', cursor: 'default' },
  inlineForm: { gridColumn: '1 / -1', background: 'var(--surface)', border: '1.5px solid var(--accent)', borderRadius: 16, padding: '1.5rem', boxShadow: '0 8px 32px rgba(40,28,10,0.12)', animation: 'slideDown 0.2s ease' },
  randCard: { flex: 1, background: 'var(--surface)', border: '1.5px solid rgba(193,123,42,0.35)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 8px 32px rgba(40,28,10,0.12)', marginBottom: '1.75rem' },
  yearFilterWrap: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' as const },
}

function NavItem({ label, icon, tab, active, count, onClick }: { label: string; icon: string; tab: Tab; active: boolean; count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, fontSize: 14, color: active ? 'var(--accent)' : 'var(--text2)', background: active ? 'var(--accent-light)' : 'none', fontWeight: active ? 500 : 400, border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>
      <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{icon}</span>
      {label}
      <span style={{ marginLeft: 'auto', fontSize: 11, background: active ? 'var(--accent)' : 'var(--surface2)', color: active ? 'white' : 'var(--text3)', padding: '2px 7px', borderRadius: 20, fontWeight: 500 }}>{count}</span>
    </button>
  )
}

function FormGroup({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : undefined }}>
      <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  )
}

const emptyForm = { title: '', author: '', status: 'want' as Book['status'], genre: '', start_date: '', end_date: '', rating: '', notes: '' }

export default function DashboardClient({ userName }: { userName: string }) {
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [skippedIds, setSkippedIds] = useState<number[]>([])
  const [suggestedId, setSuggestedId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/books')
      if (!res.ok) throw new Error()
      setBooks(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchBooks() }, [fetchBooks])

  // Suggestion logic
  const wantBooks = books.filter(b => b.status === 'want')
  useEffect(() => {
    const pool = wantBooks.filter(b => !skippedIds.includes(b.id))
    if (pool.length && !suggestedId) {
      setSuggestedId(pool[Math.floor(Math.random() * pool.length)].id)
    }
    if (!pool.length && wantBooks.length) {
      setSkippedIds([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books])

  function skipSuggestion() {
    setSkippedIds(s => suggestedId ? [...s, suggestedId] : s)
    const pool = wantBooks.filter(b => !skippedIds.includes(b.id) && b.id !== suggestedId)
    setSuggestedId(pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null)
  }

  async function startSuggested() {
    if (!suggestedId) return
    const today = new Date().toISOString().slice(0, 10)
    await fetch(`/api/books/${suggestedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reading', start_date: today }),
    })
    setSuggestedId(null)
    fetchBooks()
  }

  function openForm(book?: Book) {
    if (book) {
      // Inline edit — toggle off if clicking same book
      if (editingId === book.id) { setEditingId(null); return }
      setEditingId(book.id)
      setShowForm(false) // close the add form if open
      setForm({ title: book.title, author: book.author, status: book.status, genre: book.genre ?? '', start_date: book.start_date ?? '', end_date: book.end_date ?? '', rating: book.rating?.toString() ?? '', notes: book.notes ?? '' })
    } else {
      setEditingId(null)
      setShowForm(s => !s)
      setForm(emptyForm)
    }
  }

  async function saveBook() {
    if (!form.title.trim() || !form.author.trim()) return alert('Please enter a title and author.')
    setSaving(true)
    const payload = { title: form.title, author: form.author, status: form.status, genre: form.genre || null, start_date: form.start_date || null, end_date: form.end_date || null, rating: form.rating ? parseInt(form.rating) : null, notes: form.notes || null }
    const url = editingId ? `/api/books/${editingId}` : '/api/books'
    const method = editingId ? 'PATCH' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    fetchBooks()
  }

  async function deleteBook() {
    if (!deletingId) return
    await fetch(`/api/books/${deletingId}`, { method: 'DELETE' })
    setDeletingId(null)
    fetchBooks()
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function switchTab(t: Tab) { setTab(t); setSelectedYear(null) }

  // Stats
  const readBooks    = books.filter(b => b.status === 'read')
  const readingBooks = books.filter(b => b.status === 'reading')
  const durs = readBooks.filter(b => b.start_date && b.end_date).map(b => daysBetween(b.start_date!, b.end_date!))
  const avgDays = durs.length ? Math.round(durs.reduce((a, x) => a + x, 0) / durs.length) : 0
  const fastestDays = durs.length ? Math.min(...durs) : 0
  const ratings = readBooks.filter(b => b.rating).map(b => b.rating!)
  const avgRating = ratings.length ? (ratings.reduce((a, x) => a + x, 0) / ratings.length).toFixed(1) : null

  // Year filter pills
  const finishedWithStart = readBooks.filter(b => b.start_date)
  const years = [...new Set(finishedWithStart.map(b => b.start_date!.slice(0, 4)))].sort((a, b) => parseInt(b) - parseInt(a))

  // Filtered list
  let displayed = tab === 'all' ? books : books.filter(b => b.status === tab)
  if (tab === 'read' && selectedYear) displayed = displayed.filter(b => b.start_date?.slice(0, 4) === selectedYear)

  const TAB_LABELS: Record<Tab, [string, string]> = {
    all:     ['All books',    'Your complete reading collection'],
    read:    ['Finished',     'Books you have completed'],
    reading: ['Reading now',  'Currently in progress'],
    want:    ['Want to read', 'Your reading wishlist'],
  }

  const suggestedBook = suggestedId ? books.find(b => b.id === suggestedId) : null

  return (
    <div style={S.layout}>
      {/* Sidebar */}
      <nav style={S.sidebar}>
        <div style={S.logo}>
          <h1 style={S.logoH1}>my <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>reading</span><br />list</h1>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Hi, {userName} 👋</p>
        </div>
        <div style={S.nav}>
          <NavItem label="All books"    icon="📚" tab="all"     active={tab === 'all'}     count={books.length}                                     onClick={() => switchTab('all')} />
          <NavItem label="Reading now"  icon="📖" tab="reading" active={tab === 'reading'} count={readingBooks.length}                               onClick={() => switchTab('reading')} />
          <NavItem label="Finished"     icon="✓"  tab="read"    active={tab === 'read'}    count={readBooks.length}                                  onClick={() => switchTab('read')} />
          <NavItem label="Want to read" icon="🔖" tab="want"    active={tab === 'want'}    count={wantBooks.length}                                  onClick={() => switchTab('want')} />
        </div>
        <div style={{ padding: '0 0.75rem' }}>
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: 'none', background: 'none', color: 'var(--text3)', fontSize: 14, cursor: 'pointer', width: '100%', fontFamily: 'DM Sans, sans-serif', borderRadius: 10 }}>
            ↩ Sign out
          </button>
        </div>
      </nav>

      {/* Main */}
      <main style={S.main}>
        <div style={S.pageHeader}>
          <div>
            <h2 style={{ fontFamily: 'Lora, serif', fontSize: 26, fontWeight: 600 }}>{TAB_LABELS[tab][0]}</h2>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 3 }}>{TAB_LABELS[tab][1]}</p>
          </div>
          <button onClick={() => openForm()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 2px 8px rgba(45,90,61,0.3)' }}>
            ＋ Add book
          </button>
        </div>

        {/* Stats */}
        <div style={S.statsRow}>
          {[
            { label: 'Books read',       value: readBooks.length,       sub: `${readingBooks.length} in progress`, highlight: true },
            { label: 'Want to read',     value: wantBooks.length,       sub: 'on the wishlist' },
            { label: 'Avg. reading time',value: avgDays ? `${avgDays}d` : '—', sub: fastestDays ? `Fastest: ${fastestDays} days` : 'no data yet' },
            { label: 'Avg. rating',      value: avgRating ? `${avgRating} ★` : '—', sub: `${ratings.length} rated book${ratings.length !== 1 ? 's' : ''}` },
          ].map(s => (
            <div key={s.label} style={s.highlight ? S.statCardHL : S.statCard}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, color: s.highlight ? 'rgba(255,255,255,0.75)' : 'var(--text3)' }}>{s.label}</div>
              <div style={{ fontFamily: 'Lora, serif', fontSize: 28, fontWeight: 600, lineHeight: 1, color: s.highlight ? 'white' : 'var(--text)' }}>{s.value}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: s.highlight ? 'rgba(255,255,255,0.6)' : 'var(--text3)' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Year filter */}
        {tab === 'read' && years.length >= 2 && (
          <div style={S.yearFilterWrap}>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 2 }}>Year started</span>
            {['', ...years].map(y => (
              <button key={y || 'all'} onClick={() => setSelectedYear(y || null)}
                style={{ background: (y ? selectedYear === y : !selectedYear) ? 'var(--accent)' : 'none', border: '1px solid var(--border2)', borderRadius: 20, padding: '5px 14px', fontSize: 13, color: (y ? selectedYear === y : !selectedYear) ? 'white' : 'var(--text2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: (y ? selectedYear === y : !selectedYear) ? 500 : 400 }}>
                {y || 'All'}
              </button>
            ))}
          </div>
        )}

        {/* Suggestion */}
        {wantBooks.length > 0 && suggestedBook && (
          <div style={S.randCard}>
            {suggestedBook.cover_url ? (
              <img src={suggestedBook.cover_url} alt={suggestedBook.title} style={{ width: 48, height: 68, objectFit: 'cover', borderRadius: 4, flexShrink: 0, border: '1px solid var(--border)' }} />
            ) : (
              <div style={{ width: 5, height: 52, borderRadius: 3, background: colorFor(suggestedBook.title), flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--amber)', fontWeight: 500, marginBottom: 3 }}>✨ Suggested for you</div>
              <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suggestedBook.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{suggestedBook.author}{suggestedBook.genre ? ` · ${suggestedBook.genre}` : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={startSuggested} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>📖 Start reading</button>
              <button onClick={skipSuggestion} style={{ background: 'none', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Skip</button>
            </div>
          </div>
        )}

        {/* Add book form — only shown when adding new, not editing */}
        {showForm && !editingId && (
          <div style={S.formPanel}>
            <h3 style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 600, marginBottom: '1.25rem' }}>Add a book</h3>
            <div style={S.formGrid}>
              <FormGroup label="Title *" full><input style={S.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Book title" /></FormGroup>
              <FormGroup label="Author *" full><input style={S.input} value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="Author name" /></FormGroup>
              <FormGroup label="Status">
                <select style={S.input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Book['status'] }))}>
                  <option value="want">Want to read</option>
                  <option value="reading">Currently reading</option>
                  <option value="read">Finished</option>
                </select>
              </FormGroup>
              <FormGroup label="Genre"><input style={S.input} value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder="e.g. Fiction…" /></FormGroup>
              {(form.status === 'reading' || form.status === 'read') && (
                <FormGroup label="Date started"><input type="date" style={S.input} value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></FormGroup>
              )}
              {form.status === 'read' && (
                <FormGroup label="Date finished"><input type="date" style={S.input} value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></FormGroup>
              )}
              {form.status === 'read' && (
                <FormGroup label="Rating">
                  <select style={S.input} value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}>
                    <option value="">No rating</option>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)} {['Poor','Fair','Good','Great','Excellent'][n-1]}</option>)}
                  </select>
                </FormGroup>
              )}
              <FormGroup label="Notes" full><textarea style={{ ...S.input, resize: 'vertical', minHeight: 70 } as React.CSSProperties} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Thoughts, quotes…" /></FormGroup>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem' }}>
              <button onClick={saveBook} disabled={saving} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save book'}
              </button>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '9px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Book list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)', fontSize: 14 }}>Loading your books…</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>📭</div>
            <p>{selectedYear ? `No books started in ${selectedYear}` : 'No books here yet'}</p>
          </div>
        ) : (
          (() => {
            const groups: [string, Book[]][] = tab === 'all'
              ? [['Currently reading', displayed.filter(b => b.status === 'reading')], ['Finished', displayed.filter(b => b.status === 'read')], ['Want to read', displayed.filter(b => b.status === 'want')]]
              : [['', displayed]]

            const inlineFormEl = (
              <div style={S.inlineForm}>
                <h3 style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 600, marginBottom: '1.25rem' }}>Edit book</h3>
                <div style={S.formGrid}>
                  <FormGroup label="Title *" full><input style={S.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Book title" /></FormGroup>
                  <FormGroup label="Author *" full><input style={S.input} value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="Author name" /></FormGroup>
                  <FormGroup label="Status">
                    <select style={S.input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Book['status'] }))}>
                      <option value="want">Want to read</option>
                      <option value="reading">Currently reading</option>
                      <option value="read">Finished</option>
                    </select>
                  </FormGroup>
                  <FormGroup label="Genre"><input style={S.input} value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder="e.g. Fiction…" /></FormGroup>
                  {(form.status === 'reading' || form.status === 'read') && (
                    <FormGroup label="Date started"><input type="date" style={S.input} value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></FormGroup>
                  )}
                  {form.status === 'read' && (
                    <FormGroup label="Date finished"><input type="date" style={S.input} value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></FormGroup>
                  )}
                  {form.status === 'read' && (
                    <FormGroup label="Rating">
                      <select style={S.input} value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}>
                        <option value="">No rating</option>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)} {['Poor','Fair','Good','Great','Excellent'][n-1]}</option>)}
                      </select>
                    </FormGroup>
                  )}
                  <FormGroup label="Notes" full><textarea style={{ ...S.input, resize: 'vertical', minHeight: 70 } as React.CSSProperties} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Thoughts, quotes…" /></FormGroup>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem' }}>
                  <button onClick={saveBook} disabled={saving} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Saving…' : 'Save book'}
                  </button>
                  <button onClick={() => setEditingId(null)} style={{ background: 'none', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '9px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
                </div>
              </div>
            )

            return groups.filter(([, items]) => items.length > 0).map(([label, items]) => (
              <div key={label}>
                {label && <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '1.5rem 0 0.75rem' }}>{label}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                  {items.map((b) => {
                    const color = colorFor(b.title)
                    const isEditing = editingId === b.id
                    let meta = ''
                    if (b.status === 'read' && b.start_date && b.end_date) {
                      const d = daysBetween(b.start_date, b.end_date)
                      meta = `${d} day${d !== 1 ? 's' : ''}`
                    } else if (b.status === 'reading' && b.start_date) {
                      const d = daysBetween(b.start_date)
                      meta = `${d}d in`
                    }
                    const badgeBg: Record<string, string> = { read: 'var(--accent-light)', reading: 'var(--blue-light)', want: 'var(--amber-light)' }
                    const badgeColor: Record<string, string> = { read: 'var(--accent)', reading: 'var(--blue)', want: 'var(--amber)' }
                    const badgeTxt: Record<string, string> = { read: '✓ Read', reading: '● Reading', want: '🔖 Want' }
                    return (
                      <React.Fragment key={b.id}>
                        <div key={b.id} style={{ ...S.bookCard, outline: isEditing ? '2px solid var(--accent)' : 'none' }}>
                          {/* Cover */}
                          <div style={{ position: 'relative', width: '100%', paddingBottom: '140%', borderRadius: 8, overflow: 'hidden', background: 'var(--surface2)', flexShrink: 0 }}>
                            {b.cover_url ? (
                              <img src={b.cover_url} alt={b.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: 6, height: '60%', borderRadius: 3, background: color }} />
                              </div>
                            )}
                            {/* Badge overlay */}
                            {tab === 'all' && (
                              <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 20, background: badgeBg[b.status], color: badgeColor[b.status] }}>{badgeTxt[b.status]}</span>
                            )}
                          </div>
                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'Lora, serif', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{b.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.author}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                              {b.genre && <span style={{ background: 'var(--surface2)', color: 'var(--text2)', fontSize: 10, padding: '1px 7px', borderRadius: 20 }}>{b.genre}</span>}
                              {meta && <span>{meta}</span>}
                              {b.rating && <span style={{ color: 'var(--amber)' }}>{'★'.repeat(b.rating)}</span>}
                            </div>
                          </div>
                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button onClick={() => openForm(b)} style={{ background: isEditing ? 'var(--accent-light)' : 'none', border: 'none', cursor: 'pointer', color: isEditing ? 'var(--accent)' : 'var(--text3)', padding: 6, borderRadius: 7, fontSize: 14 }}>✎</button>
                            <button onClick={() => setDeletingId(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6, borderRadius: 7, fontSize: 14 }}>✕</button>
                          </div>
                        </div>
                        {/* Inline edit form — spans full grid width, inserted after the edited card */}
                        {isEditing && inlineFormEl}
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>
            ))
          })()
        )}
      </main>

      {/* Delete modal */}
      {deletingId && (
        <div onClick={e => { if (e.target === e.currentTarget) setDeletingId(null) }} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,14,6,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '1.75rem', width: '90%', maxWidth: 480, boxShadow: '0 8px 32px rgba(40,28,10,0.12)' }}>
            <h3 style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 600, marginBottom: '0.75rem' }}>Remove this book?</h3>
            <p style={{ fontSize: 14, color: 'var(--text2)' }}>This will permanently remove <strong>{books.find(b => b.id === deletingId)?.title}</strong> from your list.</p>
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeletingId(null)} style={{ background: 'none', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '9px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={deleteBook} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
