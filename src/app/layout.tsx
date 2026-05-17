import type { Metadata } from 'next';
import './globals.css';

/**
 * Tipografía pixel del juego.
 *
 * It.8.5b retiramos `next/font/google`: hashea el nombre de la familia a
 * algo como `__Silkscreen_abc123`, y entonces `document.fonts.load()` y
 * Phaser (que piden la fuente por el nombre literal `'Silkscreen'`) no
 * la encuentran cargada → fallback a monospace. Por eso María no veía
 * cambio.
 *
 * Solución actual: cargamos Silkscreen directamente via @font-face en
 * globals.css apuntando al CDN público de Google Fonts. Así la fuente
 * queda registrada con el nombre EXACTO `'Silkscreen'` y `document.fonts`
 * la ve. Phaser y CSS la consumen igual.
 */

export const metadata: Metadata = {
  title: 'The Flat',
  description: 'Keep it Cutre — un regalo para María.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/*
         * Silkscreen via Google Fonts CSS link (it.9-pre).
         * El CSS que sirve Google siempre tiene las URLs woff2 frescas
         * (rotación de hashes). Anteriormente declarábamos @font-face
         * con URLs directas (v5) que dieron 404. Esto es estable.
         */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {/*
         * S1.1: EB Garamond para el reader del libro de la librería —
         * tipografía con clase, serif, italic disponible. El resto del
         * juego sigue en Silkscreen pixel.
         */}
        <link
          href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-flat-bg text-flat-ink antialiased">
        {children}
      </body>
    </html>
  );
}
