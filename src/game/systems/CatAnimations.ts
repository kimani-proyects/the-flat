import * as Phaser from 'phaser';
import type { CatId } from '../entities/Cat';
import {
  CATS_MANIFEST,
  CANONICAL_ANIMS,
  DEFAULT_ANIM_PROPS,
  getAnimFrameSize,
  type CatAnimName,
} from '../data/catsManifest';

/**
 * CatAnimations — registra animaciones de gatos (Día 9-pre v3).
 *
 * Pipeline:
 *   1. BootScene cargó cada PNG como `load.image` (sin frame size fijo).
 *   2. Aquí leemos dimensiones reales (`tex.source[0].width/height`).
 *   3. Calculamos frameSize efectivo (`getAnimFrameSize(catId, animName)`
 *      del manifest, con override por anim si aplica).
 *   4. Calculamos `cols / rows` del grid asumiendo cuadrado: cols =
 *      floor(width/frameSize), rows = floor(height/frameSize).
 *   5. Total frames = cols * rows.
 *   6. Generamos los frames manualmente con `tex.add('0', 0, x, y, w, h)`
 *      — Phaser numera 0..N-1 left-to-right, fila por fila.
 *   7. Creamos la anim con generateFrameNumbers + startFrame/endFrame
 *      del manifest.
 *
 * Skip silencioso si:
 *   - Texture no existe (PNG no cargado).
 *   - Anim ya existe (idempotencia).
 *   - frameSize > width o > height (frame size mal manifest).
 */

const CAT_IDS: CatId[] = ['kero', 'haku', 'nala'];

export const CatAnimations = {
  register(scene: Phaser.Scene): void {
    for (const id of CAT_IDS) {
      for (const anim of CANONICAL_ANIMS) {
        registerOne(scene, id, anim);
      }
    }
  },
};

function registerOne(scene: Phaser.Scene, catId: CatId, animName: CatAnimName): void {
  const key = `${catId}-${animName}`;
  if (!scene.textures.exists(key)) return;
  if (scene.anims.exists(key)) return;

  const tex = scene.textures.get(key);
  const src = tex.getSourceImage() as { width: number; height: number };
  const w = src.width;
  const h = src.height;
  if (!w || !h) return;

  const frameSize = getAnimFrameSize(catId, animName);
  if (frameSize > w || frameSize > h) {
    // eslint-disable-next-line no-console
    console.warn(
      `[CatAnimations] ${key}: frameSize ${frameSize} > tamaño imagen ${w}×${h}, skip.`,
    );
    return;
  }

  const cols = Math.floor(w / frameSize);
  const rows = Math.floor(h / frameSize);
  const totalFrames = Math.max(1, cols * rows);

  // Generamos frames manualmente. Idempotente — chequeamos "0".
  if (!tex.has('0')) {
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tex.add(String(idx), 0, c * frameSize, r * frameSize, frameSize, frameSize);
        idx++;
      }
    }
  }

  const override = CATS_MANIFEST[catId].anims?.[animName] ?? {};
  const start = override.startFrame ?? 0;
  const end = Math.min(override.endFrame ?? totalFrames - 1, totalFrames - 1);
  const defaults = DEFAULT_ANIM_PROPS[animName];
  const frameRate = override.frameRate ?? defaults.frameRate;
  const repeat = override.repeat ?? defaults.repeat;

  // eslint-disable-next-line no-console
  console.log(
    `[CatAnimations] ${key}: ${w}×${h} grid ${cols}×${rows} frame ${frameSize}, anim ${start}..${end} (${end - start + 1} frames) fps ${frameRate} repeat ${repeat}`,
  );

  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(key, { start, end }),
    frameRate,
    repeat,
  });
}
