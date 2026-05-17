import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Callback de Supabase Auth (magic link / OAuth).
 * Intercambia el 'code' por una sesión y redirige al 'next' o a /game.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/game';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Si falla, volvemos al login con flag de error.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
