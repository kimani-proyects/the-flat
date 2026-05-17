import Link from 'next/link';

export default function AdminPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-flat-secondary">
            Panel admin
          </p>
          <h1 className="text-4xl font-bold">Dashboard de Alex</h1>
          <p className="mt-2 text-flat-ink/70">
            Placeholder. Esto se construirá en los días 9–12 del roadmap:
            observación en tiempo real, eventos instantáneos, jumpscares,
            spawn, modificación del mundo.
          </p>
        </div>

        <div className="rounded-lg border border-flat-ink/10 bg-white/5 p-6 text-sm text-flat-ink/70">
          <p className="mb-2 font-medium text-flat-ink">Próximamente:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Minimapa con posición de María en vivo</li>
            <li>Toggle invisible / spawn / despawn</li>
            <li>Eventos instantáneos (luces, sonidos, jumpscares)</li>
            <li>Control de gatos (Haku, Kero, Nala)</li>
            <li>Editor del catálogo de la tienda y recetas</li>
          </ul>
        </div>

        <Link
          href="/"
          className="inline-block text-sm text-flat-ink/60 hover:text-flat-ink"
        >
          ← Volver
        </Link>
      </div>
    </main>
  );
}
