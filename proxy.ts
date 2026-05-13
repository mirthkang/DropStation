import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from './library/session'

// This function can be marked `async` if using `await` inside
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname === '/') {
    return NextResponse.next()
  }
  const session = await getSession()
  if (!session || !session.userId) {
    return NextResponse.redirect(new URL('/signin', request.url))
  }
  return NextResponse.next()
}

// Alternatively, you can use a default export:
export const config = {
  // Exclude API routes, static files, image optimizations, and .png files
  matcher: '/((?!api/upload|api/regenerate|d/[^/]+|signin|signup|_next/static|_next/image|favicon.ico|.*\\.png$).*)'
}
