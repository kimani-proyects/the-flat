import * as Phaser from 'phaser';
import type { MinigameContext, MinigameResult, MinigameRunner } from '../types';
import { showMinigameIntro } from '../_shared/MinigameIntroPanel';
import { S, COLORS, FONT_STACK } from '../../systems/TextStyle';

/**
 * WHERE'S KERO — minijuego del menú de Kero (Día 9b).
 *
 * Mecánica:
 *   - Escena modal full-viewport con un fondo "habitación caótica" generado
 *     procedurally (muchos objetos pequeños, cojines, plantas, libros — en
 *     colores marrones/naranjas/rojos/verdes).
 *   - 8 Keros escondidos en posiciones random no superpuestas, con
 *     escalas y tints sutilmente variados para camuflarse con la decoración.
 *   - Click sobre un Kero → se "encuentra" (tint amarillo + ✓ flotante).
 *   - Click en cualquier otro sitio → "✗" flotante decorativo (no penaliza).
 *   - Encuentra los 8 → win → unlock 'misterioso' (regalo de Kero con
 *     secretCode para Día 12 PC Alex).
 *   - ESC para abortar (no aplica cooldown).
 *
 * No hay límite de tiempo para no frustrar; el tracking de tiempo es
 * sólo cosmético ("lo encontraste en 1m 23s").
 */

const PANEL_DEPTH = 2000;
const PLAY_TOP = 20;
const PLAY_BOTTOM_INSET = 20;
const KEROS_TOTAL = 8;
const MIN_KERO_SEPARATION_PX = 22;

interface KeroSpot {
  sprite: Phaser.GameObjects.Sprite;
  found: boolean;
  baseTint: number;
}

export const runWhereKeroMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>(async (resolve) => {
    const ok = await showMinigameIntro(ctx.scene, {
      title: "WHERE'S KERO",
      description:
        'Kero ha decidido jugar al escondite.\n' +
        'Otra vez.\n\n' +
        'Hay 8 Keros escondidos. Encuéntralos todos.',
      controls: 'CLIC encontrar  ·  ESC salir',
    });
    if (!ok) return resolve({ success: false, reason: 'aborted' });
    new WhereKeroGame(ctx, resolve).start();
  });
};

class WhereKeroGame {
  private ctx: MinigameContext;
  private resolveOuter: (r: MinigameResult) => void;

  // Estado.
  private keros: KeroSpot[] = [];
  private found = 0;
  private misses = 0;
  private finished = false;
  private endingPhase = false;
  private startedAtMs = 0;
  private elapsedAtFinishMs = 0;

  // Visuales.
  private dim!: Phaser.GameObjects.Rectangle;
  private bg!: Phaser.GameObjects.Rectangle;
  private decoration: Phaser.GameObjects.GameObject[] = [];
  private hudCounter!: Phaser.GameObjects.Text;
  private hudTimer!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private clickCatcher!: Phaser.GameObjects.Rectangle;

  private keyDownHandler!: (e: KeyboardEvent) => void;
  private onUpdate?: (time: number, delta: number) => void;

  constructor(ctx: MinigameContext, resolve: (r: MinigameResult) => void) {
    this.ctx = ctx;
    this.resolveOuter = resolve;
  }

  start(): void {
    this.buildBackdrop();
    this.scatterDecoration();
    this.placeKeros();
    this.buildHud();
    this.bindInput();
    this.startedAtMs = this.ctx.scene.time.now;

    this.onUpdate = (time, _delta) => this.tick(time);
    this.ctx.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
  }

  // ──────────────────────────────────────────────────────────────────
  // VISUALES
  // ──────────────────────────────────────────────────────────────────

  private buildBackdrop(): void {
    const cam = this.ctx.scene.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    // Dim que tape el apartamento.
    this.dim = this.ctx.scene.add
      .rectangle(cx, cy, cam.width, cam.height, 0x000000, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH);

    // Fondo "suelo": marrón cálido.
    this.bg = this.ctx.scene.add
      .rectangle(cx, cy, cam.width, cam.height, 0x2c1f15, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);

    // Click catcher: rectángulo grande invisible debajo de los Keros.
    // Es el último click "fallback" cuando no aciertan a un Kero. Va
    // SOLO sobre el área de juego (excluye HUD top/bottom).
    const playH = cam.height - PLAY_TOP - PLAY_BOTTOM_INSET;
    this.clickCatcher = this.ctx.scene.add
      .rectangle(cx, PLAY_TOP + playH / 2, cam.width, playH, 0x000000, 0.001)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2)
      .setInteractive();
    this.clickCatcher.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.finished) return;
      this.spawnMissMark(pointer.worldX, pointer.worldY);
      this.misses += 1;
    });
  }

  /**
   * Decoración procedural — muchos objetos en colores que se solapan con
   * el de Kero (naranja/marrón/tan) para camuflarlo, plus algunos rojos/
   * verdes/azules de cojines/plantas para variar.
   *
   * Importante: TODO va a depth < KEROS para que los gatos se puedan
   * ver. No bloqueamos clicks (los cuadrados decorativos NO son
   * interactivos; los keros están por encima).
   */
  private scatterDecoration(): void {
    const cam = this.ctx.scene.cameras.main;
    const w = cam.width;
    const h = cam.height - PLAY_TOP - PLAY_BOTTOM_INSET;
    const yMin = PLAY_TOP;
    const yMax = PLAY_TOP + h;

    // Paleta — incluye colores cercanos a Kero (#e79f47).
    const PALETTE = [
      0x5a3825, // marrón oscuro (sombra)
      0x8b6f47, // marrón medio
      0xb58e5e, // tan
      0xc08a4f, // tan oscuro (cerca de Kero)
      0xe79f47, // naranja Kero (mismo!)
      0xd0823f, // naranja oscuro
      0x6b4425, // marrón profundo
      0x4a5c2a, // verde oliva (planta)
      0x6b7d3a, // verde medio (planta)
      0x8a3a3a, // rojo cojín
      0xa55a5a, // rosa cojín
      0x3a4a5a, // azul libro
      0xfbbf24, // amarillo distractor
      0x1a0e08, // negro sombra
    ];

    // Capa 1: ~25 objetos medianos (libros/cojines).
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * w;
      const y = yMin + Math.random() * h;
      const ww = 8 + Math.random() * 24;
      const hh = 6 + Math.random() * 18;
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const shape = Math.random() < 0.5
        ? this.ctx.scene.add.rectangle(x, y, ww, hh, color, 1)
        : this.ctx.scene.add.ellipse(x, y, ww, hh, color, 1);
      shape.setScrollFactor(0).setDepth(PANEL_DEPTH + 3);
      this.decoration.push(shape);
    }

    // Capa 2: ~70 motas pequeñas (textura).
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w;
      const y = yMin + Math.random() * h;
      const r = 1 + Math.random() * 3;
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const dot = this.ctx.scene.add.circle(x, y, r, color, 1);
      dot.setScrollFactor(0).setDepth(PANEL_DEPTH + 4);
      this.decoration.push(dot);
    }

    // Capa 3: ~12 "plantas" (3-5 elipses verdes apiladas).
    for (let i = 0; i < 12; i++) {
      const cx = 20 + Math.random() * (w - 40);
      const cy = yMin + 20 + Math.random() * (h - 40);
      const leaves = 3 + Math.floor(Math.random() * 3);
      for (let l = 0; l < leaves; l++) {
        const angle = (l / leaves) * Math.PI * 2 + Math.random();
        const dist = 4 + Math.random() * 6;
        const lx = cx + Math.cos(angle) * dist;
        const ly = cy + Math.sin(angle) * dist;
        const ww = 6 + Math.random() * 10;
        const hh = 4 + Math.random() * 8;
        const color = Math.random() < 0.7 ? 0x4a5c2a : 0x6b7d3a;
        const leaf = this.ctx.scene.add.ellipse(lx, ly, ww, hh, color, 1);
        leaf.setScrollFactor(0).setDepth(PANEL_DEPTH + 5);
        this.decoration.push(leaf);
      }
    }

    // Capa 4: ~15 "rectángulos altos" (libros de pie / cajas).
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * w;
      const y = yMin + Math.random() * h;
      const ww = 4 + Math.random() * 6;
      const hh = 14 + Math.random() * 22;
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const book = this.ctx.scene.add.rectangle(x, y, ww, hh, color, 1);
      book.setScrollFactor(0).setDepth(PANEL_DEPTH + 6);
      this.decoration.push(book);
    }
  }

  private placeKeros(): void {
    const cam = this.ctx.scene.cameras.main;
    const w = cam.width;
    const h = cam.height - PLAY_TOP - PLAY_BOTTOM_INSET;
    const yMin = PLAY_TOP + 10;
    const yMax = PLAY_TOP + h - 10;

    // Posiciones non-overlap. Generamos hasta NUM_TARGET con un retry.
    const positions: { x: number; y: number; scale: number; tint: number }[] = [];
    const MAX_RETRIES = 200;

    // Tints: variaciones sutiles del naranja Kero. Algunos sin tint.
    const TINT_VARIANTS = [
      0xffffff, // sin tint (color original)
      0xffffff,
      0xffffff,
      0xe8a060, // un pelín más cálido
      0xffd0a0, // un pelín más claro
      0xc78030, // un pelín más oscuro
      0xff9050, // saturado
    ];
    // Scales que producen píxeles integers (32 source × scale = entero):
    // 0.5=16, 0.625=20, 0.75=24, 0.875=28, 1.0=32.
    const SCALES = [0.5, 0.625, 0.625, 0.75, 0.75, 0.875, 0.875, 1.0];

    for (let i = 0; i < KEROS_TOTAL; i++) {
      let placed = false;
      for (let retry = 0; retry < MAX_RETRIES && !placed; retry++) {
        const x = 18 + Math.random() * (w - 36);
        const y = yMin + Math.random() * (yMax - yMin);
        const tooClose = positions.some(
          (p) =>
            Math.hypot(p.x - x, p.y - y) < MIN_KERO_SEPARATION_PX,
        );
        if (!tooClose) {
          positions.push({
            x,
            y,
            scale: SCALES[i] ?? 0.8,
            tint: TINT_VARIANTS[Math.floor(Math.random() * TINT_VARIANTS.length)],
          });
          placed = true;
        }
      }
      // Fallback: si no se encontró posición tras N retries, plot en
      // posición forzada (algo de overlap es preferible a no tener 8).
      if (!placed) {
        positions.push({
          x: 18 + Math.random() * (w - 36),
          y: yMin + Math.random() * (yMax - yMin),
          scale: SCALES[i] ?? 0.8,
          tint: TINT_VARIANTS[Math.floor(Math.random() * TINT_VARIANTS.length)],
        });
      }
    }

    // Crea los sprites. Texture: 'kero-walk' frame 0 (32×32, sprite Kero
    // de pie de perfil — buena silueta de gato reconocible). NO hay
    // textura 'kero' a secas: CatAnimations registra texturas por anim.
    const tex = this.pickKeroTexture();
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const sprite = this.ctx.scene.add.sprite(p.x, p.y, tex, 0);
      sprite.setScale(p.scale);
      sprite.setTint(p.tint);
      sprite.setScrollFactor(0);
      // Algunos miran a la derecha para variedad visual.
      if (Math.random() < 0.5) sprite.setFlipX(true);
      // Encima de toda la decoración (depths 3-6) pero por debajo del HUD (8-10).
      sprite.setDepth(PANEL_DEPTH + 7);
      sprite.setInteractive({ useHandCursor: true });
      const spot: KeroSpot = { sprite, found: false, baseTint: p.tint };
      sprite.on('pointerdown', () => this.handleKeroClick(spot));
      this.keros.push(spot);
    }
  }

  /**
   * Elige la mejor textura de Kero disponible. Prioridad:
   *   1) `kero-walk` (32×32, cat de perfil — silueta clara)
   *   2) `kero-sleep` (32×32, cat tumbado)
   *   3) `kero-idle` (16×16, fallback)
   */
  private pickKeroTexture(): string {
    const candidates = ['kero-walk', 'kero-sleep', 'kero-idle'];
    for (const k of candidates) {
      if (this.ctx.scene.textures.exists(k)) return k;
    }
    // Fallback final — algo válido (Phaser usa __MISSING si no existe).
    return 'kero-walk';
  }

  private buildHud(): void {
    const cam = this.ctx.scene.cameras.main;

    // Fondo del HUD top.
    const topHud = this.ctx.scene.add
      .rectangle(cam.width / 2, PLAY_TOP / 2, cam.width, PLAY_TOP, 0x1a0e08, 0.85)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 8);
    this.decoration.push(topHud);

    this.hudCounter = this.ctx.scene.add
      .text(8, PLAY_TOP / 2, 'KEROS  0/' + KEROS_TOTAL, {
        fontFamily: FONT_STACK,
        fontSize: '9px',
        color: COLORS.yellow,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 9);

    this.hudTimer = this.ctx.scene.add
      .text(cam.width - 8, PLAY_TOP / 2, '0:00', {
        fontFamily: FONT_STACK,
        fontSize: '9px',
        color: COLORS.textBeige,
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 9);

    this.statusText = this.ctx.scene.add
      .text(cam.width / 2, PLAY_TOP / 2, '', {
        fontFamily: FONT_STACK,
        fontSize: '8px',
        color: COLORS.success,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 9);

    // HUD bottom.
    const bottomHud = this.ctx.scene.add
      .rectangle(
        cam.width / 2,
        cam.height - PLAY_BOTTOM_INSET / 2,
        cam.width,
        PLAY_BOTTOM_INSET,
        0x1a0e08,
        0.85,
      )
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 8);
    this.decoration.push(bottomHud);

    this.hintText = this.ctx.scene.add
      .text(cam.width / 2, cam.height - PLAY_BOTTOM_INSET / 2, 'CLIC encontrar  ·  ESC salir', S.hint())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 9);
  }

  private bindInput(): void {
    this.keyDownHandler = (e: KeyboardEvent) => {
      const k = (e.key || '').toUpperCase();
      if (k === 'ESCAPE' || k === 'ESC') {
        e.preventDefault();
        if (this.endingPhase) {
          this.finish(this.found >= KEROS_TOTAL, this.found >= KEROS_TOTAL ? 'completed' : 'failed');
        } else {
          this.abort();
        }
        return;
      }
      if (this.endingPhase && (k === ' ' || k === 'SPACEBAR' || k === 'ENTER')) {
        e.preventDefault();
        this.finish(this.found >= KEROS_TOTAL, this.found >= KEROS_TOTAL ? 'completed' : 'failed');
      }
    };
    window.addEventListener('keydown', this.keyDownHandler);
    this.ctx.scene.events.once('shutdown', () => this.abort());
    this.ctx.scene.events.once('destroy', () => this.abort());
  }

  // ──────────────────────────────────────────────────────────────────
  // INTERACCIÓN
  // ──────────────────────────────────────────────────────────────────

  private handleKeroClick(spot: KeroSpot): void {
    if (this.finished || this.endingPhase || spot.found) return;
    spot.found = true;
    this.found += 1;

    // Tint amarillo + pop.
    spot.sprite.setTint(0xfbbf24);
    this.ctx.scene.tweens.add({
      targets: spot.sprite,
      scaleX: spot.sprite.scaleX * 1.5,
      scaleY: spot.sprite.scaleY * 1.5,
      duration: 180,
      yoyo: true,
      ease: 'Cubic.easeOut',
    });

    // ✓ flotante.
    const check = this.ctx.scene.add
      .text(spot.sprite.x, spot.sprite.y - 12, '✓', {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        color: COLORS.success,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 10);
    this.ctx.scene.tweens.add({
      targets: check,
      y: check.y - 14,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => check.destroy(),
    });

    // Update counter.
    this.hudCounter.setText('KEROS  ' + this.found + '/' + KEROS_TOTAL);

    if (this.found >= KEROS_TOTAL) {
      this.elapsedAtFinishMs = this.ctx.scene.time.now - this.startedAtMs;
      this.endingPhase = true;
      this.statusText.setText('¡todos!  SPACE para cerrar');
      // Pequeña celebración: pop a todos los keros.
      for (const k of this.keros) {
        this.ctx.scene.tweens.add({
          targets: k.sprite,
          scaleX: k.sprite.scaleX * 1.2,
          scaleY: k.sprite.scaleY * 1.2,
          duration: 300,
          yoyo: true,
          delay: Math.random() * 300,
          ease: 'Cubic.easeOut',
        });
      }
    }
  }

  private spawnMissMark(x: number, y: number): void {
    const mark = this.ctx.scene.add
      .text(x, y, '✗', {
        fontFamily: FONT_STACK,
        fontSize: '10px',
        color: COLORS.error,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 9);
    this.ctx.scene.tweens.add({
      targets: mark,
      alpha: 0,
      y: y + 6,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => mark.destroy(),
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // TICK (update timer)
  // ──────────────────────────────────────────────────────────────────

  private tick(time: number): void {
    if (this.finished) return;
    if (this.endingPhase) return;
    const elapsed = time - this.startedAtMs;
    this.hudTimer.setText(formatMMSS(elapsed));
  }

  // ──────────────────────────────────────────────────────────────────
  // FINISH
  // ──────────────────────────────────────────────────────────────────

  private abort(): void {
    if (this.finished) return;
    this.finish(false, 'aborted');
  }

  private finish(success: boolean, reason: 'completed' | 'aborted' | 'failed'): void {
    if (this.finished) return;
    this.finished = true;
    this.cleanup();
    this.resolveOuter({ success, reason });
  }

  private cleanup(): void {
    if (this.onUpdate) {
      this.ctx.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
      this.onUpdate = undefined;
    }
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);

    this.clickCatcher?.destroy();
    [this.dim, this.bg, this.hudCounter, this.hudTimer, this.hintText, this.statusText].forEach(
      (o) => o?.destroy(),
    );
    for (const d of this.decoration) d.destroy();
    this.decoration = [];
    for (const k of this.keros) k.sprite.destroy();
    this.keros = [];
  }

  /** Lo expongo por si el caller quiere usarlo (no de momento). */
  getElapsedMs(): number {
    return this.elapsedAtFinishMs;
  }
}

function formatMMSS(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
