export type Book = {
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

const COLORS = ['#2D5A3D','#2B4FA0','#9B4A1A','#6B3A8F','#1A6B6B','#7A3535','#4A6B1A','#2A5A7A']

export function hashOf(t: string) {
  let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF
  return h
}
export function colorFor(t: string) {
  return COLORS[hashOf(t) % COLORS.length]
}
export function daysBetween(d1: string, d2?: string) {
  return Math.max(1, Math.round((new Date(d2 || Date.now()).getTime() - new Date(d1).getTime()) / 86400000))
}
