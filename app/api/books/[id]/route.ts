import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sql, fetchCoverUrl } from '@/lib/db'
import { getSession } from '@/lib/session'

const bookSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  status: z.enum(['want', 'reading', 'read']).optional(),
  genre: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = bookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const current = await sql`
    SELECT title, author, status, genre, start_date, end_date, rating, notes, cover_url
    FROM books WHERE id = ${id} AND user_id = ${session.userId}
  `
  if (current.rows.length === 0) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  const cur = current.rows[0]
  const d = parsed.data

  const title      = d.title      !== undefined ? d.title      : cur.title
  const author     = d.author     !== undefined ? d.author     : cur.author
  const status     = d.status     !== undefined ? d.status     : cur.status
  const genre      = d.genre      !== undefined ? d.genre      : cur.genre
  const start_date = d.start_date !== undefined ? d.start_date : cur.start_date
  const end_date   = d.end_date   !== undefined ? d.end_date   : cur.end_date
  const rating     = d.rating     !== undefined ? d.rating     : cur.rating
  const notes      = d.notes      !== undefined ? d.notes      : cur.notes

  // Re-fetch cover if title or author changed, or if there's no cover yet
  const titleChanged  = d.title  !== undefined && d.title  !== cur.title
  const authorChanged = d.author !== undefined && d.author !== cur.author
  let cover_url = cur.cover_url
  if (titleChanged || authorChanged || !cover_url) {
    cover_url = await fetchCoverUrl(title, author)
  }

  const result = await sql`
    UPDATE books SET
      title      = ${title},
      author     = ${author},
      status     = ${status},
      genre      = ${genre},
      start_date = ${start_date},
      end_date   = ${end_date},
      rating     = ${rating},
      notes      = ${notes},
      cover_url  = ${cover_url}
    WHERE id = ${id} AND user_id = ${session.userId}
    RETURNING id, title, author, status, genre,
              to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(end_date,   'YYYY-MM-DD') AS end_date,
              rating, notes, cover_url, created_at
  `
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await sql`DELETE FROM books WHERE id = ${id} AND user_id = ${session.userId}`
  return NextResponse.json({ success: true })
}
