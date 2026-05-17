import floorplanJson from './floorplan.json';

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floorType: 'wood' | 'tile' | 'carpet_pink' | 'carpet_purple' | 'stone' | 'wood_dark';
  color: string;
  exterior?: boolean;
  secret?: boolean;
}

export type DoorType = 'door' | 'sliding' | 'arch' | 'main' | 'secret';

export interface Door {
  name: string;
  x: number;
  y: number;
  dir: 'h' | 'v';
  length: number;
  type: DoorType;
}

export interface OpenPlanGap {
  description: string;
  x: number;
  y: number;
  dir: 'h' | 'v';
  length: number;
}

/**
 * Los interactables del floorplan son SYSTEM ANCHORS fijos: posiciones
 * y tipos predeterminados que hospedan minijuegos o sistemas persistentes.
 *
 *   - tv              → arcade / consola hub (juegos 1-2 jugadores)
 *   - pc              → shop + minijuegos PvP + sync events con Alex
 *   - fridge + stove  → cocina Overcooked (coop cuando Alex spawn)
 *   - telescope       → minijuego constelaciones + flightradar
 *   - bed             → eventos random nocturnos (save + dreams)
 *   - mirror          → change-look rápido (pre-armario)
 *   - wardrobe        → customización PJ por capas (Día 13-14)
 *   - bathtub         → modo relax (música + ambiente)
 *   - bookshelf       → colección + lectura (fragmentos narrativos)
 *   - plant           → ciclo de vida real (riego / morir por descuido)
 *   - front-door      → salida al rellano (Hub). En el GDD original era un
 *                       keypad interno; ahora el código se introduce en el
 *                       Hub, así que la puerta interna pasa a ser sólo el
 *                       "exit": pulsar E → fade y vuelta al HubScene.
 *   - safe            → mini-puzzle combinación (IRL gift gate)
 *   - escape-hatch    → acceso a habitación secreta (puzzle encadenado PC)
 *   - sink, wc, dining-table, coffee-table, sofa, washbasin, coat-rack
 *                     → diálogos ambientales + eventos puntuales
 *                       (sofá es "cinema mode" cuando Alex spawn)
 *
 * NO son muebles customizables. La customización de decoración (drag&drop
 * de sofás, cuadros, lámparas, cambio de paredes y suelos) va aparte en
 * Día 13-14 con tablas dedicadas en Supabase.
 */
export type InteractableType =
  | 'front-door'
  | 'pc'
  | 'bed'
  | 'tv'
  | 'sofa'
  | 'fridge'
  | 'stove'
  | 'mirror'
  | 'bathtub'
  | 'telescope'
  | 'wardrobe'
  | 'wc'
  | 'washbasin'
  | 'sink'
  | 'plant'
  | 'bookshelf'
  | 'coffee-table'
  | 'coat-rack'
  | 'dining-table'
  | 'safe'
  | 'escape-hatch'
  | 'microwave'
  | 'bathroom-cabinet'
  | 'candle'
  | 'cuckoo'
  | 'speakers'
  | 'secret-door'
  | 'piano'
  | 'fireplace'
  | 'wind-toy'
  // Virtual: no aparece en floorplan.json. Se añade en runtime por
  // LockedWallSystem (Día 7.5) — uno por habitación bloqueada. El handler
  // resuelve qué minijuego lanzar leyendo `interactable.id` ('wall-bano',
  // 'wall-cocina', etc.). Se elimina al desbloquear la habitación.
  | 'wall-locked'
  // Virtual: añadido en runtime por CatSystem (Día 8). Uno por gato
  // (cat-kero / cat-haku / cat-nala). Su posición se actualiza cada
  // frame desde CatSystem.update() para seguir al gato cuando se mueve.
  // Handler único 'cat' resuelve qué gato leyendo interactable.id.
  | 'cat';

export interface Interactable {
  id: string;
  x: number;
  y: number;
  type: InteractableType;
  room: string;
}

export interface Floorplan {
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
  spawn: { x: number; y: number; room: string };
  rooms: Room[];
  doors: Door[];
  openPlanGaps: OpenPlanGap[];
  interactables: Interactable[];
}

export const FLOORPLAN = floorplanJson as Floorplan;

export const TILE_SIZE = FLOORPLAN.tileSize;
export const MAP_WIDTH_TILES = FLOORPLAN.mapWidth;
export const MAP_HEIGHT_TILES = FLOORPLAN.mapHeight;
export const MAP_WIDTH_PX = MAP_WIDTH_TILES * TILE_SIZE;
export const MAP_HEIGHT_PX = MAP_HEIGHT_TILES * TILE_SIZE;

/**
 * Convención:
 * - El tamaño de cada habitación INCLUYE sus paredes (tile más externo).
 * - Dos habitaciones pegadas comparten una pared doble (2 tiles de grosor).
 *   Visualmente es una pared "gorda" típica de piso viejo. Funciona.
 * - Las puertas suprimen 2 tiles perpendiculares a su dirección, dejando
 *   pasar aunque la pared sea doble.
 */
export function isWallTile(tx: number, ty: number): boolean {
  for (const r of FLOORPLAN.rooms) {
    const onLeft = tx === r.x && ty >= r.y && ty < r.y + r.h;
    const onRight = tx === r.x + r.w - 1 && ty >= r.y && ty < r.y + r.h;
    const onTop = ty === r.y && tx >= r.x && tx < r.x + r.w;
    const onBottom = ty === r.y + r.h - 1 && tx >= r.x && tx < r.x + r.w;
    if (onLeft || onRight || onTop || onBottom) {
      if (isDoorTile(tx, ty) || isOpenPlanTile(tx, ty)) return false;
      return true;
    }
  }
  return false;
}

export function isDoorTile(tx: number, ty: number): boolean {
  for (const d of FLOORPLAN.doors) {
    if (d.dir === 'h') {
      // Puerta horizontal: suprime paredes en y=d.y y en y=d.y-1
      if (tx >= d.x && tx < d.x + d.length && (ty === d.y || ty === d.y - 1)) {
        return true;
      }
    } else {
      // Puerta vertical: suprime paredes en x=d.x y en x=d.x-1
      if (ty >= d.y && ty < d.y + d.length && (tx === d.x || tx === d.x - 1)) {
        return true;
      }
    }
  }
  return false;
}

export function isOpenPlanTile(tx: number, ty: number): boolean {
  for (const g of FLOORPLAN.openPlanGaps) {
    if (g.dir === 'h') {
      if (tx >= g.x && tx < g.x + g.length && (ty === g.y || ty === g.y - 1)) {
        return true;
      }
    } else {
      if (ty >= g.y && ty < g.y + g.length && (tx === g.x || tx === g.x - 1)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Qué habitación contiene este tile. Iteramos en orden inverso para que
 * las habitaciones "hijas" (secreta dentro de alex) ganen a sus padres.
 */
export function roomAt(tx: number, ty: number): Room | null {
  for (let i = FLOORPLAN.rooms.length - 1; i >= 0; i--) {
    const r = FLOORPLAN.rooms[i];
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) {
      return r;
    }
  }
  return null;
}
