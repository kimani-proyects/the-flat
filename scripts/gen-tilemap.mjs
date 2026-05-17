#!/usr/bin/env node
/**
 * gen-tilemap.mjs (v3)
 *
 * Lee src/game/data/floorplan.json + scripts/tile-ids.json y genera
 * public/assets/maps/apartment.tmj en formato Tiled 1.10 JSON.
 *
 * Cambios v3:
 *   - Registra CUATRO tilesets (antes dos):
 *       1) Room_Builder_16x16 (maestro, firstgid=1)
 *       2) Room_Builder_Floors_16x16 (subfile, para identificar suelos a ojo)
 *       3) Room_Builder_Walls_16x16 (subfile, para paredes)
 *       4) Interiors_16x16 (maestro, para muebles)
 *     Esto es pragmático para el "first paint": los subfiles son tan pequeños
 *     (15×40 y 32×40) que puedes ver un tile y calcular su global id sin abrir
 *     Tiled. El maestro sigue ahí para puertas, arcos y cualquier cosa que
 *     no esté en los subfiles.
 *   - firstgid se calcula dinámicamente a partir del tamaño real de cada PNG.
 *   - tile-ids.json ahora usa IDs GLOBALES (ya con firstgid sumado), así que
 *     al regenerar el .tmj los números que metas ahí son los que hace suyos
 *     Tiled sin conversión extra.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------- Helpers: leer tamaño de PNG desde cabecera IHDR ----------

function pngSize(relPath) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) return null;
  const b = readFileSync(abs);
  if (b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) {
    return null;
  }
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// ---------- Cargar datos ----------

const fp = JSON.parse(
  readFileSync(resolve(ROOT, 'src/game/data/floorplan.json'), 'utf8'),
);
const tileIds = JSON.parse(
  readFileSync(resolve(ROOT, 'scripts/tile-ids.json'), 'utf8'),
);

const TILE = fp.tileSize;
const W = fp.mapWidth;
const H = fp.mapHeight;

// ---------- Descripción de tilesets ----------

// El orden de este array decide el orden de firstgids. Una vez un tileset
// tiene tiles usados en producción, NO se reordena (rompería todos los IDs).
const TILESETS_DEF = [
  {
    name: 'Room_Builder_16x16',
    rel: 'public/assets/tilesets/limezu/Room_Builder_16x16.png',
    mapsRelFromTmj: '../tilesets/limezu/Room_Builder_16x16.png',
    fallback: { w: 1216, h: 1808 },
  },
  {
    name: 'Room_Builder_Floors_16x16',
    rel: 'public/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png',
    mapsRelFromTmj:
      '../tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png',
    fallback: { w: 240, h: 640 },
  },
  {
    name: 'Room_Builder_Walls_16x16',
    rel: 'public/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Walls_16x16.png',
    mapsRelFromTmj:
      '../tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Walls_16x16.png',
    fallback: { w: 512, h: 640 },
  },
  {
    name: 'Interiors_16x16',
    rel: 'public/assets/tilesets/limezu/Interiors_16x16.png',
    mapsRelFromTmj: '../tilesets/limezu/Interiors_16x16.png',
    fallback: { w: 256, h: 17024 },
  },
];

// Resolver dimensiones reales y firstgids.
let nextFirstGid = 1;
const tilesets = [];
for (const ts of TILESETS_DEF) {
  const sz = pngSize(ts.rel) ?? ts.fallback;
  const cols = sz.w / TILE;
  const rows = sz.h / TILE;
  const tilecount = cols * rows;
  const firstgid = nextFirstGid;
  nextFirstGid += tilecount;
  tilesets.push({
    firstgid,
    name: ts.name,
    image: ts.mapsRelFromTmj,
    imagewidth: sz.w,
    imageheight: sz.h,
    tilewidth: TILE,
    tileheight: TILE,
    tilecount,
    columns: Math.floor(cols),
    margin: 0,
    spacing: 0,
    _found: !!pngSize(ts.rel),
  });
}

// ---------- Resolver IDs ----------

const FLOOR_BY_TYPE = {
  wood: tileIds.floors.wood,
  wood_dark: tileIds.floors.wood_dark,
  tile: tileIds.floors.tile,
  carpet_pink: tileIds.floors.carpet_pink,
  carpet_purple: tileIds.floors.carpet_purple,
  stone: tileIds.floors.stone,
};

const DOOR_BY_TYPE = {
  door: tileIds.doors.door,
  sliding: tileIds.doors.sliding,
  arch: tileIds.doors.arch,
  main: tileIds.doors.main,
  secret: tileIds.doors.secret,
};

const WALL = tileIds.walls.basic;

// ---------- Lógica de paredes ----------

function isDoorTile(tx, ty) {
  for (const d of fp.doors) {
    if (d.dir === 'h') {
      if (tx >= d.x && tx < d.x + d.length && (ty === d.y || ty === d.y - 1)) return d;
    } else {
      if (ty >= d.y && ty < d.y + d.length && (tx === d.x || tx === d.x - 1)) return d;
    }
  }
  return null;
}

function isOpenPlanTile(tx, ty) {
  for (const g of fp.openPlanGaps) {
    if (g.dir === 'h') {
      if (tx >= g.x && tx < g.x + g.length && (ty === g.y || ty === g.y - 1)) return true;
    } else {
      if (ty >= g.y && ty < g.y + g.length && (tx === g.x || tx === g.x - 1)) return true;
    }
  }
  return false;
}

function roomAt(tx, ty) {
  for (let i = fp.rooms.length - 1; i >= 0; i--) {
    const r = fp.rooms[i];
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r;
  }
  return null;
}

function isWallTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
  for (const r of fp.rooms) {
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

// ---------- Construir capas ----------

const emptyLayer = () => new Array(W * H).fill(0);

const floorLayer = emptyLayer();
const wallLayer = emptyLayer();
const doorLayer = emptyLayer();
const collisionLayer = emptyLayer();

for (let ty = 0; ty < H; ty++) {
  for (let tx = 0; tx < W; tx++) {
    const idx = ty * W + tx;

    const r = roomAt(tx, ty);
    if (r) {
      floorLayer[idx] = FLOOR_BY_TYPE[r.floorType] ?? FLOOR_BY_TYPE.wood;
    }

    if (isWallTile(tx, ty)) {
      wallLayer[idx] = WALL;
      collisionLayer[idx] = WALL;
    }

    const d = isDoorTile(tx, ty);
    if (d) {
      doorLayer[idx] = DOOR_BY_TYPE[d.type] ?? DOOR_BY_TYPE.door;
    }
  }
}

// ---------- Objetos ----------

const objectsGroup = {
  draworder: 'topdown',
  id: 100,
  name: 'Objects',
  objects: [
    {
      id: 1,
      name: 'spawn-maria',
      type: 'spawn',
      x: fp.spawn.x * TILE,
      y: fp.spawn.y * TILE,
      width: TILE,
      height: TILE,
      visible: true,
      rotation: 0,
    },
    ...fp.interactables.map((it, i) => ({
      id: 2 + i,
      name: it.id,
      type: it.type,
      x: it.x * TILE,
      y: it.y * TILE,
      width: TILE,
      height: TILE,
      visible: true,
      rotation: 0,
      properties: [{ name: 'room', type: 'string', value: it.room }],
    })),
  ],
  opacity: 1,
  type: 'objectgroup',
  visible: true,
  x: 0,
  y: 0,
};

// ---------- Documento Tiled ----------

const layer = (id, name, data, opacity = 1, extra = {}) => ({
  data,
  height: H,
  id,
  name,
  opacity,
  type: 'tilelayer',
  visible: true,
  width: W,
  x: 0,
  y: 0,
  ...extra,
});

const tiledDoc = {
  compressionlevel: -1,
  height: H,
  infinite: false,
  layers: [
    layer(1, 'Floor', floorLayer),
    layer(2, 'Detail', emptyLayer()),
    layer(3, 'Walls', wallLayer),
    layer(4, 'Furniture_Back', emptyLayer()),
    layer(5, 'Furniture_Front', emptyLayer()),
    layer(6, 'Doors', doorLayer),
    layer(7, 'Collisions', collisionLayer, 0.3, {
      properties: [{ name: 'collides', type: 'bool', value: true }],
    }),
    objectsGroup,
  ],
  nextlayerid: 101,
  nextobjectid: 500,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.10.2',
  tileheight: TILE,
  tilesets: tilesets.map(({ _found, ...rest }) => rest),
  tilewidth: TILE,
  type: 'map',
  version: '1.10',
  width: W,
};

// ---------- Escribir ----------

const outPath = resolve(ROOT, 'public/assets/maps/apartment.tmj');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(tiledDoc, null, 2) + '\n', 'utf8');

// eslint-disable-next-line no-console
console.log(`\u2713 Generado ${outPath}`);
// eslint-disable-next-line no-console
console.log(`  mapa: ${W}\u00d7${H} tiles \u00b7 ${fp.rooms.length} rooms \u00b7 ${fp.doors.length} doors`);
for (const ts of tilesets) {
  // eslint-disable-next-line no-console
  console.log(
    `  [${ts.firstgid.toString().padStart(6)}] ${ts.name} ${ts.imagewidth}\u00d7${ts.imageheight} (${ts.tilecount} tiles)` +
      (ts._found ? '' : '  [!] PNG no encontrado, usando fallback'),
  );
}
