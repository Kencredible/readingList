import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { sql, setupDb } from '@/lib/db'
import { createSession } from '@/lib/session'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: Request) {
  try {
    await setupDb()
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { name, email, password } = parsed.data

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const result = await sql`
      INSERT INTO users (name, email, password) VALUES (${name}, ${email}, ${hashed})
      RETURNING id, name, email
    `
    const user = result.rows[0]
    await createSession({ userId: user.id, email: user.email, name: user.name })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
