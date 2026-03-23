import { sql } from '@vercel/postgres'

export { sql }

export async function setupDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'want',
      genre TEXT,
      start_date DATE,
      end_date DATE,
      rating INTEGER,
      notes TEXT,
      cover_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Migrate existing tables that don't have cover_url yet
  await sql`
    ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url TEXT
  `
}

export async function fetchCoverUrl(title: string, author: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${query}&fields=cover_i&limit=1`, {
      next: { revalidate: 86400 }, // cache for 24h
    })
    if (!res.ok) return null
    const data = await res.json()
    const coverId = data?.docs?.[0]?.cover_i
    if (!coverId) return null
    return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
  } catch {
    return null
  }
}
