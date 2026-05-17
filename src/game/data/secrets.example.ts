/**
 * S2.7 — SECRETS (template público).
 *
 * IMPORTANTE: este archivo es la PLANTILLA. NO contiene datos reales.
 * Para usar el serial real:
 *
 *   1. cp src/game/data/secrets.example.ts src/game/data/secrets.local.ts
 *   2. Edita `secrets.local.ts` con tu serial real (16 caracteres del
 *      Tomodachi Life de la Switch — Nintendo eShop key format
 *      XXXX-XXXX-XXXX-XXXX).
 *   3. `secrets.local.ts` está en .gitignore — NUNCA se commitea.
 *
 * Si NO existe `secrets.local.ts`, el juego usa el placeholder de abajo
 * y María verá "DEMO-DEMO-DEMO-DEMO" en lugar del serial real (avisaríamos
 * que se ha olvidado configurarlo en consola).
 */
export const TOMODACHI_SWITCH_SERIAL = 'DEMO-DEMO-DEMO-DEMO';

/**
 * El serial se traduce a Morse para que María lo descifre. La traducción
 * la calcula el código en runtime — no hace falta tocar nada más.
 */
