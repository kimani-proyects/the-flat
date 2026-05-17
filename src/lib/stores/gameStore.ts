import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Estado global del juego (cliente).
 *
 * Divido en dos slices con comportamientos distintos:
 *
 *  1) SESSION slice (useGameStore): estado "vivo" de la sesión — sala
 *     actual, coins de la sesión, modo de Alex. Se pierde al refrescar
 *     la página (Supabase es la fuente de verdad para persistencia server).
 *
 *  2) PROGRESS slice (useProgressStore): progreso del jugador que el
 *     cliente necesita conocer SIN pedirle a Supabase — p.ej. si ya ha
 *     visto la intro, qué habitaciones tiene desbloqueadas, el código
 *     de su piso. Persistido en localStorage con Zustand middleware.
 *     Supabase también guarda esto, pero el localStorage hace de caché
 *     para evitar que la intro salga dos veces si la red falla.
 */

export type Room =
  | 'entrada'
  | 'salon'
  | 'cocina'
  | 'bano'
  | 'habitacion-maria'
  | 'habitacion-alex'
  | 'habitacion-secreta'
  | 'terraza'
  | 'habitacion-secreta';

export type AlexMode = 'offline' | 'invisible' | 'spawned' | 'npc-disguised';

// ================================================================
// SESSION slice
// ================================================================

export interface GameState {
  currentRoom: Room;
  cutrecoins: number;
  alexMode: AlexMode;
  isGameReady: boolean;

  setCurrentRoom: (room: Room) => void;
  addCutrecoins: (amount: number) => void;
  setAlexMode: (mode: AlexMode) => void;
  setGameReady: (ready: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentRoom: 'entrada',
  cutrecoins: 0,
  alexMode: 'offline',
  isGameReady: false,

  setCurrentRoom: (room) => set({ currentRoom: room }),
  addCutrecoins: (amount) =>
    set((state) => ({ cutrecoins: state.cutrecoins + amount })),
  setAlexMode: (mode) => set({ alexMode: mode }),
  setGameReady: (ready) => set({ isGameReady: ready }),
}));

// ================================================================
// PROGRESS slice (persistent)
// ================================================================

/**
 * El código que María introduce en el keypad del rellano para entrar
 * a su piso. Viene escrito en la carta del intro. En producción esto
 * se generaría server-side y se asociaría al player (para hub multi-
 * usuario cuando regale el juego a otras personas). De momento es
 * constante 11·05·26 (su cumpleaños).
 */
export const APARTMENT_CODE = '110526';

/**
 * Habitaciones "unlockables" tras resolver el minijuego de cada muro.
 * El piso arranca con todas bloqueadas (rooms vacías en el array).
 * "entrada" y "salon" no son unlockables (open plan, acceso libre).
 */
export type UnlockableRoom =
  | 'cocina'
  | 'bano'
  | 'habitacion-maria'
  | 'habitacion-alex'
  | 'terraza'
  | 'habitacion-secreta';

export const ALL_UNLOCKABLE_ROOMS: UnlockableRoom[] = [
  'cocina',
  'bano',
  'habitacion-maria',
  'habitacion-alex',
  'terraza',
  'habitacion-secreta',
];

/** ID de los 3 regalos IRL (Día 9). */
export type GiftId = 'cena' | 'escapada' | 'misterioso' | 'tomodachi';

/** Datos del canje de un regalo (formulario submit). */
export interface RedemptionData {
  /** ISO date string preferida. */
  date: string;
  /** Persona invitada. Default 'Alex'. */
  guest: string;
  /** Comentarios libres. */
  notes: string;
  /** Timestamp del canje. */
  redeemedAtMs: number;
}

/** Resultado de un día de Wordle. */
export interface WordleEntry {
  won: boolean;
  tries: number;
}

export interface ProgressState {
  /** True tras ver la intro de LoL una vez. Si está true, se salta. */
  introPlayed: boolean;
  /** Habitaciones desbloqueadas (minijuegos de muro completados). */
  unlockedRooms: UnlockableRoom[];
  /** True tras introducir el código correcto en el rellano al menos una vez. */
  apartmentEverEntered: boolean;
  /**
   * True tras la cinemática de entrada de los 3 gatos (Día 8). Se activa
   * cuando los 5 muros están KO y se reproduce la cinemática.
   */
  catsSpawned: boolean;
  /** Día 9: regalos IRL desbloqueados (al ganar minijuego del gato 1ª vez). */
  unlockedGifts: GiftId[];
  /** Día 9: regalos canjeados (con datos del formulario). */
  redeemedGifts: Partial<Record<GiftId, RedemptionData>>;
  /** Día 9: timestamp último intento de minijuego principal por gato (cooldown 24h). */
  lastMinigameAtMs: Partial<Record<string, number>>;
  /** Día 9: histórico de Wordle por fecha YYYY-MM-DD. */
  wordleHistory: Partial<Record<string, WordleEntry>>;
  /** Día 9: timestamp último FALLO en rythm acariciar Nala (cooldown 12h). */
  nalaPetFailAtMs: number;
  /** Día 9d: ids de gatos matcheados en Tinder Cat (acumula across sesiones). */
  tinderMatchedIds: string[];
  /** Día 9d: timestamp última sesión Tinder (cooldown 3h). */
  tinderLastSessionAtMs: number;
  /**
   * Día 9e: 15 ids preasignados como "destinos" de Nala. Se generan la
   * primera vez que se abre Tinder Cat y NO cambian más. Sólo estos ids
   * pueden producir match. Persiste para que María avance entre sesiones.
   */
  tinderDestinoIds: string[];
  /**
   * S1 (Día 10): timestamp de la última vez que detectamos a Alex
   * "conectado" (alexConnected → true). Persistente para que la cama de
   * Alex pueda decirle a María "se conectó hace X horas".
   * 0 = nunca registrado.
   */
  alexLastConnectedAtMs: number;
  /**
   * S1.2: la escotilla del piso permanece bloqueada hasta que el jugador
   * complete el minijuego de hacking del PC de Alex (Día 12). Persistente.
   */
  hatchUnlocked: boolean;
  /** S2.5: caja fuerte de la habitación secreta — abre con PIN del PC interno. */
  safeUnlocked: boolean;
  /** S2.5: agenda/calendario — clave 'YYYY-MM-DD' → texto. */
  agendaEntries: Record<string, string>;
  /** S2.5: mejor puntuación en Stack Game (bloques apilados). */
  stackGameBest: number;
  /** S2.5: regalo "arcade" desbloqueado al llegar a 50 en Stack Game. */
  arcadeGiftUnlocked: boolean;

  markIntroPlayed: () => void;
  unlockRoom: (room: UnlockableRoom) => void;
  isRoomUnlocked: (room: UnlockableRoom) => boolean;
  markApartmentEntered: () => void;
  markCatsSpawned: () => void;
  unlockAllRooms: () => void;
  resetCats: () => void;
  /** Día 9d: como resetCats pero también borra gifts/cooldowns/wordle/tinder.
   * Usado por F9 para que los minijuegos de gatos arranquen vírgenes
   * sin tener que hacer F2 (que también borra unlockedRooms). */
  resetCatMinigames: () => void;
  resetProgress: () => void;
  /** Día 9: marca regalo desbloqueado (idempotente). */
  unlockGift: (id: GiftId) => void;
  /** Día 9: registra el canje de un regalo. */
  redeemGift: (id: GiftId, data: RedemptionData) => void;
  /** Día 9: registra timestamp de último intento de minijuego. */
  markMinigamePlayed: (key: string) => void;
  /** Día 9: registra resultado de Wordle del día. */
  setWordleResult: (date: string, entry: WordleEntry) => void;
  /** Día 9: registra fallo de rythm acariciar Nala. */
  markNalaPetFail: () => void;
  /** Día 9d: añade id matcheado en Tinder (idempotente). */
  addTinderMatch: (id: string) => void;
  /** Día 9d: marca sesión Tinder ahora (cooldown 3h). */
  markTinderSession: () => void;
  /** Día 9e: setea los 15 destinos preasignados (idempotente — solo si vacío). */
  setTinderDestinos: (ids: string[]) => void;
  /** S1: registra timestamp ahora cuando Alex se conecta. */
  markAlexConnected: () => void;
  /** S1.2: marca escotilla desbloqueada (tras hacking PC Alex). */
  setHatchUnlocked: (v: boolean) => void;
  /** S2.5: marca caja fuerte desbloqueada. */
  setSafeUnlocked: (v: boolean) => void;
  /** S2.5: escribe/sobrescribe una entrada de agenda. Vacío = elimina. */
  setAgendaEntry: (date: string, text: string) => void;
  /** S2.5: borra TODA la agenda (botón "limpiar todo"). */
  clearAllAgenda: () => void;
  /** S2.5: guarda mejor puntuación de Stack Game (sólo si supera la actual). */
  setStackGameBest: (n: number) => void;
  /** S2.5: marca regalo arcade desbloqueado (idempotente). */
  setArcadeGiftUnlocked: (v: boolean) => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      introPlayed: false,
      unlockedRooms: [],
      apartmentEverEntered: false,
      catsSpawned: false,
      unlockedGifts: [],
      redeemedGifts: {},
      lastMinigameAtMs: {},
      wordleHistory: {},
      nalaPetFailAtMs: 0,
      tinderMatchedIds: [],
      tinderLastSessionAtMs: 0,
      tinderDestinoIds: [],
      alexLastConnectedAtMs: 0,
      hatchUnlocked: false,
      safeUnlocked: false,
      agendaEntries: {},
      stackGameBest: 0,
      arcadeGiftUnlocked: false,

      markIntroPlayed: () => set({ introPlayed: true }),
      unlockRoom: (room) =>
        set((s) => ({
          unlockedRooms: s.unlockedRooms.includes(room)
            ? s.unlockedRooms
            : [...s.unlockedRooms, room],
        })),
      isRoomUnlocked: (room) => get().unlockedRooms.includes(room),
      markApartmentEntered: () => set({ apartmentEverEntered: true }),
      markCatsSpawned: () => set({ catsSpawned: true }),
      unlockAllRooms: () =>
        set({ unlockedRooms: [...ALL_UNLOCKABLE_ROOMS] }),
      resetCats: () => set({ catsSpawned: false }),
      resetCatMinigames: () =>
        set({
          catsSpawned: false,
          unlockedGifts: [],
          redeemedGifts: {},
          lastMinigameAtMs: {},
          wordleHistory: {},
          nalaPetFailAtMs: 0,
          tinderMatchedIds: [],
          tinderLastSessionAtMs: 0,
          tinderDestinoIds: [],
      alexLastConnectedAtMs: 0,
      hatchUnlocked: false,
      safeUnlocked: false,
      agendaEntries: {},
      stackGameBest: 0,
      arcadeGiftUnlocked: false,
        }),
      resetProgress: () =>
        set({
          introPlayed: false,
          unlockedRooms: [],
          apartmentEverEntered: false,
          catsSpawned: false,
          unlockedGifts: [],
          redeemedGifts: {},
          lastMinigameAtMs: {},
          wordleHistory: {},
          nalaPetFailAtMs: 0,
          tinderMatchedIds: [],
          tinderLastSessionAtMs: 0,
          tinderDestinoIds: [],
      alexLastConnectedAtMs: 0,
      hatchUnlocked: false,
      safeUnlocked: false,
      agendaEntries: {},
      stackGameBest: 0,
      arcadeGiftUnlocked: false,
        }),
      unlockGift: (id) =>
        set((s) => ({
          unlockedGifts: s.unlockedGifts.includes(id)
            ? s.unlockedGifts
            : [...s.unlockedGifts, id],
        })),
      redeemGift: (id, data) =>
        set((s) => ({
          redeemedGifts: { ...s.redeemedGifts, [id]: data },
        })),
      markMinigamePlayed: (key) =>
        set((s) => ({
          lastMinigameAtMs: { ...s.lastMinigameAtMs, [key]: Date.now() },
        })),
      setWordleResult: (date, entry) =>
        set((s) => ({
          wordleHistory: { ...s.wordleHistory, [date]: entry },
        })),
      markNalaPetFail: () => set({ nalaPetFailAtMs: Date.now() }),
      addTinderMatch: (id) =>
        set((s) => ({
          tinderMatchedIds: s.tinderMatchedIds.includes(id)
            ? s.tinderMatchedIds
            : [...s.tinderMatchedIds, id],
        })),
      markTinderSession: () => set({ tinderLastSessionAtMs: Date.now() }),
      setTinderDestinos: (ids) =>
        set((s) => ({
          tinderDestinoIds: s.tinderDestinoIds.length === 0 ? ids : s.tinderDestinoIds,
        })),
      markAlexConnected: () => set({ alexLastConnectedAtMs: Date.now() }),
      setHatchUnlocked: (v) => set({ hatchUnlocked: v }),
      setSafeUnlocked: (v) => set({ safeUnlocked: v }),
      setAgendaEntry: (date, text) =>
        set((s) => {
          const next = { ...s.agendaEntries };
          if (text.trim().length === 0) delete next[date];
          else next[date] = text;
          return { agendaEntries: next };
        }),
      clearAllAgenda: () => set({ agendaEntries: {} }),
      setStackGameBest: (n) =>
        set((s) => ({ stackGameBest: Math.max(s.stackGameBest, n) })),
      setArcadeGiftUnlocked: (v) => set({ arcadeGiftUnlocked: v }),
    }),
    {
      name: 'theflat:progress',
      version: 1,
    },
  ),
);
