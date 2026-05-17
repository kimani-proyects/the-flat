import * as Phaser from 'phaser';

/**
 * UiAtlas — registro de sub-frames dentro de Modern_UI_Style_1.png.
 *
 * El sheet es grande y heterogéneo (paneles de varias piezas, teclas,
 * iconos, barras...). En vez de tratarlo como un grid uniforme (imposible:
 * hay elementos de 16×16, 32×16, 48×48, etc.) registramos AQUÍ los
 * sub-rectángulos que realmente usamos, por nombre. Si algún frame
 * resulta estar en otra coordenada tras inspeccionar con /inspector,
 * se ajusta aquí — un único sitio.
 *
 * Uso desde una escena:
 *   import { ensureUiAtlas, UI_FRAMES } from '../systems/UiAtlas';
 *   ensureUiAtlas(this);  // idempotente
 *   this.add.image(x, y, 'ui', UI_FRAMES.keyE);
 *
 * IMPORTANTE: las coordenadas están puestas a ojo basadas en el layout
 * típico del pack (esquina sup-izq = paneles 3×3 pequeños, centro =
 * iconos, esquina sup-der = teclas). Si alguna queda mal, abrir
 * /inspector con sheet="ModernUI" y corregir aquí el (x,y) del frame.
 */

export const UI_FRAMES = {
  // Paneles 9-slice (3×3 tiles de 16×16). Coordenada = top-left del panel
  // completo (48×48 px). El 9-slice lo aplica quien lo use.
  panelSmall: 'ui-panelSmall',
  panelMedium: 'ui-panelMedium',

  // Teclas del teclado (~16×16 cada una).
  keyE: 'ui-keyE',
  keySpace: 'ui-keySpace',
  keyEnter: 'ui-keyEnter',
  keyEsc: 'ui-keyEsc',

  // Iconos comunes (16×16).
  iconHeart: 'ui-iconHeart',
  iconStar: 'ui-iconStar',
  iconGift: 'ui-iconGift',
  iconCoin: 'ui-iconCoin',
  iconArrowDown: 'ui-iconArrowDown',
  iconArrowUp: 'ui-iconArrowUp',
} as const;

interface FrameDef {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Coordenadas iniciales (aproximadas). Modern_UI_Style_1.png es ~960×640
 * según el thumbnail. Estas coords se afinan con /inspector si hace falta.
 *
 * Layout observado a ojo en el sheet:
 *   - Top-left (x=0..64, y=0..80): paneles 9-slice beige pequeños.
 *   - Top-center/right: iconos (frutas, gemas, estrellas, corazones).
 *   - Bloque grande derecha (x~720+): teclas del teclado en columnas.
 *   - Middle: barras de progreso, botones, iconos-en-caja.
 */
const FRAME_DEFS: FrameDef[] = [
  // --- Paneles 9-slice ---
  // Panel pequeño beige (3×3 = 48×48 px): esquina sup-izq del sheet.
  { name: UI_FRAMES.panelSmall, x: 0, y: 0, w: 48, h: 48 },
  // Panel mediano (más ancho, mismo estilo): segundo bloque a la derecha.
  { name: UI_FRAMES.panelMedium, x: 0, y: 48, w: 48, h: 32 },

  // --- Teclas ---
  // Cada tecla individual. Coordenadas dentro del gran bloque de teclas
  // (top-right del sheet, columnas con A-Z, flechas, ESC, Space, Enter).
  // En ModernUI v1 las teclas de letra están a partir de ~x=720 en filas.
  // Estos valores son un PUNTO DE PARTIDA: confirmar en /inspector.
  { name: UI_FRAMES.keyE, x: 800, y: 16, w: 16, h: 16 },
  { name: UI_FRAMES.keySpace, x: 800, y: 48, w: 32, h: 16 },
  { name: UI_FRAMES.keyEnter, x: 832, y: 48, w: 32, h: 16 },
  { name: UI_FRAMES.keyEsc, x: 832, y: 16, w: 16, h: 16 },

  // --- Iconos (16×16 cada uno) ---
  // Fila de iconos frutas/gemas/emojis alrededor de y=16, x=64+.
  { name: UI_FRAMES.iconHeart, x: 80, y: 80, w: 16, h: 16 },
  { name: UI_FRAMES.iconStar, x: 96, y: 16, w: 16, h: 16 },
  { name: UI_FRAMES.iconGift, x: 144, y: 32, w: 16, h: 16 },
  { name: UI_FRAMES.iconCoin, x: 96, y: 384, w: 16, h: 16 },
  { name: UI_FRAMES.iconArrowDown, x: 112, y: 352, w: 16, h: 16 },
  { name: UI_FRAMES.iconArrowUp, x: 96, y: 352, w: 16, h: 16 },
];

let registered = false;

/**
 * Registra (idempotentemente) los sub-frames en la texture 'ui'.
 * Se puede llamar desde cualquier escena en create() — solo hace trabajo
 * la primera vez.
 */
export function ensureUiAtlas(scene: Phaser.Scene): void {
  if (registered) return;
  if (!scene.textures.exists('ui')) {
    // eslint-disable-next-line no-console
    console.warn('[UiAtlas] texture "ui" no cargada; BootScene debería cargarla.');
    return;
  }
  const tex = scene.textures.get('ui');
  for (const f of FRAME_DEFS) {
    // Si ya existe, saltamos (HMR-safe).
    if (tex.has(f.name)) continue;
    tex.add(f.name, 0, f.x, f.y, f.w, f.h);
  }
  registered = true;
  // eslint-disable-next-line no-console
  console.log(`[UiAtlas] registrados ${FRAME_DEFS.length} sub-frames en 'ui'.`);
}

/**
 * Helper: devuelve true si un frame está registrado. Útil para tests
 * o fallback visual cuando una coord está mal y queremos pintar un
 * rectángulo de placeholder en vez del frame.
 */
export function hasUiFrame(scene: Phaser.Scene, name: string): boolean {
  if (!scene.textures.exists('ui')) return false;
  return scene.textures.get('ui').has(name);
}
