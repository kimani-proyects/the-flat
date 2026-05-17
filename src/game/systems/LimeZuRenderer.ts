import * as Phaser from 'phaser';
import { TILE_SIZE } from '../data/floorplan';

/**
 * LimeZuRenderer — pinta sprites individuales del pack Theme_Sorter
 * Black_Shadow_Singles de LimeZu en posiciones de tile concretas.
 *
 * Cada item:
 *   - `key`: identificador único de Phaser ("lz-bedroom-97").
 *   - `path`: ruta pública del PNG individual.
 *   - `tx, ty`: posición en tiles del top-left del sprite.
 *   - `size`: 16, 32 o 48 (selecciona la carpeta correspondiente).
 *   - `depth`: orden de pintado (default 5).
 *   - `solid?`: si bloquea paso (collider).
 *
 * Los assets se cargan en BootScene mediante el helper `getAllImageLoads()`
 * y se pintan aquí al crear la escena.
 */

const ROOT = '/assets/tilesets/limezu/1_Interiors';

/** Helper: build a path to a singles asset. */
function singlePath(size: 16 | 32 | 48, themeFolder: string, fileName: string): string {
  const sizeSuffix = `${size}x${size}`;
  return `${ROOT}/${sizeSuffix}/Theme_Sorter_Black_Shadow_Singles/${themeFolder}/${fileName}`;
}

export interface LimeZuItem {
  /** Phaser texture key (estable). */
  key: string;
  /** Path al PNG. */
  path: string;
  /** Posición tile X,Y (top-left). */
  tx: number;
  ty: number;
  /** Tamaño base del sprite. */
  size: 16 | 32 | 48;
  /** Depth render. */
  depth?: number;
  /** Si tiene hitbox sólido. */
  solid?: boolean;
  /** Tile width/height del footprint (default 1×1). */
  fw?: number;
  fh?: number;
}

/**
 * Catálogo del piso S2.9 — todos los IDs facilitados por Alex.
 * Convención: theme folder = "{N}_{Name}_Black_Shadow_Singles_16x16".
 * File pattern = "{ThemePrefix}_Shadow_Singles_{ID}.png" o
 * "{ThemePrefix}_Black_Shadow_Singles_{ID}.png" según carpeta (LimeZu
 * inconsistente, ya está mapeado correctamente abajo).
 */
const ITEMS: LimeZuItem[] = [
  // ── DORMITORIO ALEX ────────────────────────────────────────────────
  { key: 'lz-bed-alex',      tx: 1,  ty: 28, size: 16, fw: 2, fh: 3, solid: true, depth: 11,
    path: singlePath(16, '4_Bedroom_Black_Shadow_SIngles_16x16', 'Bedroom_Black_Shadow_Singles_135.png') },
  // Pesas Alex (Gym 144).
  { key: 'lz-gym-alex',      tx: 5,  ty: 22, size: 16, depth: 12,
    path: singlePath(16, '8_Gym_Black_Shadow_Singles_16x16', 'Gym_Shadow_Singles_144.png') },
  // Mesita escritorio PC Alex (Jail 89, 2 tiles ancho para los 2 sprites del PC).
  { key: 'lz-desk-alex',     tx: 10, ty: 22, size: 16, fw: 2, solid: true, depth: 10,
    path: singlePath(16, '18_Jail_Black_Shadow_Singles_16x16', 'Jail_Black_Shadow_Singles_89.png') },
  // PC Alex OFF (2 sprites adyacentes: 129 izq + 130 dcha).
  { key: 'lz-pc-alex-off-l', tx: 10, ty: 21, size: 16, solid: true, depth: 12,
    path: singlePath(16, '18_Jail_Black_Shadow_Singles_16x16', 'Jail_Black_Shadow_Singles_129.png') },
  { key: 'lz-pc-alex-off-r', tx: 11, ty: 21, size: 16, solid: true, depth: 12,
    path: singlePath(16, '18_Jail_Black_Shadow_Singles_16x16', 'Jail_Black_Shadow_Singles_130.png') },
  { key: 'lz-pc-alex-on-l',  tx: 10, ty: 21, size: 16, solid: true, depth: 12,
    path: singlePath(16, '18_Jail_Black_Shadow_Singles_16x16', 'Jail_Black_Shadow_Singles_131.png') },
  { key: 'lz-pc-alex-on-r',  tx: 11, ty: 21, size: 16, solid: true, depth: 12,
    path: singlePath(16, '18_Jail_Black_Shadow_Singles_16x16', 'Jail_Black_Shadow_Singles_132.png') },
  // Silla roja delante del PC de Alex.
  { key: 'lz-chair-alex',    tx: 10, ty: 23, size: 16, depth: 13,
    path: singlePath(16, '18_Jail_Black_Shadow_Singles_16x16', 'Jail_Black_Shadow_Singles_265.png') },

  // ── DORMITORIO MARÍA ───────────────────────────────────────────────
  { key: 'lz-bed-maria',     tx: 44, ty: 12, size: 16, fw: 2, fh: 3, solid: true, depth: 11,
    path: singlePath(16, '4_Bedroom_Black_Shadow_SIngles_16x16', 'Bedroom_Black_Shadow_Singles_97.png') },
  { key: 'lz-osito',         tx: 46, ty: 14, size: 16, depth: 12,
    path: singlePath(16, '4_Bedroom_Black_Shadow_SIngles_16x16', 'Bedroom_Black_Shadow_Singles_179.png') },
  { key: 'lz-armario-maria', tx: 28, ty: 24, size: 16, fw: 2, fh: 2, solid: true, depth: 11,
    path: singlePath(16, '4_Bedroom_Black_Shadow_SIngles_16x16', 'Bedroom_Black_Shadow_Singles_409.png') },
  { key: 'lz-estanteria-maria', tx: 30, ty: 12, size: 16, fw: 2, fh: 1, solid: true, depth: 11,
    path: singlePath(16, '4_Bedroom_Black_Shadow_SIngles_16x16', 'Bedroom_Black_Shadow_Singles_408.png') },
  // Pesas en la hab de María (146 + 147 juntas).
  { key: 'lz-gym-maria-1',   tx: 30, ty: 27, size: 16, depth: 12,
    path: singlePath(16, '8_Gym_Black_Shadow_Singles_16x16', 'Gym_Shadow_Singles_146.png') },
  { key: 'lz-gym-maria-2',   tx: 31, ty: 27, size: 16, depth: 12,
    path: singlePath(16, '8_Gym_Black_Shadow_Singles_16x16', 'Gym_Shadow_Singles_147.png') },
  // Mesita escritorio PC María + PC OFF/ON. PC María es 1 tile.
  { key: 'lz-desk-maria',    tx: 27, ty: 14, size: 16, solid: true, depth: 10,
    path: singlePath(16, '18_Jail_Black_Shadow_Singles_16x16', 'Jail_Black_Shadow_Singles_89.png') },
  { key: 'lz-pc-maria-off',  tx: 27, ty: 13, size: 16, solid: true, depth: 12,
    path: singlePath(16, '18_Jail_Black_Shadow_Singles_16x16', 'Jail_Black_Shadow_Singles_152.png') },
  { key: 'lz-pc-maria-on',   tx: 27, ty: 13, size: 16, solid: true, depth: 12,
    path: singlePath(16, '18_Jail_Black_Shadow_Singles_16x16', 'Jail_Black_Shadow_Singles_151.png') },
  // Silla roja delante del PC de María.
  { key: 'lz-chair-maria',   tx: 27, ty: 15, size: 16, depth: 13,
    path: singlePath(16, '18_Jail_Black_Shadow_Singles_16x16', 'Jail_Black_Shadow_Singles_265.png') },

  // ── SALÓN ──────────────────────────────────────────────────────────
  // Chimenea OFF (cambia a 108 al encender).
  { key: 'lz-chimenea-off',  tx: 7,  ty: 21, size: 16, fw: 2, fh: 2, solid: true, depth: 11,
    path: singlePath(16, '2_LivingRoom_Black_Shadow_Singles_16x16', 'Living_Room_Black_Shadow_Singles_107.png') },
  { key: 'lz-chimenea-on',   tx: 7,  ty: 21, size: 16, fw: 2, fh: 2, solid: true, depth: 11,
    path: singlePath(16, '2_LivingRoom_Black_Shadow_Singles_16x16', 'Living_Room_Black_Shadow_Singles_108.png') },
  // Lámparas distintas para varios rincones.
  { key: 'lz-lamp-1',        tx: 35, ty: 7,  size: 16, depth: 11,
    path: singlePath(16, '2_LivingRoom_Black_Shadow_Singles_16x16', 'Living_Room_Black_Shadow_Singles_85.png') },
  { key: 'lz-lamp-2',        tx: 41, ty: 5,  size: 16, depth: 11,
    path: singlePath(16, '2_LivingRoom_Black_Shadow_Singles_16x16', 'Living_Room_Black_Shadow_Singles_86.png') },
  { key: 'lz-lamp-3',        tx: 41, ty: 16, size: 16, depth: 11,
    path: singlePath(16, '2_LivingRoom_Black_Shadow_Singles_16x16', 'Living_Room_Black_Shadow_Singles_87.png') },
  // Macetas variadas.
  { key: 'lz-plant-1',       tx: 35, ty: 9,  size: 16, depth: 11,
    path: singlePath(16, '2_LivingRoom_Black_Shadow_Singles_16x16', 'Living_Room_Black_Shadow_Singles_13.png') },
  { key: 'lz-plant-2',       tx: 47, ty: 9,  size: 16, depth: 11,
    path: singlePath(16, '2_LivingRoom_Black_Shadow_Singles_16x16', 'Living_Room_Black_Shadow_Singles_14.png') },
  { key: 'lz-plant-3',       tx:  2, ty: 19, size: 16, depth: 11,
    path: singlePath(16, '2_LivingRoom_Black_Shadow_Singles_16x16', 'Living_Room_Black_Shadow_Singles_17.png') },
  { key: 'lz-plant-4',       tx: 14, ty: 27, size: 16, depth: 11,
    path: singlePath(16, '2_LivingRoom_Black_Shadow_Singles_16x16', 'Living_Room_Black_Shadow_Singles_18.png') },
  // Cuencos de fruta sobre la mesa de comedor.
  { key: 'lz-fruit-1',       tx: 22, ty: 6,  size: 16, depth: 14,
    path: singlePath(16, '2_LivingRoom_Black_Shadow_Singles_16x16', 'Living_Room_Black_Shadow_Singles_49.png') },
  { key: 'lz-fruit-2',       tx: 23, ty: 6,  size: 16, depth: 14,
    path: singlePath(16, '2_LivingRoom_Black_Shadow_Singles_16x16', 'Living_Room_Black_Shadow_Singles_50.png') },
  // Florecitas (Grocery_431) en jarrón sobre cómoda.
  { key: 'lz-flowers',       tx: 24, ty: 6,  size: 16, depth: 14,
    path: singlePath(16, '16_Grocery_Store_Black_Shadow_Singles_16x16', 'Grocery_Store_Black_Shadow_Singles_431.png') },

  // ── MÚSICA (a María le gusta) ──────────────────────────────────────
  { key: 'lz-arpa',          tx: 33, ty: 16, size: 16, fh: 2, solid: true, depth: 11,
    path: singlePath(16, '6_Music_and_Sport_Black_Shadow_Singles_16x16', 'Music_and_Sport_Black_Shadow_Singles_212.png') },
  { key: 'lz-piano',         tx: 35, ty: 13, size: 16, fw: 2, solid: true, depth: 11,
    path: singlePath(16, '6_Music_and_Sport_Black_Shadow_Singles_16x16', 'Music_and_Sport_Black_Shadow_Singles_174.png') },

  // ── ARTE ───────────────────────────────────────────────────────────
  { key: 'lz-easel-table',   tx: 39, ty: 14, size: 16, solid: true, depth: 11,
    path: singlePath(16, '7_Art_Black_Shadow_Singles_16x16', 'Art_Shadow_Singles_24.png') },
  { key: 'lz-easel-canvas',  tx: 40, ty: 14, size: 16, depth: 12,
    path: singlePath(16, '7_Art_Black_Shadow_Singles_16x16', 'Art_Shadow_Singles_40.png') },

  // ── TERRAZA: cumple + platos ──────────────────────────────────────
  { key: 'lz-balloon-1',     tx:  3, ty:  3, size: 16, depth: 12,
    path: singlePath(16, '10_Birthday_Party_Black_Shadow_Singles_16x16', 'Birthday_Party_Shadow_Singles_17.png') },
  { key: 'lz-balloon-2',     tx:  6, ty:  3, size: 16, depth: 12,
    path: singlePath(16, '10_Birthday_Party_Black_Shadow_Singles_16x16', 'Birthday_Party_Shadow_Singles_18.png') },
  { key: 'lz-balloon-3',     tx:  9, ty:  3, size: 16, depth: 12,
    path: singlePath(16, '10_Birthday_Party_Black_Shadow_Singles_16x16', 'Birthday_Party_Shadow_Singles_19.png') },
  { key: 'lz-party-table',   tx:  4, ty:  6, size: 16, fw: 2, solid: true, depth: 11,
    path: singlePath(16, '14_Basement_Black_Shadow_Singles_16x16', 'Basement_Shadow_Singles_1.png') },
  { key: 'lz-cake',          tx:  4, ty:  5, size: 16, depth: 14,
    path: singlePath(16, '10_Birthday_Party_Black_Shadow_Singles_16x16', 'Birthday_Party_Shadow_Singles_9.png') },
  { key: 'lz-present',       tx:  5, ty:  5, size: 16, depth: 14,
    path: singlePath(16, '10_Birthday_Party_Black_Shadow_Singles_16x16', 'Birthday_Party_Shadow_Singles_3.png') },
  // Platos en la terraza (Birthday 13).
  { key: 'lz-party-plates',  tx:  7, ty:  5, size: 16, depth: 14,
    path: singlePath(16, '10_Birthday_Party_Black_Shadow_Singles_16x16', 'Birthday_Party_Shadow_Singles_13.png') },

  // S2.11: juguete cuerda navideño en la terraza.
  { key: 'lz-toy-wind',   tx:  3, ty:  6, size: 16, depth: 14,
    path: singlePath(16, '15_Christmas_Black_Shadow_Singles_16x16', 'Christmas_Shadow_Singles_73.png') },
  { key: 'lz-toy-wind-2', tx:  3, ty:  6, size: 16, depth: 14,
    path: singlePath(16, '15_Christmas_Black_Shadow_Singles_16x16', 'Christmas_Shadow_Singles_74.png') },

  // ── SALÓN: TV (2 piezas adyacentes) — reemplaza la TV procedural ──
  { key: 'lz-tv-left',       tx: 37, ty: 1,  size: 16, solid: true, depth: 11,
    path: singlePath(16, '14_Basement_Black_Shadow_Singles_16x16', 'Basement_Shadow_Singles_194.png') },
  { key: 'lz-tv-right',      tx: 38, ty: 1,  size: 16, solid: true, depth: 11,
    path: singlePath(16, '14_Basement_Black_Shadow_Singles_16x16', 'Basement_Shadow_Singles_195.png') },

  // S2.10: SOFÁ del salón — Basement_51/52/53 en fila frente a la TV.
  { key: 'lz-sofa-l', tx: 36, ty: 7, size: 16, solid: true, depth: 11,
    path: singlePath(16, '14_Basement_Black_Shadow_Singles_16x16', 'Basement_Shadow_Singles_51.png') },
  { key: 'lz-sofa-m', tx: 37, ty: 7, size: 16, solid: true, depth: 11,
    path: singlePath(16, '14_Basement_Black_Shadow_Singles_16x16', 'Basement_Shadow_Singles_52.png') },
  { key: 'lz-sofa-r', tx: 38, ty: 7, size: 16, solid: true, depth: 11,
    path: singlePath(16, '14_Basement_Black_Shadow_Singles_16x16', 'Basement_Shadow_Singles_53.png') },

  // ── BAÑO ───────────────────────────────────────────────────────────
  { key: 'lz-sink',          tx:  5, ty: 13, size: 16, solid: true, depth: 11,
    path: singlePath(16, '3_Bathroom_Black_Shadow_Singles_16x16', 'Bathroom_Black_Shadow_Singles_5.png') },
  { key: 'lz-wc-closed',     tx: 11, ty: 12, size: 16, solid: true, depth: 11,
    path: singlePath(16, '3_Bathroom_Black_Shadow_Singles_16x16', 'Bathroom_Black_Shadow_Singles_30.png') },
  { key: 'lz-wc-open',       tx: 11, ty: 12, size: 16, solid: true, depth: 11,
    path: singlePath(16, '3_Bathroom_Black_Shadow_Singles_16x16', 'Bathroom_Black_Shadow_Singles_31.png') },
  { key: 'lz-washer',        tx:  8, ty: 12, size: 16, solid: true, depth: 11,
    path: singlePath(16, '3_Bathroom_Black_Shadow_Singles_16x16', 'Bathroom_Black_Shadow_Singles_89.png') },

  // ── LIBRERÍA & ACCESORIOS ──────────────────────────────────────────
  { key: 'lz-bookshelf-phall', tx: 31, ty: 1, size: 16, fh: 2, solid: true, depth: 11,
    path: singlePath(16, '5_Classroom_and_Library_Black_Shadow_Singles_16x16', 'Classroom_and_Library_Singles_43.png') },
  // Bola del mundo MOVIDA al escritorio del salón (no en hab María).
  { key: 'lz-globe',         tx: 34, ty: 1, size: 16, depth: 12,
    path: singlePath(16, '5_Classroom_and_Library_Black_Shadow_Singles_16x16', 'Classroom_and_Library_Singles_34.png') },

  // ── COCINA ─────────────────────────────────────────────────────────
  { key: 'lz-stove-off',     tx: 17, ty: 1, size: 16, solid: true, depth: 11,
    path: singlePath(16, '12_Kitchen_Black_Shadow_Singles_16x16', 'Kitchen_Shadow_Singles_154.png') },
  { key: 'lz-stove-on',      tx: 17, ty: 1, size: 16, solid: true, depth: 11,
    path: singlePath(16, '12_Kitchen_Black_Shadow_Singles_16x16', 'Kitchen_Shadow_Singles_152.png') },
  { key: 'lz-stove-cooking', tx: 17, ty: 1, size: 16, solid: true, depth: 11,
    path: singlePath(16, '12_Kitchen_Black_Shadow_Singles_16x16', 'Kitchen_Shadow_Singles_153.png') },
  // Radio cocina (Gym_100 — pequeño altavoz).
  { key: 'lz-radio-cocina',  tx: 23, ty: 1, size: 16, depth: 11,
    path: singlePath(16, '8_Gym_Black_Shadow_Singles_16x16', 'Gym_Shadow_Singles_100.png') },

  // ── JAPANESE (a María le gusta) ───────────────────────────────────
  { key: 'lz-jap-table',     tx: 36, ty: 4,  size: 16, fw: 2, fh: 2, solid: true, depth: 11,
    path: singlePath(16, '20_Japanese_Interiors_Black_Shadow_Singles_16x16', 'Japanese_Interiors_Black_Shadow_Singles_49.png') },
  { key: 'lz-jap-scroll',    tx: 35, ty: 11, size: 16, depth: 12,
    path: singlePath(16, '20_Japanese_Interiors_Black_Shadow_Singles_16x16', 'Japanese_Interiors_Black_Shadow_Singles_18.png') },
  { key: 'lz-katana',        tx: 40, ty: 11, size: 16, depth: 12,
    path: singlePath(16, '20_Japanese_Interiors_Black_Shadow_Singles_16x16', 'Japanese_Interiors_Black_Shadow_Singles_37.png') },
  // Zapatos en la entrada (Japanese 112).
  { key: 'lz-shoes-entrada', tx: 20, ty: 13, size: 16, depth: 13,
    path: singlePath(16, '20_Japanese_Interiors_Black_Shadow_Singles_16x16', 'Japanese_Interiors_Black_Shadow_Singles_112.png') },

  // ── SALA SECRETA ──────────────────────────────────────────────────
  { key: 'lz-safe',          tx: 46, ty: 25, size: 16, solid: true, depth: 12,
    path: singlePath(16, '5_Classroom_and_Library_Black_Shadow_Singles_16x16', 'Classroom_and_Library_Singles_40.png') },
  { key: 'lz-hatch',         tx: 44, ty: 30, size: 16, depth: 5,
    path: singlePath(16, '4_Bedroom_Black_Shadow_SIngles_16x16', 'Bedroom_Black_Shadow_Singles_225.png') },
];

/**
 * Items que reemplazan muebles procedurales del StaticFurnitureRenderer.
 * Si el item está aquí, el SFR debería SKIPearlo (key match para suprimir
 * el placeholder).
 */
export const LIMEZU_REPLACES_KEYS: ReadonlySet<string> = new Set([
  'bed-maria', 'bed-alex', 'tv', 'fridge', 'stove', 'sink', 'washbasin', 'wc', 'bathtub',
]);

/** Devuelve el preload manifest: clave + URL. Llamar desde BootScene. */
export function getAllImageLoads(): Array<{ key: string; path: string }> {
  return ITEMS.map((i) => ({ key: i.key, path: i.path }));
}

/**
 * Pinta TODOS los items LimeZu en la escena. Devuelve un handle para
 * cleanup. Skipea automáticamente los que no tienen texture cargada
 * (assets faltantes en disco).
 */
export function paintLimeZu(scene: Phaser.Scene): { destroy: () => void } {
  const created: Phaser.GameObjects.GameObject[] = [];
  // Para chimenea/stove/wc multi-estado, dejamos solo el primero por defecto.
  const skipKeys = new Set<string>(['lz-chimenea-on', 'lz-stove-on', 'lz-stove-cooking', 'lz-wc-open', 'lz-toy-wind-2', 'lz-pc-maria-on', 'lz-pc-alex-on-l', 'lz-pc-alex-on-r']);
  for (const item of ITEMS) {
    if (skipKeys.has(item.key)) continue;
    if (!scene.textures.exists(item.key)) {
      // eslint-disable-next-line no-console
      console.warn(`[LimeZu] texture missing: ${item.key} (${item.path})`);
      continue;
    }
    const cx = item.tx * TILE_SIZE + (item.fw ?? 1) * TILE_SIZE / 2;
    const cy = item.ty * TILE_SIZE + (item.fh ?? 1) * TILE_SIZE / 2;
    const img = scene.add.image(cx, cy, item.key).setDepth(item.depth ?? 5);
    created.push(img);
  }
  return {
    destroy: () => {
      for (const o of created) if ((o as { scene?: unknown }).scene) o.destroy();
    },
  };
}

// ─── HTML GIF overlays para los PCs animados ─────────────────────────

/**
 * Monta un <img> animado (gif LimeZu) encima del canvas, posicionado
 * sobre los tiles indicados. Reposiciona en resize automáticamente.
 */
export interface GifOverlayConfig {
  url: string;
  tx: number;
  ty: number;
  fw?: number;   // tiles wide (default 1)
  fh?: number;   // tiles tall (default 1)
  zIndex?: number;
}

export function installGifOverlay(scene: Phaser.Scene, cfg: GifOverlayConfig): { destroy: () => void } {
  if (typeof document === 'undefined') return { destroy: () => {} };
  const img = document.createElement('img');
  img.src = cfg.url;
  img.alt = '';
  img.style.position = 'fixed';
  img.style.pointerEvents = 'none';
  img.style.zIndex = String(cfg.zIndex ?? 50);
  img.style.imageRendering = 'pixelated';
  const fw = cfg.fw ?? 1;
  const fh = cfg.fh ?? 1;

  const reposition = () => {
    const canvas = scene.game.canvas as HTMLCanvasElement;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const sx = r.width / scene.cameras.main.width;
    const sy = r.height / scene.cameras.main.height;
    // Posición mundial → screen: (tile * TILE - camScrollX) * scale + canvasLeft
    const cam = scene.cameras.main;
    const wx = cfg.tx * TILE_SIZE - cam.scrollX;
    const wy = cfg.ty * TILE_SIZE - cam.scrollY;
    img.style.left = r.left + wx * sx + 'px';
    img.style.top = r.top + wy * sy + 'px';
    img.style.width = fw * TILE_SIZE * sx + 'px';
    img.style.height = fh * TILE_SIZE * sy + 'px';
  };

  // Reposiciona en cada frame (porque cam.scroll puede moverse).
  const tickHandler = () => reposition();
  scene.events.on('update', tickHandler);
  window.addEventListener('resize', reposition);
  document.body.appendChild(img);
  reposition();

  return {
    destroy: () => {
      scene.events.off('update', tickHandler);
      window.removeEventListener('resize', reposition);
      if (img.parentNode) img.parentNode.removeChild(img);
    },
  };
}

// ─── ON/OFF state toggles ─────────────────────────────────────────────
/**
 * Mapping de estados alternativos. Para items con multi-estado (chimenea,
 * stove, WC, PCs), la key base apunta a las variantes.
 */
export const LIMEZU_STATES: Record<string, Record<string, string>> = {
  chimenea: { off: 'lz-chimenea-off', on: 'lz-chimenea-on' },
  stove:    { off: 'lz-stove-off', on: 'lz-stove-on', cooking: 'lz-stove-cooking' },
  wc:       { closed: 'lz-wc-closed', open: 'lz-wc-open' },
  pcMaria:  { off: 'lz-pc-maria-off', on: 'lz-pc-maria-on' },
  pcAlexL:  { off: 'lz-pc-alex-off-l', on: 'lz-pc-alex-on-l' },
  pcAlexR:  { off: 'lz-pc-alex-off-r', on: 'lz-pc-alex-on-r' },
};

/** Cambia la textura de un sprite ya pintado por su clave base. */
export function setLimeZuTexture(scene: Phaser.Scene, oldKey: string, newKey: string): boolean {
  if (!scene.textures.exists(newKey)) return false;
  // Buscar la image que tenga ese key actual.
  const children = scene.children.list as Phaser.GameObjects.GameObject[];
  for (const obj of children) {
    const img = obj as Phaser.GameObjects.Image;
    if (img.type === 'Image' && img.texture?.key === oldKey) {
      img.setTexture(newKey);
      return true;
    }
  }
  return false;
}
