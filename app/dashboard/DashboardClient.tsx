'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBook, faBookOpenReader, faCircleCheck, faBookmark, faTrophy, faSun, faMoon, faArrowRightFromBracket,
  faAnglesLeft, faAnglesRight, faBars, faMagnifyingGlass, faXmark, faPlus, faCheck,
} from '@fortawesome/free-solid-svg-icons'
import Modal, { ModalExit } from './Modal'
import { Book, colorFor, daysBetween } from './bookUtils'
import BookCarousel from './BookCarousel'
import BookGrid from './BookGrid'
import HallOfFame from './HallOfFame'
import ViewFlight, { measureBooks, View } from './ViewFlight'

type Tab = 'all' | 'reading' | 'read' | 'want' | 'hof'

const emptyForm = { title: '', author: '', status: 'want' as Book['status'], genre: '', start_date: '', end_date: '', rating: '', notes: '' }

function FormGroup({ label, id, full, children }: { label: string; id: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`form-group${full ? ' full' : ''}`}>
      <label className="form-label" htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

function BookForm({ form, setForm, onSave, onCancel, saving, saved, error, submitLabel }: {
  form: typeof emptyForm
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>
  onSave: () => void
  onCancel: () => void
  saving: boolean
  saved: boolean
  error: string | null
  submitLabel: string
}) {
  return (
    <form onSubmit={e => { e.preventDefault(); if (!saving && !saved) onSave() }} noValidate>
      <div className="form-grid">
        <FormGroup label="Title *" id="bf-title" full><input id="bf-title" data-autofocus className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Book title" aria-required="true" /></FormGroup>
        <FormGroup label="Author *" id="bf-author" full><input id="bf-author" className="input" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="Author name" aria-required="true" /></FormGroup>
        <FormGroup label="Status" id="bf-status">
          <select id="bf-status" className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Book['status'] }))}>
            <option value="want">Want to read</option>
            <option value="reading">Currently reading</option>
            <option value="read">Finished</option>
          </select>
        </FormGroup>
        <FormGroup label="Genre" id="bf-genre"><input id="bf-genre" className="input" value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder="e.g. Fiction…" /></FormGroup>
        {(form.status === 'reading' || form.status === 'read') && (
          <FormGroup label="Date started" id="bf-start"><input id="bf-start" type="date" className="input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></FormGroup>
        )}
        {form.status === 'read' && (
          <FormGroup label="Date finished" id="bf-end"><input id="bf-end" type="date" className="input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></FormGroup>
        )}
        {form.status === 'read' && (
          <FormGroup label="Rating" id="bf-rating">
            <select id="bf-rating" className="input" value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}>
              <option value="">No rating</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)} {['Poor','Fair','Good','Great','Excellent'][n-1]}</option>)}
            </select>
          </FormGroup>
        )}
        <FormGroup label="Notes" id="bf-notes" full>
          <textarea id="bf-notes" className="input textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Thoughts, quotes…" />
        </FormGroup>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" onClick={onCancel} className="btn-cancel">Cancel</button>
        <button type="submit" disabled={saving} className={`btn-save${saved ? ' saved' : ''}`}>
          {saved ? <><FontAwesomeIcon icon={faCheck} /> Saved</> : saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
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
  const [formClosing, setFormClosing] = useState<ModalExit | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [deleteClosing, setDeleteClosing] = useState<ModalExit | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [openRequest, setOpenRequest] = useState<{ id: number; nonce: number } | null>(null)
  const [view, setView] = useState<View>('carousel')
  const [flight, setFlight] = useState<{ key: number; to: View; from: ReturnType<typeof measureBooks> } | null>(null)
  const viewRootRef = useRef<HTMLDivElement>(null)
  const lastCarouselId = useRef<number | null>(null)   // so coming back from the grid faces the same book

  useEffect(() => {
    try {
      const v = localStorage.getItem('bookView')
      if (v === 'grid' || v === 'carousel') setView(v)
    } catch { /* storage unavailable */ }
  }, [])

  function switchView(next: View) {
    if (next === view || flight) return
    try { localStorage.setItem('bookView', next) } catch { /* storage unavailable */ }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduce && viewRootRef.current) {
      setFlight({ key: Date.now(), to: next, from: measureBooks(viewRootRef.current) })
    }
    setView(next)
  }

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

  function toggleDark(e?: React.MouseEvent<HTMLElement>) {
    const next = !isDark
    const root = document.documentElement
    const apply = () => {
      flushSync(() => setIsDark(next))
      root.setAttribute('data-theme', next ? 'dark' : 'light')
      try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch { /* storage unavailable */ }
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return }

    const vt = (document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } }).startViewTransition
    if (!vt) {
      // No View Transitions: cross-fade every colour instead
      root.classList.add('theme-fade')
      apply()
      window.setTimeout(() => root.classList.remove('theme-fade'), 450)
      return
    }
    // Light → dark: the dark theme spreads out in a circle from the button.
    // Dark → light: the exact reverse — the dark theme shrinks back into the button, uncovering light.
    const r = e?.currentTarget.getBoundingClientRect()
    const x = r ? r.left + r.width / 2 : window.innerWidth / 2
    const y = r ? r.top + r.height / 2 : window.innerHeight / 2
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const small = `circle(0px at ${x}px ${y}px)`, full = `circle(${radius}px at ${x}px ${y}px)`
    if (!next) root.classList.add('theme-reverse')   // keeps the old (dark) snapshot on top so it can shrink away
    const t = vt.call(document, apply)
    t.ready.then(() => {
      root.animate(
        { clipPath: next ? [small, full] : [full, small] },
        next
          ? { duration: 600, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
          : { duration: 600, easing: 'cubic-bezier(0.8, 0, 0.6, 1)', pseudoElement: '::view-transition-old(root)' },   // mirrored easing
      )
    }).catch(() => {})
    t.finished.finally(() => root.classList.remove('theme-reverse'))
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

  const formOpen = showForm || editingId !== null

  function openForm(book?: Book) {
    if (formOpen) return
    setFormError(null); setSavedFlash(false); setFormClosing(null)
    if (book) {
      setEditingId(book.id)
      setForm({ title: book.title, author: book.author, status: book.status, genre: book.genre ?? '', start_date: book.start_date ?? '', end_date: book.end_date ?? '', rating: book.rating?.toString() ?? '', notes: book.notes ?? '' })
    } else {
      setShowForm(true)
      setForm(emptyForm)
    }
  }

  function dismissForm() { if (!saving && !formClosing) setFormClosing('dismiss') }

  function onFormExited() {
    setShowForm(false); setEditingId(null); setFormClosing(null); setSavedFlash(false); setFormError(null)
  }

  async function saveBook() {
    if (!form.title.trim() || !form.author.trim()) { setFormError('Please enter a title and an author.'); return }
    setFormError(null)
    setSaving(true)
    const payload = { title: form.title, author: form.author, status: form.status, genre: form.genre || null, start_date: form.start_date || null, end_date: form.end_date || null, rating: form.rating ? parseInt(form.rating) : null, notes: form.notes || null }
    try {
      const res = await fetch(editingId ? `/api/books/${editingId}` : '/api/books', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error()
    } catch {
      setSaving(false)
      setFormError("Couldn't save the book. Please try again.")
      return
    }
    setSaving(false)
    fetchBooks()
    // Show the tick for a moment, then the modal lifts away
    setSavedFlash(true)
    window.setTimeout(() => setFormClosing('saved'), 420)
  }

  async function deleteBook() {
    if (!deletingId || deleteBusy) return
    setDeleteBusy(true)
    await fetch(`/api/books/${deletingId}`, { method: 'DELETE' })
    setDeleteBusy(false)
    fetchBooks()
    setDeleteClosing('saved')
  }

  function openSearch() {
    setSearchOpen(true)
    // focus once the field has started expanding
    window.setTimeout(() => searchInputRef.current?.focus(), 30)
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function switchTab(t: Tab) {
    setTab(t); setSelectedYear(null); setSearchQuery(''); setSearchOpen(false)
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

  if (sortBy === 'title') displayed = [...displayed].sort((a, b) => a.title.localeCompare(b.title))
  else if (sortBy === 'rating') displayed = [...displayed].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  else if (sortBy === 'duration') displayed = [...displayed].sort((a, b) => {
    const da = a.start_date && a.end_date ? daysBetween(a.start_date, a.end_date) : Infinity
    const db = b.start_date && b.end_date ? daysBetween(b.start_date, b.end_date) : Infinity
    return da - db
  })

  // On the All tab, keep the old grouping as the ring order: reading → finished → wishlist
  const carouselBooks = tab === 'all' && sortBy === 'default'
    ? (['reading', 'read', 'want'] as const).flatMap(st => displayed.filter(b => b.status === st))
    : displayed

  // Search doesn't filter the ring — it spins it to the best match as you type
  const q = searchQuery.trim().toLowerCase()
  const seekBook = q && view === 'carousel'
    ? carouselBooks.find(b => b.title.toLowerCase().startsWith(q))
      ?? carouselBooks.find(b => b.title.toLowerCase().includes(q))
      ?? carouselBooks.find(b => b.author.toLowerCase().includes(q))
    : undefined

  const gridBooks = q ? displayed.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)) : displayed

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

  const SW = sidebarOpen ? 240 : 72

  return (
    <>
      <style>{`
        .layout { display: flex; min-height: 100vh; }

        /* ── Sidebar: menu items float on the page, no panel behind them ── */
        .sidebar {
          width: 240px; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0;
          z-index: 20; transition: width 0.22s ease; overflow: hidden; background: transparent;
        }
        .sidebar.collapsed { width: 72px; }

        .sidebar-top {
          min-height: 76px; padding: 0 1rem 0 1.5rem;
          display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-shrink: 0;
        }
        .sidebar.collapsed .sidebar-top { padding: 0; justify-content: center; }

        .logo-text {
          font-family: 'Lora', serif; font-size: 17px; font-weight: 600; color: var(--text);
          line-height: 1.25; white-space: nowrap; overflow: hidden; flex: 1;
        }
        .logo-text em { font-style: italic; color: var(--accent); font-size: inherit; }

        .toggle-btn {
          flex-shrink: 0; width: 30px; height: 30px; border-radius: 8px;
          border: 1px solid var(--border-strong); background: transparent;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 11px; color: var(--text2); transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .toggle-btn:hover { background: var(--surface); color: var(--accent); border-color: var(--accent); }

        .sidebar-nav { flex: 1; padding: 0.5rem 0.875rem; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 4px; }
        .sidebar.collapsed .sidebar-nav { padding: 0.5rem 0.75rem; }

        .nav-btn, .signout-btn {
          display: flex; align-items: center; gap: 12px; padding: 10px 14px; justify-content: flex-start;
          border-radius: 12px; border: 1px solid transparent; width: 100%; cursor: pointer; background: none;
          font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--text2);
          white-space: nowrap; position: relative;
          transition: background 0.18s, color 0.18s, box-shadow 0.18s, border-color 0.18s;
        }
        .sidebar.collapsed .nav-btn, .sidebar.collapsed .signout-btn { justify-content: center; padding: 10px 0; }
        /* Hover: a soft pill lifts in behind the item */
        .nav-btn:hover, .signout-btn:hover { background: var(--nav-hover); color: var(--text); box-shadow: 0 1px 3px rgba(40,28,10,0.08); }
        /* Selected: raised pill, accent text, heavier weight and an accent bar, so it never relies on colour alone */
        .nav-btn.active {
          background: var(--nav-active); color: var(--accent); font-weight: 600;
          border-color: var(--nav-active-border); box-shadow: 0 6px 18px rgba(40,28,10,0.10);
        }
        .nav-btn.active::before {
          content: ''; position: absolute; left: 5px; top: 28%; bottom: 28%; width: 3px; border-radius: 3px; background: var(--accent);
        }
        .nav-btn:focus-visible, .signout-btn:focus-visible, .toggle-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

        .nav-icon { font-size: 16px; width: 20px; display: inline-flex; justify-content: center; flex-shrink: 0; line-height: 1; }
        .nav-icon svg { width: 16px; height: 16px; }

        .sidebar.collapsed { overflow: visible; }
        .sidebar.collapsed .sidebar-nav { overflow: visible; }
        /* Hidden label/count still count towards flex gaps, so drop the gap or the icon sits off-centre */
        .sidebar.collapsed .nav-btn, .sidebar.collapsed .signout-btn { width: 44px; height: 44px; padding: 0; margin: 0 auto; gap: 0; }
        .sidebar.collapsed .nav-btn.active::before { left: -14px; top: 11px; bottom: 11px; width: 4px; border-radius: 0 4px 4px 0; }

        .nav-label, .signout-label {
          overflow: hidden; opacity: 1; max-width: 130px;
          transition: opacity 0.15s, max-width 0.22s;
        }
        .sidebar.collapsed .nav-label, .sidebar.collapsed .signout-label { opacity: 0; max-width: 0; }

        .nav-count {
          margin-left: auto; font-size: 11px; padding: 2px 8px; border-radius: 20px;
          font-weight: 500; flex-shrink: 0; opacity: 1; transition: opacity 0.15s;
          background: var(--surface2); color: var(--text2);
        }
        .sidebar.collapsed .nav-count { opacity: 0; width: 0; padding: 0; margin: 0; overflow: hidden; }
        .nav-btn.active .nav-count { background: var(--accent); color: var(--on-accent); }

        .nav-tooltip {
          display: none; position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%);
          background: var(--text); color: var(--bg); font-size: 12px; font-weight: 400; padding: 5px 10px; border-radius: 6px;
          white-space: nowrap; pointer-events: none; z-index: 200;
        }
        .sidebar.collapsed .nav-btn:hover .nav-tooltip, .sidebar.collapsed .signout-btn:hover .nav-tooltip { display: block; }

        .nav-divider { height: 1px; background: var(--border2); margin: 8px 14px; }
        .sidebar.collapsed .nav-divider { margin: 8px 10px; }

        .sidebar-bottom { padding: 0.75rem 0.875rem 1rem; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; }
        .sidebar.collapsed .sidebar-bottom { padding: 0.75rem; }

        .sidebar-user {
          font-size: 12px; color: var(--text2); padding: 4px 14px 6px;
          white-space: nowrap; overflow: hidden;
        }

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
        .hamburger { width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface2); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; flex-shrink: 0; color: var(--text2); }

        /* ── Main ── */
        .main { flex: 1; padding: 2.5rem 2.5rem 4rem; min-width: 0; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; gap: 12px; flex-wrap: wrap; }
        .page-header h2 { font-family: 'Lora', serif; font-size: 26px; font-weight: 600; }
        .page-header p { font-size: 14px; color: var(--text3); margin-top: 3px; }
        .add-btn { display: flex; align-items: center; gap: 8px; background: var(--accent); color: var(--on-accent); border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; box-shadow: 0 2px 8px rgba(45,90,61,0.3); white-space: nowrap; flex-shrink: 0; }
        .add-btn:hover { background: var(--accent-hover); }

        /* ── Stats ── */
        .stats-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 2rem; }
        .stat-card { border-radius: 16px; padding: 16px 18px; box-shadow: 0 2px 12px rgba(40,28,10,0.08); }
        .stat-card.n { background: var(--surface); border: 1px solid var(--border); }
        .stat-card.h { background: var(--accent); border: 1px solid var(--accent); }
        .stat-lbl { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .stat-card.n .stat-lbl { color: var(--text3); }
        .stat-card.h .stat-lbl { color: color-mix(in srgb, var(--on-accent) 85%, transparent); }
        .stat-val { font-family: 'Lora', serif; font-size: 28px; font-weight: 600; line-height: 1; }
        .stat-card.n .stat-val { color: var(--text); }
        .stat-card.h .stat-val { color: var(--on-accent); }
        .stat-s { font-size: 12px; margin-top: 4px; }
        .stat-card.n .stat-s { color: var(--text3); }
        .stat-card.h .stat-s { color: color-mix(in srgb, var(--on-accent) 85%, transparent); }

        /* ── Year filter ── */
        .year-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .year-lbl { font-size: 12px; color: var(--text3); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .year-pill { border-radius: 20px; padding: 5px 14px; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; border: 1px solid var(--border-strong); transition: all 0.15s; }
        .year-pill.on { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 500; }
        .year-pill:not(.on) { background: none; color: var(--text2); }

        /* ── Suggestion ── */
        .rand-card { background: var(--surface); border: 1.5px solid rgba(193,123,42,0.35); border-radius: 16px; padding: 16px 20px; display: flex; align-items: center; gap: 14px; box-shadow: 0 8px 32px rgba(40,28,10,0.12); margin-bottom: 1.75rem; flex-wrap: wrap; }
        .btn-start { background: var(--accent); color: var(--on-accent); border: none; border-radius: 10px; padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .btn-skip { background: none; color: var(--text2); border: 1px solid var(--border-strong); border-radius: 10px; padding: 8px 14px; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .rand-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }

        /* ── Forms ── */
        .form-error { margin-top: 1rem; font-size: 13px; color: var(--red); background: var(--red-light); border-radius: 8px; padding: 8px 12px; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .form-title { font-family: 'Lora', serif; font-size: 16px; font-weight: 600; margin-bottom: 1.25rem; color: var(--text); }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group.full { grid-column: 1 / -1; }
        .form-label { font-size: 12px; color: var(--text2); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .input { background: var(--surface2); border: 1px solid var(--border-strong); border-radius: 10px; padding: 9px 12px; font-size: 14px; color: var(--text); font-family: 'DM Sans', sans-serif; outline: none; width: 100%; transition: border-color 0.15s; }
        .input:focus { border-color: var(--accent); background: var(--surface); box-shadow: 0 0 0 1px var(--accent); }
        .textarea { resize: vertical; min-height: 70px; }
        .form-actions { display: flex; gap: 10px; margin-top: 1.25rem; flex-wrap: wrap; justify-content: flex-end; }
        .btn-save { background: var(--accent); color: var(--on-accent); border: none; border-radius: 10px; padding: 9px 22px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-save:disabled { cursor: progress; }
        .btn-save { display: inline-flex; align-items: center; gap: 7px; transition: background 0.2s; }
        .btn-save:hover { background: var(--accent-hover); }
        .btn-save.saved { animation: savedPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes savedPop { 0% { transform: scale(0.94); } 60% { transform: scale(1.05); } 100% { transform: none; } }
        .btn-danger { background: var(--red); color: var(--on-red); border: none; border-radius: 10px; padding: 9px 20px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-danger:disabled { cursor: progress; }
        .btn-cancel { background: none; color: var(--text2); border: 1px solid var(--border-strong); border-radius: 10px; padding: 9px 18px; font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }


        /* ── Empty / loading ── */
        .empty { text-align: center; padding: 3rem 1rem; color: var(--text3); }

        /* ── Search & sort ── */
        .search-sort-bar { display: flex; gap: 10px; margin-bottom: 1.25rem; align-items: center; min-height: 40px; }
        .bar-right { display: flex; gap: 10px; align-items: center; margin-left: auto; flex-shrink: 0; }
        .search-wrap { display: flex; align-items: center; gap: 4px; min-width: 0; flex: 0 1 auto; }
        .search-wrap.open { flex: 1 1 auto; }
        .search-btn, .search-clear {
          width: 38px; height: 38px; border-radius: 10px; border: none; background: none; flex-shrink: 0;
          color: var(--text2); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px;
          transition: background 0.15s, color 0.15s;
        }
        .search-btn:hover, .search-clear:hover { background: var(--surface); color: var(--text); }
        .search-wrap.open .search-btn { color: var(--accent); }
        .search-field {
          display: flex; align-items: center; flex: 1; min-width: 0; max-width: 0; opacity: 0; overflow: hidden;
          transition: max-width 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease;
        }
        .search-wrap.open .search-field { max-width: 560px; opacity: 1; }
        .search-input {
          flex: 1; min-width: 0; background: transparent; border: none; border-bottom: 1.5px solid var(--border-strong); border-radius: 0;
          padding: 8px 2px; font-size: 15px; color: var(--text); font-family: 'DM Sans', sans-serif; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .search-input:focus { border-bottom-color: var(--accent); box-shadow: 0 1.5px 0 var(--accent); }
        .search-input::-webkit-search-cancel-button { display: none; }
        .sort-select { background: var(--surface); border: 1px solid var(--border-strong); border-radius: 10px; padding: 9px 12px; font-size: 13px; color: var(--text2); font-family: 'DM Sans', sans-serif; outline: none; cursor: pointer; flex-shrink: 0; }

        /* ── Reading goal ── */
        .goal-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px 20px; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 12px rgba(40,28,10,0.08); flex-wrap: wrap; }
        .goal-info { flex: 1; min-width: 0; }
        .goal-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text3); font-weight: 500; margin-bottom: 8px; }
        .goal-bar-wrap { background: var(--surface2); border-radius: 20px; height: 8px; overflow: hidden; margin-bottom: 6px; }
        .goal-bar-fill { height: 100%; background: var(--accent); border-radius: 20px; transition: width 0.5s ease; }
        .goal-label { font-size: 13px; color: var(--text2); }
        .goal-complete { color: var(--accent); font-weight: 600; }
        .goal-edit-btn { background: none; border: 1px solid var(--border-strong); border-radius: 8px; padding: 7px 14px; font-size: 13px; color: var(--text2); cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; flex-shrink: 0; transition: background 0.15s; }
        .goal-edit-btn:hover { background: var(--surface2); }
        .goal-edit { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
        .goal-input { width: 80px !important; text-align: center; }

        /* ── View toggle: two equal icon buttons with a sliding thumb ── */
        .view-toggle { display: flex; padding: 3px; gap: 2px; background: var(--surface2); border: 1px solid var(--border-strong); border-radius: 11px; flex-shrink: 0; position: relative; }
        .view-toggle-thumb {
          position: absolute; top: 3px; left: 3px; width: 34px; height: 30px; border-radius: 8px;
          background: var(--surface); box-shadow: 0 1px 4px rgba(40,28,10,0.16); transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .view-toggle.grid .view-toggle-thumb { transform: translateX(36px); }
        .view-btn {
          position: relative; z-index: 1; display: flex; align-items: center; justify-content: center;
          width: 34px; height: 30px; padding: 0; border: none; background: none; border-radius: 8px; cursor: pointer;
          color: var(--text3); transition: color 0.2s;
        }
        .view-btn:hover { color: var(--text); }
        .view-btn.on { color: var(--accent); }
        .view-btn svg { width: 16px; height: 16px; }

        /* While books are flying between views, hide the real ones they're standing in for */
        .views.landing-carousel .bc-scene { visibility: hidden; }
        .views.landing-grid .book-cover { visibility: hidden; }
        .views.landing-grid .book-card { animation: cardIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(min(var(--i, 0), 16) * 26ms); }
        @keyframes cardIn { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .mob-bar { display: flex; }
          .sidebar {
            top: 56px;
            width: 260px !important;
            left: -260px;
            transition: left 0.25s ease;
            box-shadow: none;
            background: var(--bg);
          }
          .sidebar.mob-open {
            left: 0;
            box-shadow: 4px 0 24px rgba(20,14,6,0.15);
          }
          .sidebar-top { display: none; }
          .sidebar-nav { padding-top: 1rem; }
          .sidebar.collapsed { width: 260px !important; }
          .sidebar.collapsed .nav-btn, .sidebar.collapsed .signout-btn { justify-content: flex-start; padding: 10px 14px; width: 100%; height: auto; margin: 0; gap: 12px; }
          .sidebar.collapsed .nav-btn.active::before { left: 5px; top: 28%; bottom: 28%; width: 3px; border-radius: 3px; }
          .sidebar.collapsed .nav-tooltip { display: none !important; }
          .sidebar.collapsed .nav-label, .sidebar.collapsed .signout-label { opacity: 1; max-width: 130px; }
          .sidebar.collapsed .nav-count { opacity: 1; width: auto; padding: 2px 8px; margin-left: auto; }
          .sidebar.collapsed .sidebar-top { display: none; }
          .sidebar.collapsed .sidebar-bottom { padding: 0.75rem 0.875rem 1rem; }
          .sidebar.collapsed .nav-divider { margin: 8px 14px; }
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
          .year-pill { padding: 7px 14px; }
          .rand-card { padding: 12px 14px; gap: 10px; }
          .nav-btn { min-height: 44px; }
          .signout-btn { min-height: 44px; }
          .search-sort-bar { flex-wrap: wrap; }
          .search-wrap.open { flex-basis: 100%; order: 2; }
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
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label={sidebarOpen ? 'Close menu' : 'Open menu'} aria-expanded={sidebarOpen}><FontAwesomeIcon icon={sidebarOpen && isMobile ? faXmark : faBars} /></button>
          <h1>my <em>reading</em> list</h1>
          <button onClick={() => openForm()} className="add-btn mobile" style={{ padding: '8px 14px', fontSize: 13 }}><FontAwesomeIcon icon={faPlus} /> Add</button>
        </div>

        {/* Mobile overlay */}
        {isMobile && sidebarOpen && <div className="mob-overlay on" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <nav aria-label="Library" className={`sidebar${!sidebarOpen ? ' collapsed' : ''}${isMobile && sidebarOpen ? ' mob-open' : ''}`}>
          <div className="sidebar-top">
            {sidebarOpen && <div className="logo-text">my <em>reading</em><br />list</div>}
            <button className="toggle-btn" onClick={() => setSidebarOpen(o => !o)} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={sidebarOpen}>
              <FontAwesomeIcon icon={sidebarOpen ? faAnglesLeft : faAnglesRight} />
            </button>
          </div>

          <div className="sidebar-nav">
            {([
              { label: 'All books',    icon: faBook,           t: 'all',     count: books.length },
              { label: 'Reading now',  icon: faBookOpenReader, t: 'reading', count: readingBooks.length },
              { label: 'Finished',     icon: faCircleCheck,    t: 'read',    count: readBooks.length },
              { label: 'Want to read', icon: faBookmark,       t: 'want',    count: wantBooks.length },
            ] as const).map(item => (
              <button key={item.t} className={`nav-btn${tab === item.t ? ' active' : ''}`} onClick={() => switchTab(item.t)} aria-current={tab === item.t ? 'page' : undefined} aria-label={`${item.label}, ${item.count} book${item.count !== 1 ? 's' : ''}`}>
                <span className="nav-icon" aria-hidden><FontAwesomeIcon icon={item.icon} /></span>
                <span className="nav-label">{item.label}</span>
                <span className="nav-count" aria-hidden>{item.count}</span>
                <span className="nav-tooltip" aria-hidden>{item.label}</span>
              </button>
            ))}
            <div className="nav-divider" />
            <button className={`nav-btn${tab === 'hof' ? ' active' : ''}`} onClick={() => switchTab('hof')} aria-current={tab === 'hof' ? 'page' : undefined} aria-label="Hall of Fame">
              <span className="nav-icon" aria-hidden><FontAwesomeIcon icon={faTrophy} /></span>
              <span className="nav-label">Hall of Fame</span>
              <span className="nav-tooltip" aria-hidden>Hall of Fame</span>
            </button>
          </div>

          <div className="sidebar-bottom">
            {sidebarOpen && <div className="sidebar-user">Hi, {userName} 👋</div>}
            <button onClick={e => toggleDark(e)} className="signout-btn" aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              <span className="nav-icon" aria-hidden><FontAwesomeIcon icon={isDark ? faSun : faMoon} /></span>
              <span className="signout-label">{isDark ? 'Light mode' : 'Dark mode'}</span>
              <span className="nav-tooltip" aria-hidden>{isDark ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <button onClick={logout} className="signout-btn" aria-label="Sign out">
              <span className="nav-icon" aria-hidden><FontAwesomeIcon icon={faArrowRightFromBracket} /></span>
              <span className="signout-label">Sign out</span>
              <span className="nav-tooltip" aria-hidden>Sign out</span>
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
            <button onClick={() => openForm()} className="add-btn desktop"><FontAwesomeIcon icon={faPlus} /> Add book</button>
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

          {/* Search & sort */}
          <div className="search-sort-bar">
            <div className={`search-wrap${searchOpen ? ' open' : ''}`} role="search">
              <button
                type="button"
                className="search-btn"
                onClick={() => searchOpen ? searchInputRef.current?.focus() : openSearch()}
                aria-label="Search books"
                aria-expanded={searchOpen}
                aria-controls="book-search"
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} />
              </button>
              <div className="search-field" aria-hidden={!searchOpen}>
                <input
                  id="book-search"
                  ref={searchInputRef}
                  type="search"
                  className="search-input"
                  aria-label={tab === 'hof' || view === 'grid' ? 'Search by title or author' : 'Jump to a book by title or author'}
                  placeholder={tab === 'hof' || view === 'grid' ? 'Search by title or author…' : 'Type a title or author to jump to it…'}
                  value={searchQuery}
                  tabIndex={searchOpen ? 0 : -1}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { e.preventDefault(); closeSearch() }
                    // Enter acts like clicking the highlighted book: open it
                    if (e.key === 'Enter' && view === 'carousel' && seekBook) { e.preventDefault(); setOpenRequest({ id: seekBook.id, nonce: Date.now() }) }
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => { if (!searchQuery.trim()) setSearchOpen(false) }}
                />
                <button type="button" className="search-clear" onClick={closeSearch} aria-label="Close search" tabIndex={searchOpen ? 0 : -1}>
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            </div>
            <div className="bar-right">
            {tab !== 'hof' && (
              <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                <option value="default">Sort: Default</option>
                <option value="title">Title A–Z</option>
                <option value="rating">Rating ↓</option>
                <option value="duration">Reading time ↑</option>
              </select>
            )}
            {tab !== 'hof' && (
              <div className={`view-toggle${view === 'grid' ? ' grid' : ''}`} role="radiogroup" aria-label="Layout">
                <span className="view-toggle-thumb" />
                <button role="radio" aria-checked={view === 'carousel'} className={`view-btn${view === 'carousel' ? ' on' : ''}`} onClick={() => switchView('carousel')} title="Carousel" aria-label="Carousel view">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><ellipse cx="8" cy="9" rx="6.5" ry="3" /><path d="M5 3v6M8 2.5V9M11 3v6" strokeLinecap="round" /></svg>
                </button>
                <button role="radio" aria-checked={view === 'grid'} className={`view-btn${view === 'grid' ? ' on' : ''}`} onClick={() => switchView('grid')} title="Grid" aria-label="Grid view">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
                </button>
              </div>
            )}
            </div>
          </div>
          {tab !== 'hof' && q && !seekBook && displayed.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: '-0.5rem 0 1rem' }}>No books match &ldquo;{searchQuery}&rdquo;</p>
          )}

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
              <HallOfFame books={filteredHofBooks} />
            )
          )}

          {/* Books: carousel or grid */}
          {tab !== 'hof' && (
            loading && books.length === 0 ? <div className="empty">Loading your books…</div>
            : displayed.length === 0 || (view === 'grid' && gridBooks.length === 0) ? (
              <div className="empty">
                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>📭</div>
                <p>{view === 'grid' && q ? `No results for "${searchQuery}"` : selectedYear ? `No books started in ${selectedYear}` : 'No books here yet'}</p>
              </div>
            ) : (
              <div ref={viewRootRef} className={`views${flight ? ` landing-${flight.to}` : ''}`}>
                {view === 'carousel' ? (
                  <>
                    <BookCarousel
                      books={carouselBooks}
                      seekId={seekBook?.id ?? null}
                      openRequest={openRequest}
                      backdrop={selectedYear ?? TAB_LABELS[tab][0]}
                      startId={lastCarouselId.current}
                      settleDelay={flight ? 1250 : 450}
                      onSettle={id => { lastCarouselId.current = id }}
                      onEdit={openForm}
                      onDelete={setDeletingId}
                    />
                  </>
                ) : (
                  <BookGrid
                    books={gridBooks}
                    grouped={tab === 'all'}
                    showBadges={tab === 'all'}
                    editingId={editingId}
                    onEdit={openForm}
                    onDelete={setDeletingId}
                  />
                )}
              </div>
            )
          )}

          {flight && (
            <ViewFlight key={flight.key} books={books} from={flight.from} to={flight.to} targetRoot={viewRootRef} onDone={() => setFlight(null)} />
          )}
        </main>

        {/* Add / edit book */}
        {formOpen && (
          <Modal title={editingId ? 'Edit book' : 'Add a book'} closing={formClosing} onDismiss={dismissForm} onExited={onFormExited}>
            <BookForm
              form={form} setForm={setForm} onSave={saveBook} onCancel={dismissForm}
              saving={saving} saved={savedFlash} error={formError}
              submitLabel={editingId ? 'Save changes' : 'Add book'}
            />
          </Modal>
        )}

        {/* Delete confirmation */}
        {deletingId && (
          <Modal
            title="Remove this book?"
            size="sm"
            closing={deleteClosing}
            onDismiss={() => { if (!deleteBusy && !deleteClosing) setDeleteClosing('dismiss') }}
            onExited={() => { setDeletingId(null); setDeleteClosing(null) }}
          >
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>This will permanently remove <strong style={{ color: 'var(--text)' }}>{books.find(b => b.id === deletingId)?.title}</strong> from your list.</p>
            <div className="form-actions">
              <button type="button" onClick={() => setDeleteClosing('dismiss')} className="btn-cancel" data-autofocus>Cancel</button>
              <button type="button" onClick={deleteBook} className="btn-danger" disabled={deleteBusy}>{deleteBusy ? 'Removing…' : 'Remove'}</button>
            </div>
          </Modal>
        )}
      </div>
    </>
  )
}
