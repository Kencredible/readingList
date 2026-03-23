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
    const query = encodeURIComponent(`intitle:${title} inauthor:${author}`)
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1&fields=items(volumeInfo/imageLinks)`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const imageLinks = data?.items?.[0]?.volumeInfo?.imageLinks
    if (!imageLinks) return null
    // Prefer higher resolution, fall back to thumbnail
    const url = imageLinks.medium ?? imageLinks.small ?? imageLinks.thumbnail ?? imageLinks.smallThumbnail
    if (!url) return null
    // Force HTTPS and strip zoom/edge curl params for cleaner image
    return url.replace('http://', 'https://').replace('&edge=curl', '')
  } catch {
    return null
  }
}
