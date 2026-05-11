import { NextResponse } from 'next/server'
import { sql, setupDb } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await setupDb()
  const result = await sql`SELECT yearly_goal FROM users WHERE id = ${session.userId}`
  return NextResponse.json({ yearly_goal: result.rows[0]?.yearly_goal ?? null })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await setupDb()
  const { yearly_goal } = await req.json()
  if (yearly_goal !== null && (!Number.isInteger(yearly_goal) || yearly_goal < 1 || yearly_goal > 365)) {
    return NextResponse.json({ error: 'Invalid goal' }, { status: 400 })
  }
  await sql`UPDATE users SET yearly_goal = ${yearly_goal ?? null} WHERE id = ${session.userId}`
  return NextResponse.json({ yearly_goal: yearly_goal ?? null })
}
