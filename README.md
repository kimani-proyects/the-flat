# The Flat

Un regalo de cumpleaños para María. Juego pixel art top-down cozy con sistema online secreto.
Creado por Alex.

**Lema:** *Keep it Cutre.*

## Stack

- **Next.js 14** (App Router, TypeScript, Tailwind)
- **Phaser 3** (motor de juego, integrado como componente cliente)
- **Supabase** (Auth, PostgreSQL, Realtime, Storage)
- **Zustand** (estado de sesión cliente)
- **Vercel** (hosting)

## Arrancar en local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

> Si es tu primera vez: lee **[SETUP.md](./SETUP.md)**. Te guía en la creación
> del proyecto Supabase y el deploy a Vercel. Sin esos dos pasos, el juego
> arranca igualmente pero sin auth ni persistencia.

## Estructura

```
src/
├── app/                → Routes Next.js (App Router)
│   ├── page.tsx        → Landing
│   ├── game/           → Donde vive Phaser
│   ├── admin/          → Dashboard de Alex
│   ├── login/          → Auth (magic link)
│   └── auth/           → Callbacks de Supabase
├── components/
│   └── PhaserGame.tsx  → Wrapper React del motor
├── game/               → Código Phaser puro
│   ├── config.ts
│   └── scenes/
├── lib/
│   ├── supabase/       → Clientes: browser, server, middleware
│   └── stores/         → Zustand stores
└── middleware.ts       → Protección de rutas + refresh de sesión

public/assets/          → Tilesets, sprites, UI, audio (ver README dentro)
```

## Roadmap (22 días)

El detalle completo está en `CONTEXT.md` y `The_Flat_GDD_v2.pdf`.

- **Semana 1 (Apr 19-27):** Foundations — setup, tilemaps, diálogo, intro, gatos
- **Semana 2 (Apr 28 - May 4):** Core systems — realtime, admin, decoración, clima
- **Semana 3 (May 5-11):** Content & polish — minijuegos, cocina, terraza, audio, deploy final

**Cumpleaños de María: 11 de mayo de 2026.**

## Filosofía

Keep it Cutre. La UI varía según contexto/habitación/minijuego. Texto RPG con retrato
como base, tipografía Project Zomboid para survival, burbujas Animal Crossing para
cozy. La inconsistencia ES el encanto.
