import { useProgressStore } from '@/lib/stores/gameStore';

/**
 * Helper para cooldowns de minijuegos por gato (Día 9).
 *
 * - Minijuegos principales (Wordle, Where's Kero, Rythm Nala): cooldown
 *   24h tras completar (gane o pierda).
 * - Tinder Cat: SIN cooldown (replayability natural por pool grande).
 * - Rythm Nala: cooldown 12h SÓLO si fallas (key "nala-pet-fail").
 *
 * Convención de keys:
 *   - 'haku-wordle' → 24h tras jugar
 *   - 'kero-search' → 24h tras jugar
 *   - 'nala-pet'    → controlado por nalaPetFailAtMs (12h si fallo)
 */

const COOLDOWN_24H_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_12H_MS = 12 * 60 * 60 * 1000;

/** ¿Se puede jugar el minijuego principal del gato? (cooldown 24h). */
export function canPlayMinigame(key: string): boolean {
  const last = useProgressStore.getState().lastMinigameAtMs[key] ?? 0;
  return Date.now() - last >= COOLDOWN_24H_MS;
}

/** Marca el minijuego como jugado (resetea el cooldown). */
export function markMinigamePlayed(key: string): void {
  useProgressStore.getState().markMinigamePlayed(key);
}

/** ¿Se puede jugar el rythm de Nala? (12h tras fallo). */
export function canPlayNalaPet(): boolean {
  const last = useProgressStore.getState().nalaPetFailAtMs;
  if (last === 0) return true;
  return Date.now() - last >= COOLDOWN_12H_MS;
}

/** Marca fallo en rythm Nala. */
export function markNalaPetFail(): void {
  useProgressStore.getState().markNalaPetFail();
}

/**
 * Devuelve un mensaje human-readable de cuánto falta para volver a
 * jugar. Para mostrar en menú gato cuando está bloqueado.
 */
export function cooldownLabel(key: string): string | null {
  const last = useProgressStore.getState().lastMinigameAtMs[key] ?? 0;
  if (last === 0) return null;
  const remaining = COOLDOWN_24H_MS - (Date.now() - last);
  if (remaining <= 0) return null;
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `vuelve en ${hours}h ${mins}m`;
  return `vuelve en ${mins}m`;
}

/** Cooldown label para Nala pet. */
export function nalaPetCooldownLabel(): string | null {
  const last = useProgressStore.getState().nalaPetFailAtMs;
  if (last === 0) return null;
  const remaining = COOLDOWN_12H_MS - (Date.now() - last);
  if (remaining <= 0) return null;
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `vuelve en ${hours}h ${mins}m`;
  return `vuelve en ${mins}m`;
}

/** Día de hoy en formato YYYY-MM-DD (para Wordle daily). */
export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}
