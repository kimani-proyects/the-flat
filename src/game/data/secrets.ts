/**
 * S2.7 — Loader de secretos.
 *
 * Intenta cargar `secrets.local.ts` (no commiteado) primero. Si no
 * existe, usa el placeholder de `secrets.example.ts`. Esto permite a
 * Alex meter el serial real sin que aparezca jamás en Git.
 *
 * IMPORTANTE: por cómo funcionan los imports estáticos de TS, la
 * "carga condicional" se hace via dynamic import wrapped en un módulo
 * intermedio. Ver implementación abajo.
 */

import { TOMODACHI_SWITCH_SERIAL as DEMO_SERIAL } from './secrets.example';

// Esta variable se asigna en build-time. Si secrets.local.ts existe y
// exporta TOMODACHI_SWITCH_SERIAL, se usa; si no, se usa el placeholder.
let realSerial: string | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const local = require('./secrets.local');
  if (local && typeof local.TOMODACHI_SWITCH_SERIAL === 'string') {
    realSerial = local.TOMODACHI_SWITCH_SERIAL;
  }
} catch {
  // No existe secrets.local.ts — fallback al demo.
}

export const TOMODACHI_SERIAL: string = realSerial || DEMO_SERIAL;
export const HAS_REAL_SERIAL = realSerial !== null;

if (typeof window !== 'undefined' && !HAS_REAL_SERIAL) {
  // eslint-disable-next-line no-console
  console.warn(
    '[secrets] usando serial DEMO. Crea src/game/data/secrets.local.ts ' +
    'con el serial real para activar el regalo Tomodachi Life.',
  );
}

/** Convierte texto ASCII a código Morse internacional con barras y slashes. */
export function toMorse(s: string): string {
  const M: Record<string, string> = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
    G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
    M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
    S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
    Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  };
  // S2.8: NUNCA usar '/' para separar palabras. El serial es UNA cadena
  // de 16 caracteres, los espacios separan letras.
  return s.toUpperCase().replace(/[-\s/]/g, '').split('').map((c) => M[c] || '').filter(Boolean).join(' ');
}
