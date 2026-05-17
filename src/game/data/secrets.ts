/**
 * S2.7 — Loader de secretos (SAFE FOR VERCEL)
 */

import { TOMODACHI_SWITCH_SERIAL as DEMO_SERIAL } from './secrets.example';

let realSerial: string | null = null;

/**
 * ENV (Vercel / producción)
 */
const envSerial =
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_TOMODACHI_SERIAL ?? null
    : null;

/**
 * LOCAL ONLY (evita romper build en Vercel)
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  try {
    // dynamic require SOLO en browser/dev
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
 * FINAL SERIAL
 */
export const TOMODACHI_SERIAL: string =
  envSerial ?? realSerial ?? DEMO_SERIAL;

export const HAS_REAL_SERIAL =
  Boolean(envSerial || realSerial);

/**
 * Warning dev only
 */
if (typeof window !== 'undefined' && !HAS_REAL_SERIAL) {
  console.warn(
    '[secrets] usando serial DEMO. Configura NEXT_PUBLIC_TOMODACHI_SERIAL en Vercel.',
  );
}

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