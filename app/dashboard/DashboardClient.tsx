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

type Tab = 'all' | 'reading' | 'read' | 'want' | 'hof'

const COLORS = ['#2D5A3D','#2B4FA0','#9B4A1A','#6B3A8F','#1A6B6B','#7A3535','#4A6B1A','#2A5A7A']

function colorFor(t: string) {
  let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF
  return COLORS[h % COLORS.length]
}
function daysBetween(d1: string, d2?: string) {
  return Math.max(1, Math.round((new Date(d2 || Date.now()).getTime() - new Date(d1).getTime()) / 86400000))
}

const emptyForm = { title: '', author: '', status: 'want' as Book['status'], genre: '', start_date: '', end_date: '', rating: '', notes: '' }

function FormGroup({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`form-group${full ? ' full' : ''}`}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

function BookForm({ form, setForm, onSave, onCancel, saving, title }: {
  form: typeof emptyForm
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>
  onSave: () => void
  onCancel: () => void
  saving: boolean
  title: string
}) {
  return (
    <>
      <h3 className="form-title">{title}</h3>
      <div className="form-grid">
        <FormGroup label="Title *" full><input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Book title" /></FormGroup>
        <FormGroup label="Author *" full><input className="input" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="Author name" /></FormGroup>
        <FormGroup label="Status">
          <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Book['status'] }))}>
            <option value="want">Want to read</option>
            <option value="reading">Currently reading</option>
            <option value="read">Finished</option>
          </select>
        </FormGroup>
        <FormGroup label="Genre"><input className="input" value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder="e.g. Fiction…" /></FormGroup>
        {(form.status === 'reading' || form.status === 'read') && (
          <FormGroup label="Date started"><input type="date" className="input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></FormGroup>
        )}
        {form.status === 'read' && (
          <FormGroup label="Date finished"><input type="date" className="input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></FormGroup>
        )}
        {form.status === 'read' && (
          <FormGroup label="Rating">
            <select className="input" value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}>
              <option value="">No rating</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)} {['Poor','Fair','Good','Great','Excellent'][n-1]}</option>)}
            </select>
          </FormGroup>
        )}
        <FormGroup label="Notes" full>
          <textarea className="input textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Thoughts, quotes…" />
        </FormGroup>
      </div>
      <div className="form-actions">
        <button onClick={onSave} disabled={saving} className="btn-save">{saving ? 'Saving…' : 'Save book'}</button>
        <button onClick={onCancel} className="btn-cancel">Cancel</button>
      </div>
    </>
  )
}

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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'default' | 'title' | 'rating' | 'duration'>('default')
  const [yearlyGoal, setYearlyGoal] = useState<number | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
      setSidebarOpen(!e.matches)
    }
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    // Show cached value instantly while the API call is in flight
    const cached = localStorage.getItem('readingGoal')
    if (cached) setYearlyGoal(parseInt(cached))

    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        const goal = data.yearly_goal ?? null
        setYearlyGoal(goal)
        if (goal) localStorage.setItem('readingGoal', String(goal))
        else localStorage.removeItem('readingGoal')
      })
      .catch(() => {})
  }, [])

  async function saveGoal(n: number) {
    setYearlyGoal(n)
    setEditingGoal(false)
    localStorage.setItem('readingGoal', String(n))
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yearly_goal: n }),
    })
  }

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = stored ? stored === 'dark' : systemDark
    setIsDark(dark)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [])

  function toggleDark() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

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

  const wantBooks = books.filter(b => b.status === 'want')
  useEffect(() => {
    const pool = wantBooks.filter(b => !skippedIds.includes(b.id))
    if (pool.length && !suggestedId) setSuggestedId(pool[Math.floor(Math.random() * pool.length)].id)
    if (!pool.length && wantBooks.length) setSkippedIds([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books])

  function skipSuggestion() {
    setSkippedIds(s => suggestedId ? [...s, suggestedId] : s)
    const pool = wantBooks.filter(b => !skippedIds.includes(b.id) && b.id !== suggestedId)
    setSuggestedId(pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null)
  }

  async function startSuggested() {
    if (!suggestedId) return
    await fetch(`/api/books/${suggestedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'reading', start_date: new Date().toISOString().slice(0, 10) }) })
    setSuggestedId(null)
    fetchBooks()
  }

  function openForm(book?: Book) {
    if (book) {
      if (editingId === book.id) { setEditingId(null); return }
      setEditingId(book.id)
      setShowForm(false)
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
    await fetch(editingId ? `/api/books/${editingId}` : '/api/books', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false); setShowForm(false); setEditingId(null); fetchBooks()
  }

  async function deleteBook() {
    if (!deletingId) return
    await fetch(`/api/books/${deletingId}`, { method: 'DELETE' })
    setDeletingId(null); fetchBooks()
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function switchTab(t: Tab) {
    setTab(t); setSelectedYear(null); setSearchQuery('')
    if (isMobile) setSidebarOpen(false)
  }

  const readBooks    = books.filter(b => b.status === 'read')
  const readingBooks = books.filter(b => b.status === 'reading')
  const durs         = readBooks.filter(b => b.start_date && b.end_date).map(b => daysBetween(b.start_date!, b.end_date!))
  const avgDays      = durs.length ? Math.round(durs.reduce((a, x) => a + x, 0) / durs.length) : 0
  const fastestDays  = durs.length ? Math.min(...durs) : 0
  const ratings      = readBooks.filter(b => b.rating).map(b => b.rating!)
  const avgRating    = ratings.length ? (ratings.reduce((a, x) => a + x, 0) / ratings.length).toFixed(1) : null
  const hofBooks     = readBooks.filter(b => b.rating === 5)
  const years        = [...new Set(readBooks.filter(b => b.start_date).map(b => b.start_date!.slice(0, 4)))].sort((a, b) => parseInt(b) - parseInt(a))
  let displayed      = tab === 'all' ? books : books.filter(b => b.status === tab)
  if (tab === 'read' && selectedYear) displayed = displayed.filter(b => b.start_date?.slice(0, 4) === selectedYear)
  const suggestedBook = suggestedId ? books.find(b => b.id === suggestedId) : null

  const currentYear = new Date().getFullYear()
  const booksReadThisYear = readBooks.filter(b =>
    b.end_date?.startsWith(String(currentYear)) ||
    (!b.end_date && b.start_date?.startsWith(String(currentYear)))
  ).length
  const goalPct = yearlyGoal ? Math.min(100, Math.round((booksReadThisYear / yearlyGoal) * 100)) : 0

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    displayed = displayed.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
  }
  if (sortBy === 'title') displayed = [...displayed].sort((a, b) => a.title.localeCompare(b.title))
  else if (sortBy === 'rating') displayed = [...displayed].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  else if (sortBy === 'duration') displayed = [...displayed].sort((a, b) => {
    const da = a.start_date && a.end_date ? daysBetween(a.start_date, a.end_date) : Infinity
    const db = b.start_date && b.end_date ? daysBetween(b.start_date, b.end_date) : Infinity
    return da - db
  })

  const filteredHofBooks = searchQuery.trim()
    ? hofBooks.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.author.toLowerCase().includes(searchQuery.toLowerCase()))
    : hofBooks

  const TAB_LABELS: Record<Tab, [string, string]> = {
    all:     ['All books',    'Your complete reading collection'],
    read:    ['Finished',     'Books you have completed'],
    reading: ['Reading now',  'Currently in progress'],
    want:    ['Want to read', 'Your reading wishlist'],
    hof:     ['Hall of Fame', 'Your 5-star reads'],
  }

  const SW = sidebarOpen ? 240 : 64

  return (
    <>
      <style>{`
        .layout { display: flex; min-height: 100vh; }

        /* ── Sidebar ── */
        .sidebar {
          width: 240px; background: var(--surface); border-right: 1px solid var(--border);
          display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0;
          z-index: 20; transition: width 0.22s ease; overflow: hidden;
        }
        .sidebar.collapsed { width: 64px; }

        .sidebar-top {
          min-height: 70px; padding: 0 1.25rem;
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid var(--border); gap: 8px; flex-shrink: 0;
        }
        .sidebar.collapsed .sidebar-top { padding: 0; justify-content: center; }

        .logo-text {
          font-family: 'Lora', serif; font-size: 17px; font-weight: 600; color: var(--text);
          line-height: 1.25; white-space: nowrap; overflow: hidden;
          opacity: 1; transition: opacity 0.15s; pointer-events: none; flex: 1;
        }
        .sidebar.collapsed .logo-text { opacity: 0; width: 0; flex: 0; }
        .logo-text em { font-style: italic; color: var(--accent); font-size: inherit; }

        .toggle-btn {
          flex-shrink: 0; width: 30px; height: 30px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--surface2);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 12px; color: var(--text3); transition: all 0.15s;
        }
        .toggle-btn:hover { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }

        .sidebar-nav { flex: 1; padding: 0.75rem; overflow-y: auto; overflow-x: hidden; }
        .sidebar.collapsed .sidebar-nav { padding: 0.75rem 0.5rem; }

        .nav-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; justify-content: flex-start;
          border-radius: 10px; border: none; width: 100%; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 14px; transition: all 0.15s;
          margin-bottom: 2px; white-space: nowrap; position: relative; background: none; color: var(--text2);
        }
        .sidebar.collapsed .nav-btn { justify-content: center; padding: 10px 0; }
        .nav-btn:hover { background: var(--surface2); color: var(--text); }
        .nav-btn.active { background: var(--accent-light); color: var(--accent); font-weight: 500; }

        .nav-icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; line-height: 1; }

        .nav-label {
          overflow: hidden; opacity: 1; max-width: 130px;
          transition: opacity 0.15s, max-width 0.22s;
        }
        .sidebar.collapsed .nav-label { opacity: 0; max-width: 0; }

        .nav-count {
          margin-left: auto; font-size: 11px; padding: 2px 7px; border-radius: 20px;
          font-weight: 500; flex-shrink: 0; opacity: 1; transition: opacity 0.15s;
        }
        .sidebar.collapsed .nav-count { opacity: 0; width: 0; padding: 0; margin: 0; overflow: hidden; }
        .nav-btn.active .nav-count { background: var(--accent); color: white; }
        .nav-btn:not(.active) .nav-count { background: var(--surface2); color: var(--text3); }

        .nav-tooltip {
          display: none; position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%);
          background: var(--text); color: var(--bg); font-size: 12px; padding: 5px 10px; border-radius: 6px;
          white-space: nowrap; pointer-events: none; z-index: 200;
        }
        .sidebar.collapsed .nav-btn:hover .nav-tooltip { display: block; }

        .nav-divider { height: 1px; background: var(--border); margin: 6px 12px; }
        .sidebar.collapsed .nav-divider { margin: 6px 8px; }

        .sidebar-bottom { padding: 0.75rem; border-top: 1px solid var(--border); flex-shrink: 0; }
        .sidebar.collapsed .sidebar-bottom { padding: 0.5rem; }

        .sidebar-user {
          font-size: 12px; color: var(--text3); padding: 4px 12px 8px;
          white-space: nowrap; overflow: hidden; opacity: 1; transition: opacity 0.15s;
        }
        .sidebar.collapsed .sidebar-user { opacity: 0; height: 0; padding: 0; overflow: hidden; }

        .signout-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; justify-content: flex-start;
          border: none; background: none; color: var(--text3); font-size: 14px; cursor: pointer;
          width: 100%; font-family: 'DM Sans', sans-serif; border-radius: 10px; transition: background 0.15s;
          white-space: nowrap; position: relative;
        }
        .sidebar.collapsed .signout-btn { justify-content: center; padding: 10px 0; }
        .signout-btn:hover { background: var(--surface2); color: var(--text); }

        .signout-label {
          overflow: hidden; opacity: 1; max-width: 130px;
          transition: opacity 0.15s, max-width 0.22s;
        }
        .sidebar.collapsed .signout-label { opacity: 0; max-width: 0; }
        .sidebar.collapsed .signout-btn:hover .nav-tooltip { display: block; }

        /* ── Mobile overlay ── */
        .mob-overlay { display: none; position: fixed; inset: 0; background: rgba(20,14,6,0.45); z-index: 19; }
        .mob-overlay.on { display: block; }

        /* ── Mobile topbar ── */
        .mob-bar {
          display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 18;
          height: 56px; background: var(--surface); border-bottom: 1px solid var(--border);
          align-items: center; justify-content: space-between; padding: 0 1rem; gap: 12px;
        }
        .mob-bar h1 { font-family: 'Lora', serif; font-size: 16px; font-weight: 600; flex: 1; }
        .mob-bar h1 em { font-style: italic; color: var(--accent); }
        .hamburger { width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; flex-shrink: 0; color: var(--text2); }

        /* ── Main ── */
        .main { flex: 1; padding: 2.5rem 2.5rem 4rem; min-width: 0; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; gap: 12px; flex-wrap: wrap; }
        .page-header h2 { font-family: 'Lora', serif; font-size: 26px; font-weight: 600; }
        .page-header p { font-size: 14px; color: var(--text3); margin-top: 3px; }
        .add-btn { display: flex; align-items: center; gap: 8px; background: var(--accent); color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; box-shadow: 0 2px 8px rgba(45,90,61,0.3); white-space: nowrap; flex-shrink: 0; }
        .add-btn:hover { background: #245030; }

        /* ── Stats ── */
        .stats-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 2rem; }
        .stat-card { border-radius: 16px; padding: 16px 18px; box-shadow: 0 2px 12px rgba(40,28,10,0.08); }
        .stat-card.n { background: var(--surface); border: 1px solid var(--border); }
        .stat-card.h { background: var(--accent); border: 1px solid var(--accent); }
        .stat-lbl { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .stat-card.n .stat-lbl { color: var(--text3); }
        .stat-card.h .stat-lbl { color: rgba(255,255,255,0.75); }
        .stat-val { font-family: 'Lora', serif; font-size: 28px; font-weight: 600; line-height: 1; }
        .stat-card.n .stat-val { color: var(--text); }
        .stat-card.h .stat-val { color: white; }
        .stat-s { font-size: 12px; margin-top: 4px; }
        .stat-card.n .stat-s { color: var(--text3); }
        .stat-card.h .stat-s { color: rgba(255,255,255,0.6); }

        /* ── Year filter ── */
        .year-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .year-lbl { font-size: 12px; color: var(--text3); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .year-pill { border-radius: 20px; padding: 5px 14px; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; border: 1px solid var(--border2); transition: all 0.15s; }
        .year-pill.on { background: var(--accent); color: white; border-color: var(--accent); font-weight: 500; }
        .year-pill:not(.on) { background: none; color: var(--text2); }

        /* ── Suggestion ── */
        .rand-card { background: var(--surface); border: 1.5px solid rgba(193,123,42,0.35); border-radius: 16px; padding: 16px 20px; display: flex; align-items: center; gap: 14px; box-shadow: 0 8px 32px rgba(40,28,10,0.12); margin-bottom: 1.75rem; flex-wrap: wrap; }
        .btn-start { background: var(--accent); color: white; border: none; border-radius: 10px; padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .btn-skip { background: none; color: var(--text3); border: 1px solid var(--border2); border-radius: 10px; padding: 8px 14px; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .rand-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }

        /* ── Forms ── */
        .form-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.75rem; box-shadow: 0 8px 32px rgba(40,28,10,0.12); animation: slideDown 0.2s ease; }
        .inline-form { background: var(--surface); border: 1.5px solid var(--accent); border-radius: 16px; padding: 1.5rem; grid-column: 1 / -1; box-shadow: 0 8px 32px rgba(40,28,10,0.12); animation: slideDown 0.2s ease; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .form-title { font-family: 'Lora', serif; font-size: 16px; font-weight: 600; margin-bottom: 1.25rem; color: var(--text); }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group.full { grid-column: 1 / -1; }
        .form-label { font-size: 12px; color: var(--text2); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .input { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 9px 12px; font-size: 14px; color: var(--text); font-family: 'DM Sans', sans-serif; outline: none; width: 100%; transition: border-color 0.15s; }
        .input:focus { border-color: var(--accent); background: white; }
        .textarea { resize: vertical; min-height: 70px; }
        .form-actions { display: flex; gap: 10px; margin-top: 1.25rem; flex-wrap: wrap; }
        .btn-save { background: var(--accent); color: white; border: none; border-radius: 10px; padding: 9px 22px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-save:disabled { opacity: 0.7; cursor: not-allowed; }
        .btn-cancel { background: none; color: var(--text2); border: 1px solid var(--border2); border-radius: 10px; padding: 9px 18px; font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }

        /* ── Book grid ── */
        .section-hd { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text3); margin: 1.5rem 0 0.75rem; }
        .book-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
        .book-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 2px 12px rgba(40,28,10,0.08); }
        .book-card.ed { outline: 2px solid var(--accent); }
        .book-cover { position: relative; width: 100%; padding-bottom: 140%; border-radius: 8px; overflow: hidden; background: var(--surface2); }
        .book-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .book-cover-fb { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
        .book-badge { position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 500; padding: 3px 8px; border-radius: 20px; }
        .book-title { font-family: 'Lora', serif; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); max-width: 100%; }
        .book-author { font-size: 12px; color: var(--text2); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
        .book-meta { font-size: 11px; color: var(--text3); margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .genre-pill { background: var(--surface2); color: var(--text2); font-size: 10px; padding: 1px 7px; border-radius: 20px; }
        .book-btns { display: flex; gap: 4px; justify-content: flex-end; margin-top: auto; }
        .icon-btn { background: none; border: none; cursor: pointer; color: var(--text3); padding: 6px; border-radius: 7px; font-size: 14px; line-height: 1; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
        .icon-btn:hover { background: var(--surface2); color: var(--text); }
        .icon-btn.on { background: var(--accent-light); color: var(--accent); }

        /* ── Hall of Fame ── */
        .hof-grid { columns: auto 160px; column-gap: 16px; }
        .hof-cover { position: relative; border-radius: 8px; overflow: hidden; break-inside: avoid; margin-bottom: 16px; }
        .hof-cover img { width: 100%; display: block; }
        .hof-fb { aspect-ratio: 2/3; display: flex; align-items: center; justify-content: center; background: var(--surface2); }
        .hof-ov { position: absolute; inset: 0; background: rgba(20,14,6,0.82); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; opacity: 0; transition: opacity 0.2s; padding: 12px; text-align: center; }
        .hof-cover:hover .hof-ov { opacity: 1; }

        /* ── Empty / loading ── */
        .empty { text-align: center; padding: 3rem 1rem; color: var(--text3); }

        /* ── Search & sort ── */
        .search-sort-bar { display: flex; gap: 10px; margin-bottom: 1.25rem; align-items: center; }
        .search-input { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 9px 14px; font-size: 14px; color: var(--text); font-family: 'DM Sans', sans-serif; outline: none; transition: border-color 0.15s; }
        .search-input:focus { border-color: var(--accent); }
        .search-input::placeholder { color: var(--text3); }
        .sort-select { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 9px 12px; font-size: 13px; color: var(--text2); font-family: 'DM Sans', sans-serif; outline: none; cursor: pointer; flex-shrink: 0; }

        /* ── Reading goal ── */
        .goal-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px 20px; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 12px rgba(40,28,10,0.08); flex-wrap: wrap; }
        .goal-info { flex: 1; min-width: 0; }
        .goal-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text3); font-weight: 500; margin-bottom: 8px; }
        .goal-bar-wrap { background: var(--surface2); border-radius: 20px; height: 8px; overflow: hidden; margin-bottom: 6px; }
        .goal-bar-fill { height: 100%; background: var(--accent); border-radius: 20px; transition: width 0.5s ease; }
        .goal-label { font-size: 13px; color: var(--text2); }
        .goal-complete { color: var(--accent); font-weight: 600; }
        .goal-edit-btn { background: none; border: 1px solid var(--border2); border-radius: 8px; padding: 7px 14px; font-size: 13px; color: var(--text2); cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; flex-shrink: 0; transition: background 0.15s; }
        .goal-edit-btn:hover { background: var(--surface2); }
        .goal-edit { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
        .goal-input { width: 80px !important; text-align: center; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .mob-bar { display: flex; }
          .sidebar {
            top: 56px;
            width: 240px !important;
            left: -240px;
            transition: left 0.25s ease;
            box-shadow: none;
          }
          .sidebar.mob-open {
            left: 0;
            box-shadow: 4px 0 24px rgba(20,14,6,0.15);
          }
          .sidebar-top { display: none; }
          .sidebar.collapsed { width: 240px !important; }
          .sidebar.collapsed .nav-btn { justify-content: flex-start; padding: 9px 12px; }
          .sidebar.collapsed .nav-label { opacity: 1; max-width: 130px; }
          .sidebar.collapsed .nav-count { opacity: 1; width: auto; padding: 2px 7px; margin-left: auto; }
          .sidebar.collapsed .sidebar-top { display: none; }
          .sidebar.collapsed .logo-text { opacity: 1; flex: 1; width: auto; }
          .sidebar.collapsed .sidebar-bottom { padding: 0.75rem; }
          .sidebar.collapsed .sidebar-user { opacity: 1; height: auto; padding: 4px 12px 8px; }
          .sidebar.collapsed .signout-btn { justify-content: flex-start; padding: 9px 12px; }
          .sidebar.collapsed .signout-label { opacity: 1; max-width: 130px; }
          .sidebar.collapsed .nav-divider { margin: 6px 12px; }
          .main { margin-left: 0 !important; max-width: 100% !important; padding: 5rem 1rem 4rem; overflow-x: hidden; }
          .add-btn.desktop { display: none !important; }
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .stat-val { font-size: 22px; }
          .stat-card { padding: 14px; }
          .form-grid { grid-template-columns: 1fr; }
          .form-group.full { grid-column: 1; }
          .form-actions { flex-direction: column; }
          .btn-save, .btn-cancel { width: 100%; text-align: center; padding: 12px; }
          .page-header h2 { font-size: 22px; }
          .book-grid { grid-template-columns: 1fr; gap: 8px; }
          .book-card { flex-direction: row; gap: 12px; align-items: flex-start; overflow: hidden; min-width: 0; max-width: 100%; }
          .book-cover { width: 72px !important; min-width: 72px; padding-bottom: 0 !important; height: 104px !important; flex-shrink: 0; }
          .book-btns { flex-direction: column; align-self: flex-start; margin-top: 0; flex-shrink: 0; }
          .inline-form { max-width: 100%; box-sizing: border-box; overflow: hidden; }
          .inline-form .form-grid { max-width: 100%; }
          .inline-form .input { max-width: 100%; box-sizing: border-box; }
          .icon-btn { padding: 8px; min-width: 36px; min-height: 36px; font-size: 16px; }
          .year-pill { padding: 7px 14px; }
          .rand-card { padding: 12px 14px; gap: 10px; }
          .nav-btn { min-height: 44px; }
          .signout-btn { min-height: 44px; }
          .search-sort-bar { flex-wrap: wrap; }
          .sort-select { width: 100%; }
          .goal-card { gap: 12px; }
          .goal-edit { width: 100%; }
        }
        @media (min-width: 769px) {
          .add-btn.mobile { display: none !important; }
          .mob-overlay { display: none !important; }
        }
        @media (max-width: 1100px) and (min-width: 769px) {
          .stats-row { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 400px) {
          .stats-row { grid-template-columns: 1fr 1fr; }
          .stat-val { font-size: 20px; }
          .stat-lbl { font-size: 11px; }
          .stat-s { font-size: 11px; }
          .rand-card { flex-wrap: wrap; }
          .rand-actions { width: 100%; }
          .btn-start, .btn-skip { flex: 1; text-align: center; }
          .main { padding: 5rem 0.75rem 4rem; }
        }
      `}</style>

      <div className="layout">

        {/* Mobile topbar */}
        <div className="mob-bar">
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <h1>my <em>reading</em> list</h1>
          <button onClick={() => openForm()} className="add-btn mobile" style={{ padding: '8px 14px', fontSize: 13 }}>＋ Add</button>
        </div>

        {/* Mobile overlay */}
        {isMobile && sidebarOpen && <div className="mob-overlay on" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <nav className={`sidebar${!sidebarOpen ? ' collapsed' : ''}${isMobile && sidebarOpen ? ' mob-open' : ''}`}>
          <div className="sidebar-top">
            {sidebarOpen && <div className="logo-text">my <em>reading</em><br />list</div>}
            <button className="toggle-btn" onClick={() => setSidebarOpen(o => !o)} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>

          <div className="sidebar-nav">
            {([
              { label: 'All books',    icon: '📚', t: 'all',     count: books.length },
              { label: 'Reading now',  icon: '📖', t: 'reading', count: readingBooks.length },
              { label: 'Finished',     icon: '✓',  t: 'read',    count: readBooks.length },
              { label: 'Want to read', icon: '🔖', t: 'want',    count: wantBooks.length },
            ] as const).map(item => (
              <button key={item.t} className={`nav-btn${tab === item.t ? ' active' : ''}`} onClick={() => switchTab(item.t)}>
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                <span className="nav-count">{item.count}</span>
                <span className="nav-tooltip">{item.label}</span>
              </button>
            ))}
            <div className="nav-divider" />
            <button className={`nav-btn${tab === 'hof' ? ' active' : ''}`} onClick={() => switchTab('hof')}>
              <span className="nav-icon">🏆</span>
              <span className="nav-label">Hall of Fame</span>
              <span className="nav-tooltip">Hall of Fame</span>
            </button>
          </div>

          <div className="sidebar-bottom">
            {sidebarOpen && <div className="sidebar-user">Hi, {userName} 👋</div>}
            <button onClick={toggleDark} className="signout-btn" title={isDark ? 'Light mode' : 'Dark mode'}>
              <span className="nav-icon">{isDark ? '☀️' : '🌙'}</span>
              <span className="signout-label">{isDark ? 'Light mode' : 'Dark mode'}</span>
              <span className="nav-tooltip">{isDark ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <button onClick={logout} className="signout-btn" title="Sign out">
              <span className="nav-icon" style={{ fontSize: 14 }}>↩</span>
              <span className="signout-label">Sign out</span>
              <span className="nav-tooltip">Sign out</span>
            </button>
          </div>
        </nav>

        {/* Main content */}
        <main className="main" style={{ marginLeft: isMobile ? 0 : SW, maxWidth: isMobile ? '100%' : `calc(100% - ${SW}px)`, transition: 'margin-left 0.22s ease, max-width 0.22s ease' }}>

          <div className="page-header">
            <div>
              <h2>{TAB_LABELS[tab][0]}</h2>
              <p>{TAB_LABELS[tab][1]}</p>
            </div>
            <button onClick={() => openForm()} className="add-btn desktop">＋ Add book</button>
          </div>

          {/* Stats */}
          <div className="stats-row">
            {[
              { l: 'Books read',        v: String(readBooks.length),              s: `${readingBooks.length} in progress`, h: true },
              { l: 'Want to read',      v: String(wantBooks.length),              s: 'on the wishlist',                    h: false },
              { l: 'Avg. reading time', v: avgDays ? `${avgDays}d` : '—',        s: fastestDays ? `Fastest: ${fastestDays}d` : 'no data yet', h: false },
              { l: 'Avg. rating',       v: avgRating ? `${avgRating} ★` : '—',   s: `${ratings.length} rated`,            h: false },
            ].map(s => (
              <div key={s.l} className={`stat-card ${s.h ? 'h' : 'n'}`}>
                <div className="stat-lbl">{s.l}</div>
                <div className="stat-val">{s.v}</div>
                <div className="stat-s">{s.s}</div>
              </div>
            ))}
          </div>

          {/* Reading goal */}
          <div className="goal-card">
            <div className="goal-info">
              <div className="goal-title">📖 {currentYear} Reading Goal</div>
              {yearlyGoal ? (
                <>
                  <div className="goal-bar-wrap">
                    <div className="goal-bar-fill" style={{ width: `${goalPct}%` }} />
                  </div>
                  <div className="goal-label">
                    {goalPct >= 100
                      ? <span className="goal-complete">🎉 Goal complete! {booksReadThisYear} of {yearlyGoal} books</span>
                      : <>{booksReadThisYear} of {yearlyGoal} books — {goalPct}%</>
                    }
                  </div>
                </>
              ) : (
                <div className="goal-label" style={{ color: 'var(--text3)' }}>No goal set for this year</div>
              )}
            </div>
            {editingGoal ? (
              <div className="goal-edit">
                <input
                  className="input goal-input" type="number" min="1" max="365"
                  value={goalInput} onChange={e => setGoalInput(e.target.value)}
                  placeholder="e.g. 24" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { const n = parseInt(goalInput); if (n > 0) saveGoal(n); else setEditingGoal(false) } if (e.key === 'Escape') setEditingGoal(false) }}
                />
                <button className="btn-save" style={{ padding: '9px 16px' }} onClick={() => { const n = parseInt(goalInput); if (n > 0) saveGoal(n); else setEditingGoal(false) }}>Set</button>
                <button className="btn-cancel" onClick={() => setEditingGoal(false)}>Cancel</button>
              </div>
            ) : (
              <button className="goal-edit-btn" onClick={() => { setGoalInput(String(yearlyGoal || '')); setEditingGoal(true) }}>
                {yearlyGoal ? 'Edit goal' : 'Set goal'}
              </button>
            )}
          </div>

          {/* Year filter */}
          {tab === 'read' && years.length >= 2 && (
            <div className="year-bar">
              <span className="year-lbl">Year started</span>
              {['', ...years].map(y => (
                <button key={y || 'all'} className={`year-pill${(y ? selectedYear === y : !selectedYear) ? ' on' : ''}`} onClick={() => setSelectedYear(y || null)}>
                  {y || 'All'}
                </button>
              ))}
            </div>
          )}

          {/* Suggestion */}
          {tab === 'reading' && wantBooks.length > 0 && suggestedBook && (
            <div className="rand-card">
              {suggestedBook.cover_url
                ? <img src={suggestedBook.cover_url} alt={suggestedBook.title} style={{ width: 48, height: 68, objectFit: 'cover', borderRadius: 4, flexShrink: 0, border: '1px solid var(--border)' }} />
                : <div style={{ width: 5, height: 52, borderRadius: 3, background: colorFor(suggestedBook.title), flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--amber)', fontWeight: 500, marginBottom: 3 }}>✨ Suggested for you</div>
                <div style={{ fontFamily: 'Lora, serif', fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suggestedBook.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{suggestedBook.author}{suggestedBook.genre ? ` · ${suggestedBook.genre}` : ''}</div>
              </div>
              <div className="rand-actions">
                <button onClick={startSuggested} className="btn-start">📖 Start reading</button>
                <button onClick={skipSuggestion} className="btn-skip">Skip</button>
              </div>
            </div>
          )}

          {/* Add book form */}
          {showForm && !editingId && (
            <div className="form-panel">
              <BookForm form={form} setForm={setForm} onSave={saveBook} onCancel={() => setShowForm(false)} saving={saving} title="Add a book" />
            </div>
          )}

          {/* Search & sort */}
          <div className="search-sort-bar">
            <input
              className="search-input"
              placeholder="Search by title or author…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {tab !== 'hof' && (
              <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                <option value="default">Sort: Default</option>
                <option value="title">Title A–Z</option>
                <option value="rating">Rating ↓</option>
                <option value="duration">Reading time ↑</option>
              </select>
            )}
          </div>

          {/* Hall of Fame */}
          {tab === 'hof' && (
            filteredHofBooks.length === 0 ? (
              <div className="empty">
                <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
                {searchQuery ? (
                  <p style={{ fontSize: 16, fontFamily: 'Lora, serif', fontWeight: 600, color: 'var(--text2)' }}>No matches for &ldquo;{searchQuery}&rdquo;</p>
                ) : (
                  <>
                    <p style={{ fontSize: 16, fontFamily: 'Lora, serif', fontWeight: 600, color: 'var(--text2)' }}>No 5-star books yet</p>
                    <p style={{ fontSize: 14, marginTop: 8 }}>Rate a finished book 5 stars and it will appear here</p>
                  </>
                )}
              </div>
            ) : (
              <div className="hof-grid">
                {filteredHofBooks.map(b => {
                  const days = b.start_date && b.end_date ? daysBetween(b.start_date, b.end_date) : null
                  return (
                    <div key={b.id} className="hof-cover">
                      {b.cover_url
                        ? <img src={b.cover_url} alt={b.title} />
                        : <div className="hof-fb"><div style={{ width: 6, height: '50%', borderRadius: 3, background: colorFor(b.title) }} /></div>
                      }
                      <div className="hof-ov">
                        <div style={{ fontFamily: 'Lora, serif', fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.3 }}>{b.title}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{b.author}</div>
                        {days && <div style={{ marginTop: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'white', fontWeight: 500 }}>{days} day{days !== 1 ? 's' : ''} to read</div>}
                        <div style={{ color: '#F5C842', fontSize: 14, marginTop: 2 }}>★★★★★</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Book list */}
          {tab !== 'hof' && (
            loading ? <div className="empty">Loading your books…</div>
            : displayed.length === 0 ? (
              <div className="empty">
                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>📭</div>
                <p>{searchQuery ? `No results for "${searchQuery}"` : selectedYear ? `No books started in ${selectedYear}` : 'No books here yet'}</p>
              </div>
            ) : (() => {
              const groups: [string, Book[]][] = tab === 'all'
                ? [['Currently reading', displayed.filter(b => b.status === 'reading')], ['Finished', displayed.filter(b => b.status === 'read')], ['Want to read', displayed.filter(b => b.status === 'want')]]
                : [['', displayed]]

              const inlineForm = (
                <div className="inline-form">
                  <BookForm form={form} setForm={setForm} onSave={saveBook} onCancel={() => setEditingId(null)} saving={saving} title="Edit book" />
                </div>
              )

              return groups.filter(([, items]) => items.length > 0).map(([label, items]) => (
                <div key={label || 'group'}>
                  {label && <div className="section-hd">{label}</div>}
                  <div className="book-grid">
                    {items.map(b => {
                      const color = colorFor(b.title)
                      const isEd  = editingId === b.id
                      let meta = ''
                      if (b.status === 'read' && b.start_date && b.end_date) meta = `${daysBetween(b.start_date, b.end_date)} days`
                      else if (b.status === 'reading' && b.start_date) meta = `${daysBetween(b.start_date)}d in`
                      const bgMap:    Record<string,string> = { read: 'var(--accent-light)', reading: 'var(--blue-light)', want: 'var(--amber-light)' }
                      const colorMap: Record<string,string> = { read: 'var(--accent)',       reading: 'var(--blue)',       want: 'var(--amber)' }
                      const txtMap:   Record<string,string> = { read: '✓ Read',              reading: '● Reading',         want: '🔖 Want' }
                      return (
                        <React.Fragment key={b.id}>
                          <div className={`book-card${isEd ? ' ed' : ''}`}>
                            <div className="book-cover">
                              {b.cover_url
                                ? <img src={b.cover_url} alt={b.title} />
                                : <div className="book-cover-fb"><div style={{ width: 6, height: '60%', borderRadius: 3, background: color }} /></div>
                              }
                              {tab === 'all' && <span className="book-badge" style={{ background: bgMap[b.status], color: colorMap[b.status] }}>{txtMap[b.status]}</span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="book-title">{b.title}</div>
                              <div className="book-author">{b.author}</div>
                              <div className="book-meta">
                                {b.genre && <span className="genre-pill">{b.genre}</span>}
                                {meta && <span>{meta}</span>}
                                {b.rating && <span style={{ color: 'var(--amber)' }}>{'★'.repeat(b.rating)}</span>}
                              </div>
                            </div>
                            <div className="book-btns">
                              <button onClick={() => openForm(b)} className={`icon-btn${isEd ? ' on' : ''}`} title="Edit">✎</button>
                              <button onClick={() => setDeletingId(b.id)} className="icon-btn" title="Remove">✕</button>
                            </div>
                          </div>
                          {isEd && inlineForm}
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
          <div onClick={e => { if (e.target === e.currentTarget) setDeletingId(null) }} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,14,6,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(40,28,10,0.12)' }}>
              <h3 style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 600, marginBottom: '0.75rem' }}>Remove this book?</h3>
              <p style={{ fontSize: 14, color: 'var(--text2)' }}>This will permanently remove <strong>{books.find(b => b.id === deletingId)?.title}</strong> from your list.</p>
              <div style={{ marginTop: '1.25rem', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button onClick={() => setDeletingId(null)} className="btn-cancel">Cancel</button>
                <button onClick={deleteBook} style={{ background: 'var(--red)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Remove</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
