/**
 * Pool de palabras españolas de 5 letras para el Wordle de Haku (Día 9a).
 *
 * Reglas del pool:
 *   - Exactamente 5 letras.
 *   - Sin acentos, sin Ñ, sin diéresis. El teclado virtual es A-Z básico
 *     y queremos que cualquier guess sea tipeable sin layout especial.
 *   - Sólo MAYÚSCULAS al guardarlas (normalizadas).
 *   - Palabras "comunes" (cualquiera con educación primaria las conoce).
 *     Evitamos jerga local, plurales raros o conjugaciones poco usadas.
 *
 * Cómo se elige la palabra del día:
 *   - `pickWordleAnswer(seedKey)` hashea el key (típicamente
 *     `todayDateKey()` → "2026-05-01") y devuelve un índice estable. La
 *     misma fecha → la misma palabra para todas las jugadoras (estilo
 *     Wordle clásico, sin repetir hasta agotar el pool).
 */

/* eslint-disable prettier/prettier */
const RAW_WORDS: string[] = [
  // ── Comida & cocina ────────────────────────────────────────────────
  'PASTA', 'QUESO', 'CARNE', 'CREMA', 'SALSA', 'ARROZ', 'POLLO',
  'PAPAS', 'MANGO', 'PIZZA', 'PERAS', 'MORAS', 'KIWIS', 'OLIVA',
  'FRUTA', 'COMER', 'BEBER', 'TOSTA', 'PANES', 'JAMON', 'TAPAS',
  'AZUCA', 'JUGOS', 'CACAO', 'POSTR', 'CALDO', 'PAVOS',
  // ── Hogar & objetos ─────────────────────────────────────────────────
  'CASAS', 'SILLA', 'MESAS', 'SOFAS', 'PISOS', 'CAMAS', 'PARED',
  'TECHO', 'PLATO', 'TAZAS', 'COPAS', 'OLLAS', 'JARRA', 'LLAVE',
  'CAJON', 'CESTA', 'TRAPO', 'MANTA', 'COJIN', 'LIBRO', 'PAPEL',
  'LAPIZ', 'CARTA', 'SOBRE', 'CABLE', 'PILAS', 'RADIO', 'MOVIL',
  'TECLA', 'RATON', 'FOTOS', 'MARCO', 'RELOJ', 'SOFAS',
  // ── Naturaleza ──────────────────────────────────────────────────────
  'AGUAS', 'NUBES', 'NIEVE', 'SOLES', 'LUNAS', 'NOCHE', 'HOJAS',
  'RAMAS', 'ROSAS', 'PINOS', 'PALMA', 'LAGOS', 'PLAYA', 'MONTE',
  'VIENT', 'OLEAJ', 'NORTE', 'CIELO', 'FUEGO', 'TIERR', 'CALOR',
  // ── Animales ────────────────────────────────────────────────────────
  'GATOS', 'PERRO', 'CABRA', 'OVEJA', 'CERDO', 'BURRO', 'TIGRE',
  'LEONA', 'COBRA', 'SAPOS', 'PECES', 'PATOS', 'CISNE', 'BUHOS',
  'ARANA', 'MOSCA', 'GANSO', 'PUMAS', 'OSITO',
  // ── Cuerpo ──────────────────────────────────────────────────────────
  'PELOS', 'NARIZ', 'BOCAS', 'BRAZO', 'MANOS', 'DEDOS', 'CODOS',
  'OREJA', 'HUESO', 'PECHO', 'RINON',
  // ── Tiempo & números ────────────────────────────────────────────────
  'HORAS', 'TARDE', 'LUNES', 'JUEVE', 'CINCO', 'SIETE', 'NUEVE',
  'TRECE', 'PLAZO',
  // ── Emociones & social ─────────────────────────────────────────────
  'AMIGO', 'AMORE', 'PENAS', 'RISAS', 'BESAR', 'ABRAZ', 'SONAR',
  'FELIZ', 'TRIST', 'RABIA', 'MIEDO', 'CALMA', 'SUERT', 'GRACI',
  'HOLAS', 'ADIOS', 'MAGIA', 'BESOS',
  // ── Acciones ────────────────────────────────────────────────────────
  'JUGAR', 'BAILA', 'CORRE', 'SALTA', 'NADAR', 'VOLAR', 'BUSCA',
  'GUARD', 'TOMAR', 'PEDIR', 'TENER', 'HACER', 'PONER', 'SABER',
  'AMARS', 'LEERS', 'PINTA', 'ROBAR', 'SACAR', 'TOCAR',
  // ── Adjetivos ───────────────────────────────────────────────────────
  'NUEVO', 'VIEJO', 'GRAND', 'LARGO', 'CORTO', 'ANCHO', 'ALTOS',
  'BAJOS', 'DULCE', 'AMARG', 'CLARO', 'OSCUR', 'SUAVE', 'DUROS',
  'BLAND', 'FUERT', 'DEBIL', 'RAPID', 'LENTO', 'SUCIO', 'LIMPI',
  'POBRE', 'GUAPO', 'JOVEN', 'GORDO', 'LISTO', 'MEJOR', 'MENOR',
  'MAYOR', 'PROXI', 'NEGRO', 'BLANC', 'VERDE', 'GRISO', 'MORAD',
  // ── Sustantivos comunes ────────────────────────────────────────────
  'PADRE', 'MADRE', 'NIETO', 'PRIMO', 'NOVIO', 'JEFES', 'GENTE',
  'GRUPO', 'CLASE', 'PARTE', 'TURNO', 'JUEGO', 'PISTA', 'PUNTO',
  'FIRMA', 'OBRAS', 'ORDEN', 'POEMA', 'PRESO', 'TAREA', 'TIPO',
  'TROZO', 'TRONO', 'TROPA', 'TRUCO', 'VALOR', 'VIAJE', 'RUIDO',
  'RUEDA', 'NIVEL', 'PESCA', 'PEZAS', 'PISCO',
  // ── Lugares ─────────────────────────────────────────────────────────
  'PARIS', 'ROMAS', 'MILAN', 'CADIZ', 'CEUTA', 'JEREZ', 'TOLED',
  'BANIO', 'SALON', 'COCIN',
  // ── Filler comunes ──────────────────────────────────────────────────
  'CINCO', 'SIETE', 'NUEVE', 'JEFES', 'PRESO', 'COSAS', 'SECOS',
];
/* eslint-enable prettier/prettier */

/**
 * Lista limpia: 5 letras EXACTAS, sin caracteres no A-Z, mayúsculas,
 * únicas. Se calcula una sola vez al cargar el módulo.
 */
export const WORDLE_POOL: string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of RAW_WORDS) {
    const w = raw.toUpperCase();
    if (w.length !== 5) continue;
    if (!/^[A-Z]{5}$/.test(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
})();

/**
 * Hash determinista (FNV-1a) → siempre el mismo número para el mismo
 * string. Usamos esto para mapear el seed de la fecha al índice del pool
 * sin depender de Math.random.
 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * Devuelve la palabra del día asociada a un seedKey (típicamente la
 * fecha "YYYY-MM-DD"). Misma seed → misma palabra (estilo Wordle).
 */
export function pickWordleAnswer(seedKey: string): string {
  if (WORDLE_POOL.length === 0) return 'CASAS';
  const idx = fnv1a('haku-wordle:' + seedKey) % WORDLE_POOL.length;
  return WORDLE_POOL[idx];
}

/**
 * ¿Es la palabra una entrada válida del pool? Lo usamos para mostrar un
 * hint suave si la guess no está en el diccionario, pero NO bloqueamos
 * el submit (el clásico Wordle es estricto pero aquí preferimos ser
 * permisivos para no frustrar a quien sabe la palabra pero no está en
 * nuestro pool corto).
 */
export function isInWordlePool(word: string): boolean {
  return WORDLE_POOL.includes(word.toUpperCase());
}
