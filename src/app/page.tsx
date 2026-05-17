import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight text-flat-accent">
            THE FLAT
          </h1>
          <p className="text-sm uppercase tracking-[0.4em] text-flat-secondary">
            Keep it Cutre
          </p>
        </div>

        <p className="text-base text-flat-ink/80">
          Un regalo de cumpleaños para María. <br />
          Hecho con cariño — y bastante pixel art.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/game"
            className="rounded-md border border-flat-accent bg-flat-accent/10 px-6 py-3 font-medium transition hover:bg-flat-accent/20"
          >
            Entrar al piso →
          </Link>
          <Link
            href="/admin"
            className="rounded-md border border-flat-ink/20 px-6 py-3 text-sm text-flat-ink/70 transition hover:border-flat-ink/40 hover:text-flat-ink"
          >
            Panel admin (Alex)
          </Link>
        </div>

        <p className="pt-6 text-xs text-flat-ink/40">
          Sevilla · 2026 · Next.js + Phaser 3 + Supabase
        </p>

        <p className="text-[10px] uppercase tracking-[0.3em] text-flat-ink/25">
          <Link href="/inspector" className="hover:text-flat-ink/50">
            dev · sprite inspector
          </Link>
        </p>
      </div>
    </main>
  );
}
