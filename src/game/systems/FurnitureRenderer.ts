import * as Phaser from 'phaser';
import { FLOORPLAN, TILE_SIZE } from '../data/floorplan';
import type { Interactable } from '../data/floorplan';
import { onTvStateChange, isTvOn } from '../interactions/furnitureHandlers';

/**
 * FurnitureRenderer — sprites animados LimeZu (S2.2 rework).
 *
 * Cambio clave vs S2: en lugar de declarar `frameW` y `frameH` por spec
 * (que generaba cropping cuando me equivocaba), ahora declaro
 * **`frameCount`** — el número de frames horizontales en el strip.
 *
 *   frameW = imageWidth / frameCount
 *   frameH = imageHeight  (el alto del PNG ENTERO es el alto del sprite)
 *
 * Esto resuelve el problema "el mueble está cortado por abajo": antes
 * suponía altos de 16/32 y dejaba fuera la parte inferior. Ahora cojo
 * SIEMPRE la altura completa del PNG.
 *
 * Si frameCount=1, el sprite es estático (sin anim, una sola imagen).
 */

interface FurnitureSpec {
  matchId?: string;
  matchType?: string;
  textureKey: string;
  /** Nº de frames horizontales en el strip. 1 = estático. */
  frameCount: number;
  animKey: string;
  frameRate: number;
  /** Frame inicial del LOOP (subset). Default 0. */
  loopStart?: number;
  /** Frame final del LOOP (subset). Default frameCount-1. */
  loopEnd?: number;
  loopWhenOn?: boolean;
  anchor: 'feet' | 'center' | 'wall';
  hitTilesX: number;
  hitTilesY: number;
  idleFrame?: number;
  oneShotRepeats?: number;
}

// S2.3: frameCounts derivados de los logs reales del console:
//   tv-anim:        PNG 1152×32 → 36 frames de 32×32   (TV 2×2 tiles)
//   fridge-anim:    PNG  224×48 → 14 frames de 16×48   (fridge 1×3 tiles)
//   oven-anim:      PNG   64×16 →  2 frames de 32×16   (cooktop 2×1)
//   kitchen-sink:   PNG   96×16 →  3 frames de 32×16   (sink 2×1)
//   mirror-anim:    PNG  128×32 →  8 frames de 16×32   (espejo 1×2)
//   bathtub-anim:   PNG  128×64 →  4 frames de 32×64   (bath 2×4)
//   bath-sink:      PNG  448×32 → 28 frames de 16×32   (sink 1×2 + many states)
//   bath-cabinet:   PNG  160×32 →  5 frames de 32×32   (cabinet 2×2)
//   candle-anim:    PNG   48×32 →  3 frames de 16×32   (candle 1×2)
//   cuckoo-anim:    PNG  160×32 → 10 frames de 16×32   (clock 1×2)
//   amplifier-anim: PNG   48×32 →  3 frames de 16×32   (amp 1×2)
const FURNITURE_SPECS: FurnitureSpec[] = [
  // ── Salón ─────────────────────────────────────────────────────────
  // S2.11: TV procedural FUERA — el LimeZuRenderer pinta la TV con sprites
  // Basement_194 + 195. Comentamos el spec entero para que no se pinte
  // duplicada. La animación de la pantalla sigue saliendo en el bocadillo
  // dinámico vía tvHandler (no cambia).
  // {
  //   matchType: 'tv',
  //   textureKey: 'tv-16',
  //   ...
  // },
  // ── Cocina ────────────────────────────────────────────────────────
  {
    matchType: 'fridge',
    textureKey: 'fridge-16',
    frameCount: 14,
    // Anim usa el strip completo — playOneShot recorre las 14 frames
    // (cerrada → abriendo → abierta) en una sola pasada al interactuar.
    // En estado idle se queda en frame 0 (cerrada) gracias a setFrame
    // tras ANIMATION_COMPLETE.
    animKey: 'fridge-anim',
    frameRate: 10,
    anchor: 'feet',
    hitTilesX: 1,
    hitTilesY: 1,
    oneShotRepeats: 1,
  },
  {
    matchType: 'stove',
    textureKey: 'oven-16',
    frameCount: 2,
    animKey: 'oven-anim',
    frameRate: 4,
    anchor: 'feet',
    hitTilesX: 2,
    hitTilesY: 1,
    oneShotRepeats: 2,
  },
  {
    matchType: 'sink',
    textureKey: 'kitchen-sink-16',
    frameCount: 3,
    animKey: 'kitchen-sink-anim',
    frameRate: 4,
    anchor: 'feet',
    hitTilesX: 2,
    hitTilesY: 1,
    oneShotRepeats: 2,
  },
  // ── Baño ──────────────────────────────────────────────────────────
  {
    matchType: 'mirror',
    textureKey: 'mirror-approach-16',
    frameCount: 8,
    animKey: 'mirror-anim',
    frameRate: 4,
    anchor: 'wall',
    hitTilesX: 0,
    hitTilesY: 0,
    idleFrame: 0,
    oneShotRepeats: 1,
  },
  {
    matchType: 'bathtub',
    textureKey: 'bathtub-16',
    frameCount: 4,
    animKey: 'bathtub-anim',
    frameRate: 3,
    anchor: 'feet',
    // Bathtub 2×4 sprite. Footprint físico 2×1 (sólo bottom tile).
    hitTilesX: 2,
    hitTilesY: 1,
    oneShotRepeats: 2,
  },
  // S2.12: washbasin procedural FUERA — el LimeZuRenderer pinta el
  // lavabo del baño con Bathroom_5. Bloque eliminado para no duplicar.
  {
    matchType: 'bathroom-cabinet',
    textureKey: 'bathroom-cabinet-16',
    frameCount: 5,
    animKey: 'bath-cabinet-anim',
    frameRate: 4,
    anchor: 'wall',
    hitTilesX: 0,
    hitTilesY: 0,
    idleFrame: 0,
    oneShotRepeats: 1,
  },
  // ── Decoración ────────────────────────────────────────────────────
  {
    matchType: 'candle',
    textureKey: 'candle-16',
    frameCount: 3,
    animKey: 'candle-anim',
    frameRate: 5,
    loopWhenOn: true,
    anchor: 'feet',
    hitTilesX: 0,
    hitTilesY: 0,
  },
  {
    matchType: 'cuckoo',
    textureKey: 'cuckoo-16',
    frameCount: 10,
    animKey: 'cuckoo-anim',
    frameRate: 4,
    anchor: 'wall',
    hitTilesX: 0,
    hitTilesY: 0,
    idleFrame: 0,
    oneShotRepeats: 1,
  },
  {
    matchType: 'speakers',
    textureKey: 'amplifier-16',
    frameCount: 3,
    animKey: 'amplifier-anim',
    frameRate: 5,
    loopWhenOn: true,
    anchor: 'feet',
    hitTilesX: 1,
    hitTilesY: 1,
    idleFrame: 0,
  },
];

interface FurnitureGO {
  spec: FurnitureSpec;
  interactable: Interactable;
  sprite: Phaser.GameObjects.Sprite;
}

let ACTIVE_RENDERER: FurnitureRenderer | null = null;
export function getFurnitureRenderer(): FurnitureRenderer | null {
  return ACTIVE_RENDERER;
}

export class FurnitureRenderer {
  private scene: Phaser.Scene;
  private items: FurnitureGO[] = [];
  private staticGroup: Phaser.Physics.Arcade.StaticGroup | null = null;
  private tvUnsubscribe: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  init(player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle): void {
    ACTIVE_RENDERER = this;
    this.registerAllAnims();
    this.staticGroup = this.scene.physics.add.staticGroup();

    for (const it of FLOORPLAN.interactables) {
      const spec = FURNITURE_SPECS.find(
        (s) => (s.matchId && s.matchId === it.id) || (s.matchType && s.matchType === it.type),
      );
      if (!spec) continue;
      if (!this.scene.textures.exists(spec.textureKey)) {
        // eslint-disable-next-line no-console
        console.warn(`[FurnitureRenderer] textura "${spec.textureKey}" no cargada — skip ${it.id}`);
        continue;
      }

      const tileTL_x = it.x * TILE_SIZE;
      const tileTL_y = it.y * TILE_SIZE;

      let px = tileTL_x;
      let py = tileTL_y;
      switch (spec.anchor) {
        case 'feet':
          // Anchor en pies del mueble (origin 0.5,1). El mueble se "apoya"
          // en el TILE inferior del hitbox. El sprite extiende hacia arriba
          // tantos píxeles como tenga frameH (auto-detected).
          // Centro horizontal del hitbox.
          px =
            tileTL_x +
            (Math.max(spec.hitTilesX, 1) * TILE_SIZE) / 2;
          py = tileTL_y + Math.max(spec.hitTilesY, 1) * TILE_SIZE;
          break;
        case 'center':
          px = tileTL_x + TILE_SIZE / 2;
          py = tileTL_y + TILE_SIZE / 2;
          break;
        case 'wall':
          // Cuelga de la pared norte: bottom del sprite alineado con la
          // top del tile (sprite va hacia arriba dentro del muro/encima).
          px = tileTL_x + TILE_SIZE / 2;
          py = tileTL_y;
          break;
      }

      const sprite = this.scene.add.sprite(px, py, spec.textureKey, spec.idleFrame ?? 0);
      if (spec.anchor === 'center') {
        sprite.setOrigin(0.5, 0.5);
      } else {
        // feet + wall: origin (0.5, 1) — el sprite "cae" desde su base.
        sprite.setOrigin(0.5, 1);
      }
      sprite.setDepth(10);

      // Estado inicial.
      if (spec.matchType === 'tv') {
        sprite.setFrame(0);
        sprite.setTint(0x404040);
      } else if (spec.loopWhenOn) {
        // Velas, altavoces — empiezan animados.
        try {
          sprite.play({ key: spec.animKey, repeat: -1 });
        } catch {
          /* noop */
        }
      }

      // Hitbox (sólo si tiene footprint sólido).
      if (spec.hitTilesX > 0 && spec.hitTilesY > 0) {
        const hbW = spec.hitTilesX * TILE_SIZE;
        const hbH = spec.hitTilesY * TILE_SIZE;
        const hbX = tileTL_x + hbW / 2;
        const hbY = tileTL_y + hbH / 2;
        const collider = this.scene.add.rectangle(hbX, hbY, hbW, hbH);
        this.scene.physics.add.existing(collider, true);
        this.staticGroup.add(collider);
      }

      this.items.push({ spec, interactable: it, sprite });
    }

    if (this.staticGroup && player) {
      this.scene.physics.add.collider(player, this.staticGroup);
    }

    this.tvUnsubscribe = onTvStateChange((on) => this.handleTvStateChange(on));
    this.handleTvStateChange(isTvOn());
  }

  private registerAllAnims(): void {
    for (const spec of FURNITURE_SPECS) {
      if (!this.scene.textures.exists(spec.textureKey)) continue;
      if (this.scene.anims.exists(spec.animKey)) continue;

      const tex = this.scene.textures.get(spec.textureKey);
      const src = tex.getSourceImage() as { width: number; height: number };
      const w = src.width;
      const h = src.height;
      if (!w || !h) continue;

      // S2.2: autodetect frameW desde imageWidth / frameCount.
      // frameH = imageHeight (alto completo del sprite).
      const frameW = Math.floor(w / Math.max(1, spec.frameCount));
      const frameH = h;

      if (!tex.has('0')) {
        for (let i = 0; i < spec.frameCount; i++) {
          tex.add(String(i), 0, i * frameW, 0, frameW, frameH);
        }
      }

      // S2.3: usamos loopStart/loopEnd como subset del strip si están
      // definidos. Esto permite tener strips largos (TV con 36 frames)
      // y loopear sólo un trozo en lugar del strip entero.
      const animStart = Math.max(0, spec.loopStart ?? 0);
      const animEnd = Math.min(spec.frameCount - 1, spec.loopEnd ?? spec.frameCount - 1);

      // eslint-disable-next-line no-console
      console.log(
        `[FurnitureRenderer] ${spec.animKey}: PNG ${w}×${h} → ${spec.frameCount} frames ${frameW}×${frameH} (loop ${animStart}-${animEnd})`,
      );

      this.scene.anims.create({
        key: spec.animKey,
        frames: this.scene.anims.generateFrameNumbers(spec.textureKey, {
          start: animStart,
          end: animEnd,
        }),
        frameRate: spec.frameRate,
        repeat: 0,
      });
    }
  }

  playOneShot(matcher: string, overrideRepeats?: number): void {
    for (const item of this.items) {
      if (
        item.spec.matchId !== matcher &&
        item.spec.matchType !== matcher &&
        item.interactable.id !== matcher
      )
        continue;
      if (!item.sprite.scene || !item.sprite.active) continue;
      if (item.spec.loopWhenOn) continue;
      try {
        const repeats = overrideRepeats ?? (item.spec.oneShotRepeats ?? 1) - 1;
        item.sprite.play({ key: item.spec.animKey, repeat: repeats });
        item.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (item.sprite.scene && item.sprite.active) {
            item.sprite.setFrame(item.spec.idleFrame ?? 0);
          }
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[FurnitureRenderer] playOneShot failed', matcher, err);
      }
    }
  }

  private handleTvStateChange(on: boolean): void {
    for (const item of this.items) {
      if (item.spec.matchType !== 'tv') continue;
      if (!item.sprite || !item.sprite.scene || !item.sprite.active) continue;
      try {
        item.sprite.stop(); // siempre paramos cualquier loop previo
        if (on) {
          // S2.4: frame fijo "encendida" sin loop. Frame 3 (un canal
          // genérico del strip de 36) — si visualmente otro queda
          // mejor, ajustamos.
          item.sprite.setFrame(3);
          item.sprite.clearTint();
        } else {
          item.sprite.setFrame(0);
          item.sprite.setTint(0x404040);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[FurnitureRenderer] tv state failed', err);
      }
    }
  }

  destroy(): void {
    if (ACTIVE_RENDERER === this) ACTIVE_RENDERER = null;
    this.tvUnsubscribe?.();
    this.tvUnsubscribe = null;
    for (const item of this.items) {
      if (item.sprite && item.sprite.scene) item.sprite.destroy();
    }
    this.items = [];
    if (this.staticGroup) {
      this.staticGroup.destroy(true);
      this.staticGroup = null;
    }
  }
}
