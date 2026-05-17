/**
 * Registry de muros bloqueantes — Día 7.5.
 *
 * Una sola fuente de verdad: qué habitaciones empiezan bloqueadas, qué
 * tiles ocupa cada muro, dónde aparece el prompt E, qué minijuego lanza,
 * qué tinte y etiqueta tiene cada uno.
 *
 * Para añadir un muro nuevo (p.ej. la caja fuerte de la habitación
 * secreta): añadir entrada aquí + handler en ./<dir>/<X>Minigame.ts.
 *
 * Coordenadas de tiles tomadas del floorplan.json — verificadas contra
 * las definiciones de `doors`:
 *
 *   - cocina-terraza  → x=14, y=4, dir=v, length=2  → tiles (14,4),(14,5)
 *   - foyer-open-plan → x=15, y=11, dir=h, length=10 → tiles (15..24, 11)
 *   - entrada-bano    → x=14, y=14, dir=v, length=2 → tiles (14,14),(14,15)
 *   - entrada-alex    → x=14, y=26, dir=v, length=2 → tiles (14,26),(14,27)
 *   - entrada-maria   → x=26, y=20, dir=v, length=2 → tiles (26,20),(26,21)
 *
 * El prompt-tile se coloca en la casilla DENTRO de la entrada (la zona
 * accesible) — así la jugadora se acerca al muro desde el lado correcto
 * y aparece la E.
 *
 * Tints: cada muro hereda un color suave de la habitación que esconde,
 * para reforzar visualmente "qué hay detrás" sin spoilear el contenido.
 */

import type { LockedWallDef } from './types';
import { runChocolateMinigame } from './chocolate/ChocolateMinigame';
import { runKnockMinigame } from './knock/KnockMinigame';
import { runRpsMinigame } from './rps/RpsMinigame';
import { runLockpickMinigame } from './lockpick/LockpickMinigame';
import { runStuckDoorMinigame } from './stuckdoor/StuckDoorMinigame';
import { runSecretDoorMinigame } from './secretdoor/SecretDoorMinigame';

export const LOCKED_WALLS: LockedWallDef[] = [
  // ── BAÑO — TOC-TOC ─────────────────────────────────────────────────
  {
    room: 'bano',
    label: 'Baño',
    wallTiles: [
      { x: 14, y: 14 },
      { x: 14, y: 15 },
    ],
    promptAt: { x: 15, y: 14 }, // jugadora en entrada (x>=14 es entrada)
    run: runKnockMinigame,
    tint: 0x3d4a5a, // azul fío baño (color del room)
    signText: 'BAÑO',
  },

  // ── HABITACIÓN DE ALEX — PPT TRUCADO ───────────────────────────────
  {
    room: 'habitacion-alex',
    label: 'Habitación de Alex',
    wallTiles: [
      { x: 14, y: 26 },
      { x: 14, y: 27 },
    ],
    promptAt: { x: 15, y: 26 },
    run: runRpsMinigame,
    tint: 0x4a3d5a, // morado oscuro Alex
    signText: 'ALEX',
  },

  // ── HABITACIÓN DE MARÍA — CHOCOLATE ────────────────────────────────
  {
    room: 'habitacion-maria',
    label: 'Habitación de María',
    wallTiles: [
      { x: 26, y: 20 },
      { x: 26, y: 21 },
    ],
    promptAt: { x: 25, y: 20 }, // jugadora desde entrada (x<=25)
    run: runChocolateMinigame,
    tint: 0x5a3d3d, // rosa apagado María
    signText: 'MARÍA',
  },

  // ── COCINA (arco open-plan) — LOCKPICKING ──────────────────────────
  // El arco es ancho (10 tiles) — pintamos el muro completo. El prompt
  // se coloca en el centro, lado entrada (y=12 está dentro de entrada).
  {
    room: 'cocina',
    label: 'Cocina',
    wallTiles: [
      { x: 15, y: 11 },
      { x: 16, y: 11 },
      { x: 17, y: 11 },
      { x: 18, y: 11 },
      { x: 19, y: 11 },
      { x: 20, y: 11 },
      { x: 21, y: 11 },
      { x: 22, y: 11 },
      { x: 23, y: 11 },
      { x: 24, y: 11 },
    ],
    promptAt: { x: 19, y: 12 },
    run: runLockpickMinigame,
    tint: 0x5a5530, // amarillo mostaza cocina
    signText: 'COCINA',
  },

  // ── TERRAZA (puerta corredera desde cocina) — PUERTA ATASCADA ──────
  // OJO: este muro sólo aparece después de desbloquear la cocina (la
  // terraza es accesible desde la cocina, no desde entrada). Se monta
  // siempre — si la cocina aún no está desbloqueada, la jugadora no
  // puede llegar a él de todas formas, así que no hace daño.
  {
    room: 'terraza',
    label: 'Terraza',
    wallTiles: [
      { x: 14, y: 4 },
      { x: 14, y: 5 },
    ],
    promptAt: { x: 15, y: 4 }, // jugadora desde cocina (x>=15)
    run: runStuckDoorMinigame,
    tint: 0x2d5a4a, // verde apagado terraza
    signText: 'TERRAZA',
  },

  // ── HABITACIÓN SECRETA — check de hatchUnlocked (PC Alex code) ────
  // La puerta está al sur de hab. María (entrada vertical, x=40 y=27/28).
  // El muro se "cae" automáticamente si hatchUnlocked está true (el
  // SecretDoorMinigame lo comprueba); si no, muestra diálogo y aborta.
  {
    room: 'habitacion-secreta',
    label: 'Habitación Secreta',
    wallTiles: [
      { x: 40, y: 27 },
      { x: 40, y: 28 },
    ],
    promptAt: { x: 40, y: 26 }, // jugadora desde hab María (y<=26)
    run: runSecretDoorMinigame,
    tint: 0x4a3520,
    signText: '???',
  },
];

// Re-exports para uso desde scenes.
export { LockedWallSystem } from '../systems/LockedWallSystem';
export type { LockedWallDef, MinigameResult, MinigameContext, MinigameRunner } from './types';
