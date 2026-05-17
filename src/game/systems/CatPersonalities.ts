import type { CatId, CatState } from '../entities/Cat';

/**
 * CatPersonalities — define personalidad por gato (Día 8c rework).
 *
 * SIN TAMAGOCHI. Los gatos eligen ELLOS MISMOS qué hacer en función de:
 *   1) Hora del día (schedule global)
 *   2) Personalidad (sesgos por gato)
 *   3) Aleatoriedad
 *
 * `pickStateFor(catId, hour, ctx)` devuelve el estado que el gato debería
 * tomar AHORA. CatSystem llama a esta función cada cierto tiempo
 * ("decision tick", ~3-8s según activity) y aplica el state al Cat.
 */

/**
 * Pesos de probabilidad de cada estado en cada banda horaria. CatSystem
 * usa estos pesos como base + ajustes de personality. Suma no necesita
 * ser 1 — es relativa.
 */
type StateWeights = Partial<Record<CatState, number>>;

/**
 * Schedule global REBALANCE v6: sleep nunca más del ~30% del peso. Vida
 * en la casa siempre visible (alguno paseando, jugando, ronroneando).
 * El cooldown de sleep (CatSystem) además garantiza que tras dormir no
 * vuelvan inmediatamente a la cama.
 */
const GLOBAL_SCHEDULE: { from: number; to: number; weights: StateWeights }[] = [
  // Madrugada profunda — sigue habiendo sleep alto pero NO monopolio.
  { from: 0, to: 5, weights: { sleep: 4, idle: 2, walk: 2, purr: 1 } },
  // Amanecer.
  { from: 5, to: 7, weights: { sleep: 2, idle: 3, walk: 2, purr: 1, playful: 1 } },
  // Mañana.
  { from: 7, to: 10, weights: { walk: 5, idle: 2, playful: 2, purr: 1 } },
  // Mediodía.
  { from: 10, to: 13, weights: { walk: 4, idle: 3, playful: 2, purr: 2 } },
  // Tarde siesta — algunos duermen, otros activos.
  { from: 13, to: 16, weights: { sleep: 2, idle: 3, purr: 2, walk: 3, playful: 1 } },
  // Tarde.
  { from: 16, to: 18, weights: { walk: 4, playful: 3, idle: 2, purr: 1 } },
  // Atardecer.
  { from: 18, to: 20, weights: { walk: 4, playful: 3, idle: 2, sprint: 1 } },
  // Happy hour.
  { from: 20, to: 22, weights: { sprint: 4, playful: 5, walk: 3 } },
  // Noche — calmando, mínimo de sleep.
  { from: 22, to: 24, weights: { walk: 3, idle: 3, purr: 2, sleep: 1, playful: 1 } },
];

function getGlobalWeights(hour: number): StateWeights {
  const slot = GLOBAL_SCHEDULE.find((s) => hour >= s.from && hour < s.to);
  return slot?.weights ?? { idle: 1 };
}

export interface PersonalityCtx {
  /** ¿Está Alex conectado? (Día 19 lo conecta a sesiones reales.) */
  alexConnected: boolean;
  /** ¿Hoy es viernes 13 IRL? */
  isFridayThe13th: boolean;
  /** ¿Estamos en la ventana 4:20 (Kero easter egg)? */
  isKero420: boolean;
}

export interface CatPersonality {
  id: CatId;
  /** ¿Habla con typewriter (Haku) o sólo "acciones" en asteriscos? */
  speaks: boolean;
  /**
   * Modificador de pesos por personalidad. Recibe los pesos globales y
   * los ajusta. Devuelve nuevos pesos.
   */
  modifyWeights: (base: StateWeights, hour: number, ctx: PersonalityCtx) => StateWeights;
  /** Pool de diálogos. */
  dialog: CatDialogPool;
  /** Easter egg active check (sólo dialog override). */
  easterEggCheck?: (ctx: PersonalityCtx) => boolean;
}

export interface CatDialogPool {
  generic: string[][];
  byState?: Partial<Record<CatState, string[][]>>;
  easterEgg?: string[][];
}

// ──────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────

export function isFridayThe13th(now: Date = new Date()): boolean {
  return now.getDay() === 5 && now.getDate() === 13;
}

export function isKero420(now: Date = new Date()): boolean {
  const h = now.getHours();
  const m = now.getMinutes();
  return h === 16 && m >= 20 && m < 25;
}

/** Combina 2 pesos sumando. */
function bumpWeight(w: StateWeights, key: CatState, by: number): StateWeights {
  const out: StateWeights = { ...w };
  out[key] = (out[key] ?? 0) + by;
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// KERO — autista fumador
// ──────────────────────────────────────────────────────────────────────

const KERO: CatPersonality = {
  id: 'kero',
  speaks: false,
  modifyWeights: (base, hour, ctx) => {
    let w = { ...base };
    // Mira al techo / paraliza random ("autista de otra vida"): sube idle siempre.
    w = bumpWeight(w, 'idle', 1);
    // Easter egg 4:20 → mucho purr/idle.
    if (ctx.isKero420) {
      w = bumpWeight(w, 'purr', 8);
      w = bumpWeight(w, 'idle', 5);
    }
    return w;
  },
  dialog: {
    generic: [
      ['*Kero ronronea bajito.*', '*te mira con los ojos casi cerrados.*'],
      ['*Kero se gira y se aleja un paso.*', '*vuelve. te huele la mano.*'],
      ['*ronronea fuerte.*', '*un ronroneo sólido, terapéutico.*'],
    ],
    byState: {
      sleep: [['*Kero duerme profundamente.*', '*una pata le tiembla.*']],
      sprint: [['*Kero corre en círculos.*', '*no parece tener un motivo.*']],
      eat: [['*Kero está comiendo.*', '*muy concentrado en el cuenco.*']],
      eat: [['*Kero está comiendo. concentrado.*']],
      playful: [['*Kero ataca una mota de polvo invisible.*']],
    },
    easterEgg: [
      ['*Kero está totalmente quieto.*', '*huele a... ¿hierba?*', '*se gira y te mira sin verte.*'],
    ],
  },
  easterEggCheck: (ctx) => ctx.isKero420,
};

// ──────────────────────────────────────────────────────────────────────
// HAKU — único que habla, viernes 13, ve admin
// ──────────────────────────────────────────────────────────────────────

const HAKU: CatPersonality = {
  id: 'haku',
  speaks: true,
  modifyWeights: (base, hour) => {
    let w = { ...base };
    // Noctámbulo: 22-2 sube walk/playful, baja sleep.
    if (hour >= 22 || hour < 2) {
      w = bumpWeight(w, 'walk', 4);
      w = bumpWeight(w, 'playful', 2);
      w.sleep = 0;
    }
    // De día prefiere purr.
    if (hour >= 8 && hour < 18) {
      w = bumpWeight(w, 'purr', 3);
    }
    return w;
  },
  dialog: {
    /**
     * Día 9e: Haku CHARLATÁN, alegre, casi-humano. Miau-miau intercalado,
     * sentencias cortas, lore filtrado: gato negro, viernes 13, María al
     * principio no lo quería y ahora lo ama. NUNCA dramático.
     */
    generic: [
      ['"miau."', '"miau-miau."', '"sí, ya sé que me oyes."'],
      ['"hola, María, hola."', '*Haku se sienta como persona, patitas dobladas.*'],
      ['"al principio no me querías. ¿te acuerdas?"', '"miau."', '"y ahora me hablas más que a Alex."'],
      ['"un viernes. un trece. lloviendo."', '"mira ahora qué casa, María."'],
      ['"miau-miau."', '"hace bueno hoy, me lo ha dicho el sol del salón."'],
      ['"esa cara la conozco."', '"cara-de-pensar. ven, siéntate."'],
      ['"hoy he visto pasar un pájaro."', '"para él era miércoles. para mí jueves."'],
      ['"miau."', '"tu madre ya no me llama bicho de mala suerte."', '"ahora pregunta por mí cuando llama."'],
      ['"si quieres te miro fijo media hora."', '"o te ronroneo. miau."', '"tú dirás."'],
      ['"me caes bien, María."', '"a Kero también se lo digo, pero no me hace caso."'],
      ['"oye."', '"oye, María, miau."', '"¿me has visto bien? miau."'],
      ['"el suelo está calentito aquí."', '"hay sitio, vente."'],
      ['"miau."', '"sé que vas a hacer café antes de que pongas el cazo."', '"superpotencia menor."'],
      ['"a Alex le huele la respiración a noche."', '"a ti a domingo."', '"yo huelo a gato. miau."'],
      ['"quiero contarte algo, espera."', '"miau."', '"...se me ha olvidado. da igual."'],
      ['"miau."', '"el otro día atrapé una mosca."', '"y se la di a Kero. me debe una."'],
    ],
    byState: {
      sleep: [
        ['"miau... zzz..."', '*Haku ronca finito.*'],
        ['"...mhm... ratón... mhm..."'],
      ],
      purr: [
        ['*Haku te mira fijo y ronronea fuerte.*', '"miau-rrrrr."'],
        ['"esto es lo mejor que sé hacer."', '*sigue ronroneando.*'],
      ],
      walk: [
        ['"miau."', '"voy a dar dos vueltas más."', '"luego tú y yo, sofá."'],
        ['"piernas cortas, plan grande."', '*Haku camina decidida.*'],
      ],
      playful: [
        ['"juego sí, juego sí."', '"miau-miau-miau."', '*Haku ataca tu pie suavecito.*'],
      ],
      idle: [
        ['"miau."', '"miro el techo. el techo no responde."', '"da igual."'],
      ],
    },
    easterEgg: [
      ['"hoy es uno de esos días, María."', '"viernes y trece. mi día."', '"miau."'],
      ['"feliz cumpleaños para mí."', '"trae galletas. y no llores."'],
      ['"la casa cruje un poquito hoy."', '"yo también, miau."'],
    ],
  },
  easterEggCheck: (ctx) => ctx.isFridayThe13th,
};

// ──────────────────────────────────────────────────────────────────────
// NALA — la putona enamorada de Alex
// ──────────────────────────────────────────────────────────────────────

const NALA: CatPersonality = {
  id: 'nala',
  speaks: false,
  modifyWeights: (base, _hour, ctx) => {
    let w = { ...base };
    // Si Alex conectado → pasa a walk/sprint constante (lo busca).
    if (ctx.alexConnected) {
      w = bumpWeight(w, 'walk', 8);
      w = bumpWeight(w, 'sprint', 3);
      w.sleep = 0;
    } else {
      // Normal: prefiere idle/purr (esperando a Alex).
      w = bumpWeight(w, 'idle', 2);
      w = bumpWeight(w, 'purr', 2);
    }
    return w;
  },
  dialog: {
    generic: [
      ['*Nala se aparta un paso.*', '*sigue mirando hacia la puerta.*'],
      ['*Nala se enrosca sobre sí misma.*', '*no hace caso.*'],
      ['*Nala bostezó.*', '*o suspiró. da igual.*'],
      ['*te mira de reojo.*', '*como si te midiera.*'],
    ],
    byState: {
      walk: [['*Nala camina hacia la puerta.*', '*como si esperara a alguien.*']],
      sprint: [['*Nala corre.*', '*no es contigo.*']],
      purr: [['*Nala te mira de reojo mientras ronronea.*']],
    },
    easterEgg: [
      ['*Nala te guiña un ojo.*', '*..."¿pasa algo, María?".*', '*se acerca.*'],
    ],
  },
};

// ──────────────────────────────────────────────────────────────────────
// REGISTRY + PICK
// ──────────────────────────────────────────────────────────────────────

export const CAT_PERSONALITIES: Record<CatId, CatPersonality> = {
  kero: KERO,
  haku: HAKU,
  nala: NALA,
};

/**
 * Devuelve un state nuevo para el gato, basado en hora + personalidad +
 * random ponderado. Llamado por CatSystem cada cierto tiempo (decision tick).
 */
export function pickStateFor(
  catId: CatId,
  hour: number,
  ctx: PersonalityCtx,
): CatState {
  const personality = CAT_PERSONALITIES[catId];
  const base = getGlobalWeights(hour);
  const weights = personality.modifyWeights(base, hour, ctx);
  return weightedPick(weights);
}

function weightedPick(weights: StateWeights): CatState {
  const entries = Object.entries(weights).filter(([, v]) => (v ?? 0) > 0) as [CatState, number][];
  if (entries.length === 0) return 'idle';
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let r = Math.random() * total;
  for (const [state, w] of entries) {
    r -= w;
    if (r <= 0) return state;
  }
  return entries[entries.length - 1][0];
}

/**
 * Día 9e: líneas de Haku según franja horaria. Se mezclan en el pool
 * cuando se llama a pickDialog con hour. Saber qué hora es lo da
 * sabor narrativo (mañana hay café, noche habla bajito, etc.).
 */
const HAKU_TIME_LINES: Record<'morning' | 'midday' | 'evening' | 'night', string[][]> = {
  morning: [
    ['"buenos días, María, miau."', '"el café aún no, pero ya se huele."'],
    ['"miau."', '"luz de mañana en la ventana, mi favorita."', '"vente, hay sitio."'],
    ['"hoy te has levantado bien."', '"se nota. miau."'],
  ],
  midday: [
    ['"hambre tengo."', '"miau-miau."', '"o no. depende."'],
    ['"sol del mediodía: cuadro número 1."', '"echarme una hora aquí: cuadro número 2."'],
    ['"miau."', '"hoy hace ese tipo de día que duran dos."'],
  ],
  evening: [
    ['"miau."', '"se está poniendo bonito todo."', '"la pared se vuelve naranja."'],
    ['"esta es la hora que me gusta."', '"todo el mundo más despacio. miau-miau."'],
    ['"María. hola."', '"¿hoy quién hace cena, tú o Alex?"'],
  ],
  night: [
    ['"shhh, miau."', '"todos duermen menos tú y yo."'],
    ['"de noche oigo más cosas."', '"el frigo. la persiana. la respiración del piso."'],
    ['"miau bajito."', '"no me hagas hablar fuerte que despertamos."'],
  ],
};

function hakuTimeBucket(hour: number): keyof typeof HAKU_TIME_LINES {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'midday';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/** Selecciona una página random del pool, considerando easter egg y state. */
export function pickDialog(
  personality: CatPersonality,
  state: CatState,
  easterEggActive: boolean,
  hour = -1,
): string[] {
  if (easterEggActive && personality.dialog.easterEgg && personality.dialog.easterEgg.length) {
    const pool = personality.dialog.easterEgg;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const byState = personality.dialog.byState?.[state];
  let pool: string[][];
  if (byState && byState.length) {
    pool = [...byState];
  } else {
    pool = [...personality.dialog.generic];
  }
  // Día 9e: para Haku, mezclar líneas de la franja horaria actual.
  if (personality.id === 'haku' && hour >= 0) {
    const bucket = hakuTimeBucket(hour);
    pool = [...pool, ...HAKU_TIME_LINES[bucket]];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
