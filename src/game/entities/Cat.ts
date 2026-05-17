import * as Phaser from 'phaser';
import { TILE_SIZE } from '../data/floorplan';
import { getCatScale } from '../data/catsManifest';

/**
 * Cat — entidad gato (Día 8c rework).
 *
 * Cambios respecto a versión anterior:
 *   - Sprite con animaciones por estado (idle/walk/sprint/eat/drink/
 *     sleep/purr/playful/stretch/meow/groom).
 *   - Sin direcciones 4-way: una sola dirección lateral con flip X.
 *   - FSM de estados gobernado por CatSystem (vida propia, no tamagochi).
 *   - Lock al interactuar: setFrozen(true) detiene wander + animación
 *     hasta que el menú se cierre.
 */

export type CatId = 'kero' | 'haku' | 'nala';

/**
 * Estados/animaciones del gato. Cada uno tiene anim asociada
 * (`<catId>-<state>`) si está registrada en CatAnimations.
 *
 * Mapeo state → anim PNG:
 *   - `purr` → `<catId>-sit-idle.png` (sentado, ronroneando)
 *   - `attack-l/r` → `<catId>-attack-left/right.png` (one-shot)
 *   - `hurt-l/r` → `<catId>-hurt-left/right.png` (one-shot)
 *   - resto: 1:1 con nombre PNG.
 *
 * `eat` no se elige autónomamente por la FSM (Día 9-pre): es acción
 * "Alimentar" del menú. El gato camina a cocina, ejecuta state 'eat'
 * en bucle, vuelve a FSM.
 */
export type CatState =
  | 'idle'
  | 'walk'
  | 'sprint'
  | 'playful'
  | 'eat'
  | 'purr' // anim PNG sit-idle
  | 'sleep'
  | 'attack-l'
  | 'attack-r'
  | 'hurt-l'
  | 'hurt-r';

/** Mapea state lógico → suffix de la anim/texture key. */
const STATE_TO_ANIM_SUFFIX: Record<CatState, string> = {
  idle: 'idle',
  walk: 'walk',
  sprint: 'sprint',
  playful: 'playful',
  eat: 'eat',
  purr: 'sit-idle',
  sleep: 'sleep',
  'attack-l': 'attack-left',
  'attack-r': 'attack-right',
  'hurt-l': 'hurt-left',
  'hurt-r': 'hurt-right',
};

export interface CatConfig {
  id: CatId;
  /** Color principal del cuerpo (palette del gato — placeholder fallback). */
  bodyColor: number;
  /** Color de las patas/cola (placeholder fallback). */
  shadeColor: number;
  /** Color de los ojos (placeholder fallback). */
  eyeColor: number;
  /** Tile inicial al spawnear. */
  spawnTile: { x: number; y: number };
  /** Etiqueta humana ("Kero", "Haku", "Nala"). */
  label: string;
  /**
   * Prefijo de las texture keys (`<spriteKey>-<animName>`). Si las
   * textures no existen para alguna anim, fallback a procedural sin
   * error. Día 8c: sólo 'kero' tiene PNGs por ahora.
   */
  spriteKey?: string;
}

const BODY_W = 8;
const BODY_H = 6;
const TOTAL_H = 8;

export class Cat {
  scene: Phaser.Scene;
  config: CatConfig;
  container: Phaser.GameObjects.Container;
  private sprite?: Phaser.GameObjects.Sprite;
  private gfx?: Phaser.GameObjects.Graphics;
  private nameTag: Phaser.GameObjects.Text;
  private tagBg: Phaser.GameObjects.Rectangle;
  /** Tile destino actual del wander (si state='walk' o 'sprint'). */
  targetTile: { x: number; y: number };
  /** Última vez que CatSystem cambió de estado. */
  lastStateChangeAtMs = 0;
  /** Última vez que se asignó target de wander (sólo cuando walking). */
  lastWanderAtMs = 0;
  facing: 'left' | 'right' = 'right';
  /** Estado actual (FSM gobernado por CatSystem). */
  state: CatState = 'idle';
  /** Velocidad efectiva en px/frame, fijada por CatSystem según state. */
  speedPxPerFrame = 0;
  /** Si true, no se mueve ni cambia state (modo menú abierto). */
  private frozen = false;
  /** Última anim play()'ed para no spamear. */
  private lastAnimKey: string | null = null;

  constructor(scene: Phaser.Scene, config: CatConfig) {
    this.scene = scene;
    this.config = config;
    this.targetTile = { ...config.spawnTile };

    const px = config.spawnTile.x * TILE_SIZE + TILE_SIZE / 2;
    const py = config.spawnTile.y * TILE_SIZE + TILE_SIZE / 2;
    this.container = scene.add.container(px, py);

    // Si tiene spriteKey y la texture existe, usamos sprite + scale
    // dinámico (TARGET_VISUAL_PX / frameSize del manifest). Si la anim
    // idle existe, hacemos play; si no, queda con frame 0 estático.
    const idleTexture = config.spriteKey ? `${config.spriteKey}-idle` : null;
    if (idleTexture && scene.textures.exists(idleTexture)) {
      this.sprite = scene.add.sprite(0, 0, idleTexture, 0).setOrigin(0.5, 0.7);
      // Scale fijo del gato (mismo para todas sus anims, manifest).
      this.sprite.setScale(getCatScale(config.id));
      this.container.add(this.sprite);
      const idleAnim = `${config.spriteKey}-idle`;
      if (scene.anims.exists(idleAnim)) {
        try {
          this.sprite.play(idleAnim);
          this.lastAnimKey = idleAnim;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`[Cat] Play idle anim falló para ${config.id}:`, err);
        }
      }
    } else {
      this.gfx = scene.add.graphics();
      this.container.add(this.gfx);
    }

    this.nameTag = scene.add
      .text(0, -TOTAL_H - 4, config.label, {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1);
    const tagBg = scene.add
      .rectangle(0, -TOTAL_H - 4 - 4, this.nameTag.width + 4, 9, 0x1a0e08, 0.7)
      .setOrigin(0.5, 0.5);
    this.container.add([tagBg, this.nameTag]);
    tagBg.setVisible(false);
    this.nameTag.setVisible(false);
    this.tagBg = tagBg;

    this.container.setDepth(20);
    this.redrawProcedural();
  }

  /** Cambia el state — toca animación correspondiente. Idempotente. */
  setState(newState: CatState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.lastStateChangeAtMs = this.scene.time.now;
    this.applyAnim();
  }

  private applyAnim(): void {
    if (!this.sprite || !this.config.spriteKey) {
      this.redrawProcedural();
      return;
    }
    const suffix = STATE_TO_ANIM_SUFFIX[this.state];
    const animKey = `${this.config.spriteKey}-${suffix}`;
    if (this.lastAnimKey === animKey) return;
    try {
      if (this.scene.anims.exists(animKey)) {
        this.lastAnimKey = animKey;
        // Scale dinámico (anim distinta puede tener frame size distinto).
        this.sprite.setScale(getCatScale(this.config.id));
        this.sprite.play(animKey);
      } else {
        // Fallback: idle si la anim de este state no existe.
        const idle = `${this.config.spriteKey}-idle`;
        if (this.scene.anims.exists(idle) && this.lastAnimKey !== idle) {
          this.lastAnimKey = idle;
          this.sprite.setScale(getAnimScale(this.config.id, 'idle'));
          this.sprite.play(idle);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[Cat] applyAnim falló (${animKey}):`, err);
    }
  }

  /**
   * Reproduce una anim "one-shot" (no loop) y vuelve a idle al terminar.
   * Útil para attack/hurt. Si el state ya estaba en otro one-shot, lo
   * sobreescribe.
   */
  playOneShot(state: 'attack-l' | 'attack-r' | 'hurt-l' | 'hurt-r', onDone?: () => void): void {
    this.state = state;
    if (!this.sprite || !this.config.spriteKey) {
      onDone?.();
      return;
    }
    const suffix = STATE_TO_ANIM_SUFFIX[state];
    const animKey = `${this.config.spriteKey}-${suffix}`;
    if (!this.scene.anims.exists(animKey)) {
      onDone?.();
      return;
    }
    this.lastAnimKey = animKey;
    try {
      this.sprite.setScale(getCatScale(this.config.id));
      this.sprite.play(animKey);
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        // Tras el one-shot, volvemos a idle.
        this.state = 'idle';
        this.applyAnim();
        onDone?.();
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[Cat] playOneShot falló (${animKey}):`, err);
      onDone?.();
    }
  }

  /**
   * Lock — para cuando se abre el menú del gato. Detiene movimiento.
   * Cuando se libera, CatSystem decidirá nuevo state via decideState().
   * NO seteamos state aquí — quien llama (CatSystem.handler) decide.
   */
  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Mueve el gato hacia targetTile. Sólo si el state lo justifica
   * (walk/sprint). En otros estados (eat/drink/sleep/idle) NO se mueve.
   */
  step(): void {
    if (this.frozen) return;
    if (this.state !== 'walk' && this.state !== 'sprint') return;

    const targetPxX = this.targetTile.x * TILE_SIZE + TILE_SIZE / 2;
    const targetPxY = this.targetTile.y * TILE_SIZE + TILE_SIZE / 2;
    const dx = targetPxX - this.container.x;
    const dy = targetPxY - this.container.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;

    const stepX = (dx / dist) * this.speedPxPerFrame;
    const stepY = (dy / dist) * this.speedPxPerFrame;
    this.container.x += stepX;
    this.container.y += stepY;

    // Facing por dx (la única dirección que afecta al sprite — flip X).
    if (Math.abs(dx) > 0.1) {
      const newFacing: 'left' | 'right' = dx > 0 ? 'right' : 'left';
      if (newFacing !== this.facing) {
        this.facing = newFacing;
        // Frames base del spritesheet miran a la IZQUIERDA. Cuando el
        // gato va hacia la derecha, flipX para voltearlo.
        if (this.sprite) this.sprite.setFlipX(this.facing === 'right');
        else this.redrawProcedural();
      }
    }
  }

  hasReachedTarget(): boolean {
    const t = this.tile;
    return t.x === this.targetTile.x && t.y === this.targetTile.y;
  }

  isNear(targetX: number, targetY: number, radiusPx: number): boolean {
    const dx = targetX - this.container.x;
    const dy = targetY - this.container.y;
    return dx * dx + dy * dy <= radiusPx * radiusPx;
  }

  setNameTagVisible(visible: boolean): void {
    this.nameTag.setVisible(visible);
    this.tagBg.setVisible(visible);
  }

  get px(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  get tile(): { x: number; y: number } {
    return {
      x: Math.floor(this.container.x / TILE_SIZE),
      y: Math.floor(this.container.y / TILE_SIZE),
    };
  }

  private redrawProcedural(): void {
    if (this.sprite) return; // tiene sprite, no usar procedural
    if (!this.gfx) return;
    const g = this.gfx;
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(0, BODY_H / 2 + 1, BODY_W + 2, 3);
    const flip = this.facing === 'left' ? -1 : 1;
    g.fillStyle(this.config.bodyColor, 1);
    g.fillRoundedRect(-BODY_W / 2, -BODY_H / 2, BODY_W, BODY_H, 1);
    const headX = flip * (BODY_W / 2 - 1);
    const headY = -BODY_H / 2 - 1;
    g.fillStyle(this.config.bodyColor, 1);
    g.fillRect(headX - 1.5, headY - 2, 3, 3);
    g.fillStyle(this.config.shadeColor, 1);
    g.fillRect(headX - 1.5, headY - 3, 1, 1);
    g.fillRect(headX + 0.5, headY - 3, 1, 1);
    g.fillStyle(this.config.eyeColor, 1);
    g.fillRect(headX - 1, headY - 1, 1, 1);
    g.fillRect(headX + 0, headY - 1, 1, 1);
    g.lineStyle(1, this.config.shadeColor, 1);
    const tailStartX = flip * -(BODY_W / 2);
    g.lineBetween(tailStartX, 0, tailStartX - flip * 3, -2);
    // Indicador de state (mini símbolo arriba — sólo procedural, debug).
    if (this.state === 'sleep') {
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(headX + 2, headY - 4, 1, 1);
      g.fillRect(headX + 3, headY - 5, 1, 1);
    }
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
