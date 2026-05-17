import * as Phaser from 'phaser';
import type { InteractableType } from '../data/floorplan';
import type { InteractionHandler } from '../systems/InteractionSystem';
import {
  tvHandler,
  sofaHandler,
  bedHandler,
  mirrorHandler,
  bookshelfHandler,
  wardrobeHandler,
  fridgeHandler,
} from './furnitureHandlers';
import { getFurnitureRenderer } from '../systems/FurnitureRenderer';
import { AudioBus, MUSIC_TRACKS } from '../systems/AudioBus';
import { runPcMariaMinigame } from '../minigames/pcmaria/PcMariaMinigame';
import {
  runPcAlexMinigame,
  runSafeMinigame,
  runHatchPinMinigame,
} from '../minigames/pcalex/PcAlexMinigame';

/**
 * S2: wrapper que dispara la anim del mueble en `type` antes de mostrar
 * el diálogo flavor. Para muebles "tontos" (sink, stove, bathtub, etc.)
 * que no tienen handler propio rico — sólo flavor + visual cue.
 */
function withAnim<T extends InteractableType>(
  type: T,
  handler: InteractionHandler,
): InteractionHandler {
  return async (ctx) => {
    getFurnitureRenderer()?.playOneShot(type);
    await handler(ctx);
  };
}

/**
 * Registry de handlers por tipo de interactable.
 *
 * Día 6: los placeholders de Día 5 (toasts flotantes) pasan a diálogos
 *        reales vía ctx.showDialog — panel 9-slice anclado abajo con
 *        typewriter. Cada entrada es:
 *          - string        → una sola página
 *          - string[]      → varias páginas (SPACE/ENTER para avanzar)
 *
 * Día 7.1: la puerta principal (`front-door`) deja de ser dialog-only y
 *          pasa a transicionar a HubScene (salida al rellano). Es el
 *          primer handler con efecto de side (cambio de escena), no solo
 *          conversación. El patrón se generalizará en futuros handlers
 *          (TV → arcade scene, PC → shop scene, etc.).
 *
 * Tono: María hablando sola ("sola voce"), con humor seco, cansancio y
 *       ternura. Los 5-8 objetos "emblemáticos" (telescopio, librería,
 *       cama, sofá, armario, pc, espejo, fogones) tienen multi-página;
 *       el resto mantiene una sola línea corta hasta que expandamos.
 *
 * Roadmap: Día 7 añadirá ramas según hora del día / estado del juego;
 *          Día 13 conectará pc/wardrobe/stove con los menús de personalización.
 */

// Líneas por tipo. Centralizadas aquí para iteración rápida de prosa
// (editables sin tocar lógica del sistema).
const LINES: Partial<Record<InteractableType, string | string[]>> = {
  // --- Emblemáticos (multi-página) ---
  telescope: [
    'Mi telescopio.',
    'Apenas lo saco desde que murió abuela.',
    'Ella decía que las estrellas son gente que nos mira desde arriba.',
    'Hoy quizá lo aparque en la terraza y mire un rato.',
  ],
  bookshelf: [
    'Tengo libros a medio leer por todas partes.',
    'Ese de arriba me lo regaló Alex.',
    'Todavía no lo he abierto. Mal, María, mal.',
  ],
  bed: [
    'La cama llama.',
    'Pero aún es pronto. ¿O no?',
  ],
  sofa: [
    'Sentarse un rato no está mal.',
    'Cinco minutos. Solo cinco.',
    '(A quién engaño. Serán cuarenta.)',
  ],
  wardrobe: [
    'El armario.',
    'Me tengo que cambiar. ¿Para qué? Hoy no salgo.',
    '(Día 13: armario real. De momento es simbólico.)',
  ],
  stove: [
    'Los fogones.',
    'Podría cocinar algo decente.',
    'O pedir pizza. La segunda opción suena mejor.',
  ],
  pc: [
    'El ordenador.',
    'Podría ponerme a hacer cosas útiles.',
    '...o procrastinar. Qué difícil decisión.',
  ],
  mirror: [
    'Me miro.',
    'Todavía soy yo. Todo bien.',
    'Creo.',
  ],

  // --- Secundarios (una sola línea) ---
  fridge: 'La nevera. ¿Quedará algo decente?',
  sink: 'El grifo gotea otra vez.',
  'dining-table': 'La mesa. Siempre llena de cosas.',
  tv: '¿Qué echan ahora?',
  'coffee-table': 'Mandos, tazas, polvo.',
  plant: 'Hay que regar esto. Mañana.',
  washbasin: 'Agua fría. Me despierta.',
  wc: 'No voy a narrar esto.',
  bathtub: 'Un baño luego, prometido.',
  // 'front-door' tiene handler dedicado más abajo (efecto: cambia de escena).
  'coat-rack': 'La chaqueta, colgada donde siempre.',
  // safe → handler dedicado abajo (lanza el minijuego de PIN).
  // 'escape-hatch' tiene handler dedicado (locked hasta hack).
  microwave: [
    '*el microondas zumba bajito.*',
    '"calentando algo. nada interesante."',
  ],
  'bathroom-cabinet': [
    '*abres el armario del baño.*',
    '"crema de manos, tirita, paracetamol."',
    '*lo cierras.*',
  ],
  candle: [
    '*la vela está encendida.*',
    '"...se apagará sola cuando se canse."',
  ],
  cuckoo: [
    '*el reloj de cuco hace cucú una vez fuera de hora.*',
    '"siempre adelantado o atrasado."',
    '*nunca se sabe."',
  ],
  speakers: [
    '*los altavoces de Alex.*',
    '"setup carísimo. me encanta lo que retumba en el suelo cuando los pone."',
    '"PRÓXIMAMENTE: sistema de música."',
  ],
};

export const INTERACTION_HANDLERS: Partial<Record<InteractableType, InteractionHandler>> = {};

/**
 * Tipos cuyo sprite tiene anim que conviene reproducir al interactuar
 * (S2: static-by-default + anim-on-interact).
 */
const ANIM_ON_INTERACT_TYPES = new Set<InteractableType>([
  'stove',
  'sink',
  'washbasin',
  'bathtub',
  'bathroom-cabinet',
  'cuckoo',
]);

for (const [type, line] of Object.entries(LINES)) {
  const t = type as InteractableType;
  INTERACTION_HANDLERS[t] = async (ctx) => {
    // eslint-disable-next-line no-console
    console.log(`[interact] ${ctx.interactable.id} (${ctx.interactable.type})`);
    if (ANIM_ON_INTERACT_TYPES.has(t)) {
      getFurnitureRenderer()?.playOneShot(t);
    }
    await ctx.showDialog(line as string | string[], { speaker: 'María', portrait: 'maria' });
  };
}

/**
 * Handler dedicado para la puerta principal: salir al rellano (HubScene).
 *
 * Flujo:
 *   1) Mini-diálogo de una página (queda chulo y le da peso narrativo —
 *      no quiero que la escena cambie sin transición ni feedback).
 *   2) Fade-out de cámara 500 ms.
 *   3) `scene.start('HubScene')`.
 *
 * Cuando vuelva del Hub, ApartmentScene se re-instancia desde cero (Phaser
 * resetea su create()), así que no hay que limpiar nada del lado piso.
 *
 * El Hub ya soporta re-entry inteligente: si `apartmentEverEntered === true`
 * (que lo está al haber salido por aquí), la próxima vez que pulse E en su
 * puerta 2B saltará el keypad. Ver HubScene.handleDoorProximity.
 */
// S1.2: escape hatch SIEMPRE locked hasta el hack del PC Alex.
// Cuando hackeen exitosamente, llamarán a useProgressStore.setHatchUnlocked()
// y este handler dejará pasar.
import { useProgressStore } from '@/lib/stores/gameStore';
import { setLimeZuTexture, LIMEZU_STATES } from '../systems/LimeZuRenderer';
import { playMusicSession } from '../systems/MusicSession';
import { Sfx } from '../systems/SfxBank';
// S2.7: escape hatch SIMPLIFICADA — sin doble PIN. Si hatchUnlocked:
//   abre y muestra "lobby próximamente". Si NO: mensaje de "necesitas PC Alex".
INTERACTION_HANDLERS['escape-hatch'] = async (ctx) => {
  const unlocked = useProgressStore.getState().hatchUnlocked === true;
  if (!unlocked) {
    await ctx.showDialog(
      [
        '*la escotilla está sellada.*',
        '"un cierre electrónico. el PC de Alex tiene la utilidad."',
        '*el panel parpadea en rojo.*',
      ],
      { speaker: 'María', portrait: 'maria' },
    );
    return;
  }
  // Hatch abierta. Fade a negro corto + retorno con texto "lobby online próximamente".
  const cam = ctx.scene.cameras.main;
  cam.fadeOut(800, 0, 0, 0);
  await new Promise<void>((r) => cam.once('camerafadeoutcomplete', () => r()));
  await new Promise<void>((r) => ctx.scene.time.delayedCall(1200, () => r()));
  cam.fadeIn(900, 0, 0, 0);
  await ctx.showDialog(
    [
      '*bajas por la escalera. dentro hay un pasillo iluminado.*',
      '"luces abajo. música lejana."',
      '"... LOBBY ONLINE TECHNOLOGIES™ — próximamente."',
      '*subes de vuelta. la escotilla queda abierta tras de ti.*',
    ],
    { speaker: 'María', portrait: 'maria' },
  );
};

// S2.7: secret-door (entrada habitación secreta). Locked hasta hack del
// PC Alex (mismo flag hatchUnlocked). El hack abre la puerta secreta Y
// la escotilla en cascada.
INTERACTION_HANDLERS['secret-door'] = async (ctx) => {
  const unlocked = useProgressStore.getState().hatchUnlocked === true;
  if (!unlocked) {
    await ctx.showDialog(
      [
        '*una puerta extraña en la pared sur de tu habitación.*',
        '"...no recuerdo haberla visto antes."',
        '*hay un cierre electrónico. parpadea en rojo.*',
        '"el PC de Alex tendrá algo que ver con esto."',
      ],
      { speaker: 'María', portrait: 'maria' },
    );
    return;
  }
  await ctx.showDialog(
    [
      '*la puerta está abierta de par en par ahora.*',
      '"se nota fresco. baja para allá abajo."',
      '*entras a la habitación secreta.*',
    ],
    { speaker: 'María', portrait: 'maria' },
  );
};

// S2.5: caja fuerte habitación secreta — PIN dial.
INTERACTION_HANDLERS['safe'] = async (ctx) => {
  await runSafeMinigame({
    scene: ctx.scene,
    room: 'habitacion-secreta',
    roomLabel: 'Caja fuerte',
  });
};

// S2.4: PC María → abre el sistema operativo del PC con app Regalos.
// Sólo se aplica al `pc-maria`; otros PCs (Alex, secreta) usan el flavor.
INTERACTION_HANDLERS['pc'] = async (ctx) => {
  if (ctx.interactable.id === 'pc-maria') {
    // S2.10: encender pantalla LimeZu mientras está abierta.
    setLimeZuTexture(ctx.scene, 'lz-pc-maria-off', 'lz-pc-maria-on');
    try {
      await runPcMariaMinigame({
        scene: ctx.scene,
        room: 'habitacion-maria',
        roomLabel: 'PC María',
      });
    } finally {
      setLimeZuTexture(ctx.scene, 'lz-pc-maria-on', 'lz-pc-maria-off');
    }
    return;
  }
  if (ctx.interactable.id === 'pc-alex') {
    // S2.10: encender ambas mitades del PC Alex (2 sprites adyacentes).
    setLimeZuTexture(ctx.scene, 'lz-pc-alex-off-l', 'lz-pc-alex-on-l');
    setLimeZuTexture(ctx.scene, 'lz-pc-alex-off-r', 'lz-pc-alex-on-r');
    try {
      await runPcAlexMinigame({
        scene: ctx.scene,
        room: 'habitacion-alex',
        roomLabel: 'PC Alex',
      });
    } finally {
      setLimeZuTexture(ctx.scene, 'lz-pc-alex-on-l', 'lz-pc-alex-off-l');
      setLimeZuTexture(ctx.scene, 'lz-pc-alex-on-r', 'lz-pc-alex-off-r');
    }
    return;
  }
  if (ctx.interactable.id === 'pc-secreta') {
    // S2.5: el PC de la sala secreta abre la CAJA FUERTE (sólo si la
    // hatch ya está abierta, narrativamente). Aquí lanzamos el minijuego
    // de la caja fuerte directamente.
    await runSafeMinigame({
      scene: ctx.scene,
      room: 'habitacion-secreta',
      roomLabel: 'Caja fuerte',
    });
    return;
  }
  // Fallback otros PC.
  await ctx.showDialog(
    ['*un PC con muchos cables.*', '"...esto huele a fin de juego."'],
    { speaker: 'María', portrait: 'maria' },
  );
};

// S2.4: handler dedicado para los altavoces de Alex — toggle música.
INTERACTION_HANDLERS['speakers'] = async (ctx) => {
  if (MUSIC_TRACKS.length === 0) {
    await ctx.showDialog(
      [
        '*tocas el botón de los altavoces.*',
        '"...silencio. todavía no hay música cargada."',
        '"PRÓXIMAMENTE: Alex me pasa la playlist."',
      ],
      { speaker: 'María', portrait: 'maria' },
    );
    return;
  }
  if (AudioBus.isPlaying()) {
    AudioBus.stop();
    await ctx.showDialog(
      ['*paras la música.*', '"silencio."'],
      { speaker: 'María', portrait: 'maria' },
    );
    return;
  }
  const track = AudioBus.next();
  if (!track) {
    await ctx.showDialog(
      ['*algo no va con los altavoces.*'],
      { speaker: 'María', portrait: 'maria' },
    );
    return;
  }
  await ctx.showDialog(
    [
      '*pulsas play.*',
      `♪ "${track.title}"${track.artist ? ' — ' + track.artist : ''} ♪`,
      '"... (suena)"',
    ],
    { speaker: 'María', portrait: 'maria' },
  );
};

// S1 (Día 10): handlers ricos para mobiliario emblemático.
// Cada uno reemplaza el stub del LINES loop de arriba.
INTERACTION_HANDLERS['tv'] = tvHandler;
INTERACTION_HANDLERS['sofa'] = sofaHandler;
INTERACTION_HANDLERS['bed'] = bedHandler;
INTERACTION_HANDLERS['mirror'] = mirrorHandler;
INTERACTION_HANDLERS['bookshelf'] = bookshelfHandler;
INTERACTION_HANDLERS['wardrobe'] = wardrobeHandler;
INTERACTION_HANDLERS['fridge'] = fridgeHandler;

INTERACTION_HANDLERS['front-door'] = async (ctx) => {
  // eslint-disable-next-line no-console
  console.log('[interact] front-door → salir al rellano');
  await ctx.showDialog(
    ['La puerta principal.', 'Salgo un momento al rellano.'],
    { speaker: 'María', portrait: 'maria' },
  );
  const scene = ctx.scene;
  scene.cameras.main.fadeOut(500, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start('HubScene');
  });
};

// ── S2.10: handlers ON/OFF + piano + fireplace ─────────────────────

// Stove: 3 estados — off → on → cooking → off (cycle al pulsar E).
const STOVE_ORDER = ['off', 'on', 'cooking'] as const;
const stoveState: { idx: number } = { idx: 0 };
INTERACTION_HANDLERS['stove'] = async (ctx) => {
  Sfx.toggle();
  const prev = STOVE_ORDER[stoveState.idx];
  stoveState.idx = (stoveState.idx + 1) % STOVE_ORDER.length;
  const next = STOVE_ORDER[stoveState.idx];
  const prevKey = LIMEZU_STATES.stove[prev];
  const nextKey = LIMEZU_STATES.stove[next];
  if (prevKey && nextKey) setLimeZuTexture(ctx.scene, prevKey, nextKey);
  const flavor: Record<string, string[]> = {
    off:     ['"apagado, perfecto."'],
    on:      ['*enciendes el fogón.*', '"hierve el agua."'],
    cooking: ['*pones la sartén.*', '"chiss... chiss..."'],
  };
  await ctx.showDialog(flavor[next], { speaker: 'María', portrait: 'maria' });
};

// Fireplace: toggle off/on.
const fireplaceState: { on: boolean } = { on: false };
INTERACTION_HANDLERS['fireplace'] = async (ctx) => {
  Sfx.toggle();
  fireplaceState.on = !fireplaceState.on;
  const oldKey = fireplaceState.on ? LIMEZU_STATES.chimenea.off : LIMEZU_STATES.chimenea.on;
  const newKey = fireplaceState.on ? LIMEZU_STATES.chimenea.on : LIMEZU_STATES.chimenea.off;
  setLimeZuTexture(ctx.scene, oldKey, newKey);
  await ctx.showDialog(
    fireplaceState.on
      ? ['*enciendes la chimenea.*', '"se nota el calor de inmediato."']
      : ['*apagas la chimenea.*', '"hasta luego, fueguito."'],
    { speaker: 'María', portrait: 'maria' },
  );
};

// WC: toggle closed/open (efímero — luego baja la tapa solo).
const wcState: { open: boolean } = { open: false };
INTERACTION_HANDLERS['wc'] = async (ctx) => {
  Sfx.toggle();
  wcState.open = !wcState.open;
  const oldKey = wcState.open ? LIMEZU_STATES.wc.closed : LIMEZU_STATES.wc.open;
  const newKey = wcState.open ? LIMEZU_STATES.wc.open : LIMEZU_STATES.wc.closed;
  setLimeZuTexture(ctx.scene, oldKey, newKey);
  await ctx.showDialog(
    wcState.open
      ? ['*levantas la tapa.*', '"... necesitaba un momento."']
      : ['*bajas la tapa.*', '"todo en orden."'],
    { speaker: 'María', portrait: 'maria' },
  );
};

// ── Piano: Kirk.mp3 + lock movement (usa MusicSession) ────────────
// El handler 'piano' lo usan dos interactables: 'piano' real (Kirk.mp3)
// y 'arpa' (Kirk2.mp3). Diferencia por interactable.id.
INTERACTION_HANDLERS['piano'] = async (ctx) => {
  const isArpa = ctx.interactable.id === 'arpa';
  const track = isArpa ? '/assets/audio/music/Kirk2.mp3' : '/assets/audio/music/kirk.mp3';
  const title = isArpa ? '♫ ¿tocas el arpa?' : '♫ ¿tocas el piano?';
  await playMusicSession({
    scene: ctx.scene,
    track,
    promptTitle: title,
    lockMovement: true,
    volume: 0.7,
  });
  await ctx.showDialog(
    isArpa
      ? ['*acaba la cuerda final.*', '"...sigo sin saber tocar bien, pero suena bonito."']
      : ['*acabas de tocar la pieza entera.*', '"...no estuvo mal."'],
    { speaker: 'María', portrait: 'maria' },
  );
};

// ── Wind-toy (juguete cuerda navideño): Kirk3.mp3 + shake + giro ──
INTERACTION_HANDLERS['wind-toy'] = async (ctx) => {
  await playMusicSession({
    scene: ctx.scene,
    track: '/assets/audio/music/kirk3.mp3',
    promptTitle: '⚙ ¿le das cuerda?',
    lockMovement: false,        // María puede moverse
    spriteKey: 'lz-toy-wind',
    shakeAlt: 'lz-toy-wind-2',  // alterna las dos texturas → parece girar
    volume: 0.6,
  });
  await ctx.showDialog(
    ['*el juguete se para. queda mirando al cielo.*', '"...gracias, peque."'],
    { speaker: 'María', portrait: 'maria' },
  );
};
