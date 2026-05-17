/**
 * S2.7 — Loader de secretos (SAFE FOR VERCEL)
 */

import { TOMODACHI_SWITCH_SERIAL as DEMO_SERIAL } from './secrets.example';

/**
 * ENV (Vercel / producción)
 */
const envSerial =
  process.env.NEXT_PUBLIC_TOMODACHI_SERIAL ?? null;

/**
 * LOCAL ONLY (solo dev)
 */
let realSerial: string | null = null;

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const local = require('./secrets.local');

    if (local?.TOMODACHI_SWITCH_SERIAL) {
      realSerial = local.TOMODACHI_SWITCH_SERIAL;
    }
  } catch {
    // ignore
  }
}

/**
 * SERIAL FINAL
 * PRIORIDAD:
 * 1. Vercel (PROD)
 * 2. Local dev
 * 3. Demo (solo si NO hay otra opción)
 */
export const TOMODACHI_SERIAL: string =
  envSerial ?? realSerial ?? DEMO_SERIAL;

export const HAS_REAL_SERIAL = Boolean(envSerial || realSerial);

/**
 * Warning SOLO dev
 */
if (typeof window !== 'undefined' && !envSerial && process.env.NODE_ENV === 'development') {
  console.warn(
    '[secrets] usando DEMO serial. Falta NEXT_PUBLIC_TOMODACHI_SERIAL en Vercel o .env.local',
  );
}

/**
 * 🎮 MORSE GAME
 * SIEMPRE se genera desde el serial activo (Vercel o fallback)
 */
const MORSE_SOURCE = TOMODACHI_SERIAL;

/** Convierte texto ASCII a código Morse internacional */
export function toMorse(s: string): string {
  const M: Record<string, string> = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
    G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
    M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
    S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
    Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.',
  };

  return s
    .toUpperCase()
    .replace(/[-\s/]/g, '')
    .split('')
    .map((c) => M[c] || '')
    .filter(Boolean)
    .join(' ');
}

/**
 * 🔥 MORSECODE DEL JUEGO
 * SIEMPRE basado en Vercel → esto es lo importante
 */
export const MORSE_CODE_GAME = toMorse(MORSE_SOURCE);