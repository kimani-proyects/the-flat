#!/usr/bin/env node
/**
 * inspect-tilesets.mjs
 *
 * Lee los PNGs de LimeZu en public/assets/tilesets/limezu/ y reporta
 * sus dimensiones reales en píxeles + cuántos tiles caben a 16×16.
 * Sin dependencias externas: parsea la cabecera IHDR del PNG a mano.
 *
 * Uso:
 *   node scripts/inspect-tilesets.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TILE = 16;

function pngSize(relPath) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) return null;
  const b = readFileSync(abs);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A (8 bytes)
  if (b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) {
    throw new Error(`No parece un PNG: ${relPath}`);
  }
  // IHDR chunk comienza en byte 8 con length(4) + "IHDR"(4) + width(4) + height(4)...
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  return { w, h };
}

const targets = [
  'public/assets/tilesets/limezu/Room_Builder_16x16.png',
  'public/assets/tilesets/limezu/Interiors_16x16.png',
  // Subfiles (opcionales, por si queremos cargarlos separados más adelante)
  'public/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png',
  'public/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Walls_16x16.png',
  'public/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Arched_Entryways_16x16.png',
];

// eslint-disable-next-line no-console
console.log('LimeZu tileset inspector — dimensiones a 16×16\n');

let cumulativeFirstgid = 1;
for (const path of targets) {
  const size = pngSize(path);
  if (!size) {
    // eslint-disable-next-line no-console
    console.log(`  ✗ ${path} — no existe`);
    continue;
  }
  const cols = size.w / TILE;
  const rows = size.h / TILE;
  const count = cols * rows;
  const firstgidSuggestion = cumulativeFirstgid;
  // eslint-disable-next-line no-console
  console.log(`  ✓ ${path}`);
  // eslint-disable-next-line no-console
  console.log(
    `     ${size.w}×${size.h} px  ·  grid ${cols}×${rows}  ·  ${count} tiles  ·  firstgid sugerido: ${firstgidSuggestion}`,
  );
  cumulativeFirstgid += count;
}

// eslint-disable-next-line no-console
console.log(
  '\nSi los dos primeros aparecen con ✓, gen-tilemap.mjs los usará automáticamente.',
);
