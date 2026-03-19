import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decryptEdge } from '@/lib/session-edge'

const PUBLIC = ['/login', '/signup', '/api/auth/login', '/api/auth/signup']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC.some(p => pathname.startsWith(p))

  // Don't redirect API routes — let them return 401 naturally
  if (pathname.startsWith('/api/')) return NextResponse.next()

  const token = request.cookies.get('rt_session')?.value
  const session = token ? await decryptEdge(token) : null

  if (!session && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (session && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
