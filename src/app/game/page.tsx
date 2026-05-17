import dynamic from 'next/dynamic';

// Phaser necesita window/document → client-only, nunca SSR.
const PhaserGame = dynamic(() => import('@/components/PhaserGame'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center">
      <p className="text-sm text-flat-ink/60">Cargando el piso...</p>
    </div>
  ),
});

export default function GamePage() {
  return (
    <main className="flex h-screen w-full items-center justify-center bg-black">
      <PhaserGame />
    </main>
  );
}
