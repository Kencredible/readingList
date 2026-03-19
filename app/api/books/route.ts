import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sql, setupDb } from '@/lib/db'
import { getSession } from '@/lib/session'

const bookSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  status: z.enum(['want', 'reading', 'read']),
  genre: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await setupDb()
  const result = await sql`
    SELECT id, title, author, status, genre,
           to_char(start_date, 'YYYY-MM-DD') AS start_date,
           to_char(end_date,   'YYYY-MM-DD') AS end_date,
           rating, notes, created_at
    FROM books
    WHERE user_id = ${session.userId}
    ORDER BY created_at DESC
  `
  return NextResponse.json(result.rows)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await setupDb()
  const body = await req.json()
  const parsed = bookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { title, author, status, genre, start_date, end_date, rating, notes } = parsed.data
  const result = await sql`
    INSERT INTO books (user_id, title, author, status, genre, start_date, end_date, rating, notes)
    VALUES (
      ${session.userId}, ${title}, ${author}, ${status},
      ${genre ?? null}, ${start_date ?? null}, ${end_date ?? null},
      ${rating ?? null}, ${notes ?? null}
    )
    RETURNING id, title, author, status, genre,
              to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(end_date,   'YYYY-MM-DD') AS end_date,
              rating, notes, created_at
  `
  return NextResponse.json(result.rows[0], { status: 201 })
}
