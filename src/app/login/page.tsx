'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/game';

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Algo ha fallado. Revisa las credenciales de Supabase en .env.local.',
      );
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-flat-accent">THE FLAT</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-flat-secondary">Acceso</p>
      </div>
      {status === 'sent' ? (
        <div className="rounded-md border border-flat-secondary/30 bg-flat-secondary/5 p-4 text-sm">
          <p className="font-medium text-flat-secondary">Revisa tu email</p>
          <p className="mt-1 text-flat-ink/70">Te he mandado un enlace mágico a <b>{email}</b>. Haz click y entras.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs text-flat-ink/70">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@ejemplo.com"
              className="mt-1 w-full rounded-md border border-flat-ink/20 bg-transparent px-3 py-2 text-sm focus:border-flat-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-md border border-flat-accent bg-flat-accent/10 px-4 py-2 text-sm font-medium transition hover:bg-flat-accent/20 disabled:opacity-50"
          >
            {status === 'sending' ? 'Enviando...' : 'Recibir enlace mágico'}
          </button>
          {errorMsg && (
            <p className="rounded-md border border-flat-warning/30 bg-flat-warning/5 p-3 text-xs text-flat-warning">{errorMsg}</p>
          )}
        </form>
      )}
      <Link href="/" className="block text-center text-xs text-flat-ink/50 hover:text-flat-ink">
        ← Volver
      </Link>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <Suspense fallback={<div className="text-sm text-flat-ink/50">Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
