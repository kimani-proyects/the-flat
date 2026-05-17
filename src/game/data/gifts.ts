import type { GiftId } from '@/lib/stores/gameStore';

/**
 * Gifts — registry de los 3 regalos IRL (Día 9).
 *
 * Cada regalo se desbloquea ganando el minijuego de UN gato concreto:
 *   - Haku → Wordle → "cena" (cena en restaurante)
 *   - Kero → Where's Kero → "misterioso" (ticket con código en reverso → PC Alex)
 *   - Nala → Rythm acariciar (perfecto 1ª vez) → "escapada" (escapada fin de semana)
 *
 * Los regalos se canjean desde la app "Regalos" del PC María (Día 9b).
 */

export interface Gift {
  id: GiftId;
  /** Gato que entrega este regalo. */
  source: 'haku' | 'kero' | 'nala';
  /** Título visible en la card. */
  title: string;
  /** Descripción corta. */
  description: string;
  /** Color de acento para la card (hex). */
  accent: string;
  /**
   * Indica si el regalo es "misterioso" — en lugar de canjearse, tiene
   * un código en el reverso. El usuario ve el código y lo usa en el PC
   * de Alex (Día 12 hacking). Sólo Kero.
   */
  mysterious?: boolean;
  /**
   * Código alfanumérico oculto en el reverso del ticket (sólo si
   * mysterious=true). Pre-generado para que sea consistente entre
   * sesiones. Se usará en el PC de Alex.
   */
  secretCode?: string;
}

export const GIFTS: Record<GiftId, Gift> = {
  cena: {
    id: 'cena',
    source: 'haku',
    title: 'Cena para dos',
    description:
      'Reserva en un restaurante a tu elección. Tú dices el sitio, yo me encargo del resto.',
    accent: '#5eead4',
  },
  escapada: {
    id: 'escapada',
    source: 'nala',
    title: 'Escapada de fin de semana',
    description:
      'Dos días fuera, los dos. Tú eliges la ciudad, yo organizo viaje y alojamiento.',
    accent: '#ff8ab8',
  },
  misterioso: {
    id: 'misterioso',
    source: 'kero',
    title: '???',
    description:
      'Un sobre cerrado. En el reverso hay un código. ¿Lo metes en algún sitio?',
    accent: '#fbbf24',
    mysterious: true,
    // Código consistente — se usará en el PC de Alex (unlock-hatch).
    secretCode: 'HAKU-KERO-NALA',
  },
  // S2.7: regalo desbloqueado SÓLO al descifrar el morse del Tomodachi
  // en el PC de Alex. No tiene gato asociado — viene de "el código".
  tomodachi: {
    id: 'tomodachi',
    source: 'kero',  // narrativamente, Kero te dio el ticket → su sub-regalo
    title: 'Tomodachi Life — Switch',
    description:
      'Tu serial Nintendo eShop. Descifrado del morse de la caja fuerte. Canjea aquí para verlo escrito.',
    accent: '#fb7185',
  },
};

/** Devuelve el regalo asociado al gato. */
export function giftForCat(catId: 'haku' | 'kero' | 'nala'): Gift {
  if (catId === 'haku') return GIFTS.cena;
  if (catId === 'kero') return GIFTS.misterioso;
  return GIFTS.escapada;
}
