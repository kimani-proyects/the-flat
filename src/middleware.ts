import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;

  /**
   * 🔐 BLOQUEO DE ACCESO (tu control personal)
   */
  const ACCESS_KEY = process.env.ACCESS_KEY;
  const key = url.searchParams.get('key');

  // Si hay ACCESS_KEY configurada, forzar acceso
  if (ACCESS_KEY) {
    // permitir bypass SOLO si viene con key correcta
    const isAllowed = key === ACCESS_KEY;

    if (!isAllowed) {
      return new NextResponse('🔒 Acceso restringido', { status: 403 });
    }
  }

  /**
   * 🧪 DEV MODE fallback (tu lógica existente)
   */
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }

  /**
   * 🔁 Supabase middleware normal
   */
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};