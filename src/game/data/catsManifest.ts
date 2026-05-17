import type { CatId } from '../entities/Cat';

/**
 * Manifest de spritesheets de los gatos (Día 9-pre v4 simplificado).
 *
 * - Cada gato tiene `frameSize` default (la mayoría de sus anims).
 * - Cada gato tiene `scale` fijo aplicado a TODAS sus anims (no
 *   recalculado por anim). Más predecible visualmente.
 * - Override por anim (frameSize / startFrame / endFrame) para casos
 *   especiales.
 *
 * Convención naming PNG: `<catId>-<animName>.png` en
 * /public/assets/sprites/cats/.
 *
 * Detección runtime: CatAnimations lee dimensiones reales del PNG y
 * loggea. Si el frameSize del manifest > tamaño imagen, hace skip con
 * warning. Si la imagen no es múltiplo del frameSize, usa floor.
 */

export interface CatAnimSpec {
  frameSize?: number;
  startFrame?: number;
  endFrame?: number;
  frameRate?: number;
  repeat?: number;
}

export interface CatManifestEntry {
  /** Frame size por defecto (casi todas las anims del gato). */
  frameSize: number;
  /** Scale fijo para TODAS las anims del gato (sprite.setScale). */
  scale: number;
  /** Override por anim. */
  anims?: Partial<Record<string, CatAnimSpec>>;
}

export const CANONICAL_ANIMS = [
  'idle',
  'walk',
  'sprint',
  'sleep',
  'playful',
  'sit-idle',
  'attack-left',
  'attack-right',
  'hurt-left',
  'hurt-right',
  'eat',
] as const;
export type CatAnimName = (typeof CANONICAL_ANIMS)[number];

export const DEFAULT_ANIM_PROPS: Record<
  CatAnimName,
  { frameRate: number; repeat: number }
> = {
  idle: { frameRate: 5, repeat: -1 },
  walk: { frameRate: 8, repeat: -1 },
  sprint: { frameRate: 14, repeat: -1 },
  sleep: { frameRate: 3, repeat: -1 },
  playful: { frameRate: 10, repeat: -1 },
  'sit-idle': { frameRate: 4, repeat: -1 },
  'attack-left': { frameRate: 12, repeat: 0 },
  'attack-right': { frameRate: 12, repeat: 0 },
  'hurt-left': { frameRate: 8, repeat: 0 },
  'hurt-right': { frameRate: 8, repeat: 0 },
  eat: { frameRate: 6, repeat: -1 },
};

/**
 * Convención direccional (verificado visualmente):
 *   - Walk/sprint: spritesheet 4×4 = 16 frames, MITAD IZQUIERDA (frames
 *     0-7) son walk-left, MITAD DERECHA (frames 8-15) son walk-right.
 *     Para evitar el "solapado" izq/dcha al loop, usamos sólo la mitad
 *     LEFT (startFrame=0, endFrame=7) y aplicamos flipX en Cat.ts cuando
 *     el gato va hacia la derecha.
 *   - Resto (idle/sleep/sit-idle/eat/playful): los gatos son chibi
 *     simétricos mirando al frente, flipX no se nota.
 *   - attack-left / attack-right ya están en PNGs SEPARADOS, sin mixed.
 */
export const CATS_MANIFEST: Record<CatId, CatManifestEntry> = {
  kero: {
    frameSize: 32,
    scale: 1.0,
    anims: {
      idle: { frameSize: 16 }, // 64×16 — 4 frames horizontales
      walk: { startFrame: 0, endFrame: 7 }, // mitad LEFT
      sprint: { startFrame: 0, endFrame: 7 },
    },
  },
  haku: {
    frameSize: 64,
    scale: 0.5,
    anims: {
      'sit-idle': { startFrame: 3, endFrame: 3 },
      walk: { startFrame: 0, endFrame: 7 },
      sprint: { startFrame: 0, endFrame: 7 },
    },
  },
  nala: {
    frameSize: 64,
    scale: 0.5,
    anims: {
      sleep: { startFrame: 3 },
      idle: { frameSize: 32 },
      walk: { startFrame: 0, endFrame: 7 },
      sprint: { startFrame: 0, endFrame: 7 },
    },
  },
};

/** Frame size efectivo de una anim (override → default). */
export function getAnimFrameSize(catId: CatId, animName: string): number {
  const entry = CATS_MANIFEST[catId];
  if (!entry) return 32;
  const override = entry.anims?.[animName]?.frameSize;
  return override ?? entry.frameSize;
}

/** Scale fijo del gato (mismo para todas sus anims). */
export function getCatScale(catId: CatId): number {
  return CATS_MANIFEST[catId]?.scale ?? 1.0;
}
