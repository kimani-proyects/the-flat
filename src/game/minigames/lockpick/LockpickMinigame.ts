import * as Phaser from 'phaser';
import type { MinigameContext, MinigameResult, MinigameRunner } from '../types';
import { showMinigameIntro } from '../_shared/MinigameIntroPanel';
import { Sfx } from '../../systems/SfxBank';

/**
 * LOCKPICKING — minijuego del arco de la cocina.  REWORK v3 (4 cuartos).
 *
 * Cambios respecto a v2:
 *   - QUITADO el "click dot" amarillo de proximidad — daba demasiada
 *     pista. Ahora vas a ciegas, sólo el feedback de la barra del
 *     cuarto te dice si estás bien.
 *   - QUITADOS los 3 niveles. Sólo 1 nivel difícil.
 *   - QUITADO el drift (era L3, sin uso ya).
 *   - El cilindro tiene 4 CUARTOS que hay que rellenar SECUENCIALMENTE.
 *     Cada cuarto tiene su propio sweet spot (ángulo random).
 *   - Cuando llenas un cuarto, AUTOMÁTICAMENTE se reaaleatoriza el sweet
 *     spot del siguiente y debes encontrarlo de cero.
 *   - DRAIN: si presionas SPACE FUERA del sweet spot, además de gastar
 *     salud de la ganzúa, la barra del cuarto actual RETROCEDE. Esto
 *     evita que te coles cerca y vayas avanzando "por casualidad".
 *   - Mantenido: 3 ganzúas. Si se rompen las 3 → fallo del intento.
 *     Al volver a interactuar, todos los sweet spots se reaaleatorizan.
 *
 * Mecánica detallada:
 *
 *   - Ganzúa rota libre con A/D (o ←/→). Sin SPACE no pasa nada.
 *   - SPACE en sweet spot del cuarto activo → barra del cuarto avanza.
 *   - SPACE fuera del sweet spot → ganzúa pierde salud (rompe rápido)
 *     Y la barra del cuarto actual drena (más rápido que el fill).
 *   - Sin SPACE → ni avanza ni retrocede (la ganzúa recupera salud).
 *   - Cuando un cuarto se llena al 100% → click visual + el cilindro
 *     rota 90° → se reaaleatoriza el sweet spot del siguiente cuarto.
 *   - Cuando los 4 cuartos están llenos → KCHACK → cerradura abierta.
 *
 * Como un cofre Skyrim "hard tier" pero acotado a 3 ganzúas — debe ser
 * resoluble con paciencia, no PUTEANTE MAX.
 *
 * ESC para abortar.
 */

const PANEL_DEPTH = 2000;

const QUARTERS = 4;
const TOLERANCE_DEG = 12; // it.5: 8 era too tight sin proximity hint.
const ROTATE_SPEED_DEG_PER_FRAME = 1.4; // ~84°/s a 60fps
/**
 * It.6 — REWORK ganzúas: en vez de "se rompe rápido al fallar y regenera al
 * acertar", ahora cada ganzúa tiene un "lifetime" finito de SPACE pulsado
 * (~3.5s totales). Se consume mientras presionas SPACE, esté o no en el
 * sweet spot. NO regenera. Cuando se gasta, se rompe — cuadro María.
 *
 * Esto cambia el feel de "ansiedad / no apretar de más" a "presupuesto
 * de presión, gestiona tus 2 ganzúas". Es más justo y permite recuperarse
 * de errores con la skill de leer rápido el sweet spot.
 */
const PICK_LIFETIME_MS = 3500;
const QUARTER_FILL_MS = 600; // it.6: bajado de 700 — slight buff
const QUARTER_DRAIN_MULT = 1.0; // it.6: bajado de 1.5 — drain al ritmo del fill (no más rápido)
const STARTING_PICKS = 2; // it.6: bajado de 3 — pero cada una vive más

/** Frases de María al romper la 1ª ganzúa (it.6 — narrativo). */
const MARIA_PICK_BREAK_FIRST = [
  '"no me jodas... menos mal que tenía otra."',
  '"vale, vale, otra ganzúa. respira."',
  '"se ha roto. una más, María. una más."',
];

/** Frases de María al romper la 2ª (game over) — random con palabrota. */
const MARIA_PICK_BREAK_SECOND = [
  '"joder, joder. me cago en la cerradura."',
  '"vaya mierda. otra vez."',
  '"me cago en la puta cocina entera."',
  '"joder. lo dejo. lo dejo y vuelvo luego."',
  '"esto está jodido. necesito un descanso."',
  '"hijo de puta, casi lo tenía."',
];

export const runLockpickMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>(async (resolve) => {
    const ok = await showMinigameIntro(ctx.scene, {
      title: 'GANZÚA — COCINA',
      description:
        'Encuentra el ángulo correcto con A/D.\n' +
        'Mantén SPACE para girar el cilindro.\n' +
        'Tienes 2 ganzúas — cada una se desgasta al presionar.\n' +
        'Apaga el ímpetu: aprieta sólo cuando estés segura.',
      controls: 'A/D o ← →: girar  ·  SPACE: presión  ·  ESC: salir',
    });
    if (!ok) return resolve({ success: false, reason: 'aborted' });
    new LockpickGame(ctx, resolve).start();
  });
};

class LockpickGame {
  private ctx: MinigameContext;
  private resolveOuter: (r: MinigameResult) => void;

  // Estado del cilindro.
  private quarterIdx = 0; // cuarto activo (0..3)
  private quarterFill = 0; // 0..1 — relleno del cuarto activo
  private completedQuarters = 0; // cuántos cuartos completos llevas
  private sweetAngle = 0; // ángulo del sweet spot del cuarto activo
  private cylinderRotation = 0; // rotación visual del cilindro (90° por cuarto completado)
  /**
   * Flag para evitar que el tick siga llamando a quarterCompleted entre el
   * momento en que un cuarto se llena (quarterFill=1) y el delayedCall de
   * 280ms que hace startNewQuarter(). Sin este flag, durante esos 280ms
   * con SPACE pulsado y sweet spot intacto, tick re-dispara quarterCompleted
   * cada frame → el juego "se completa" en una sola pulsación. (Bug it.5.)
   */
  private inQuarterTransition = false;

  // Estado de la ganzúa.
  private picksRemaining = STARTING_PICKS;
  private pickAngle = 0;
  private pickHealth = PICK_LIFETIME_MS; // it.6: lifetime, ya no "health to break"
  private pickPressed = false;
  private pickShakeOffset = 0;
  /** Flag durante el cuadro María de "ganzúa rota" — bloquea el tick. */
  private inPickBreakDialog = false;

  // Visuales temporales del cuadro María (se destruyen tras cerrar).
  private mariaDialogObjects: Phaser.GameObjects.GameObject[] = [];

  private finished = false;

  // Input.
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private keyLeft?: Phaser.Input.Keyboard.Key;
  private keyRight?: Phaser.Input.Keyboard.Key;
  private keySpace?: Phaser.Input.Keyboard.Key;
  private keyEsc?: Phaser.Input.Keyboard.Key;

  // Visuales.
  private dim!: Phaser.GameObjects.Rectangle;
  private panelBg!: Phaser.GameObjects.Rectangle;
  private panelBorder!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private lockGfx!: Phaser.GameObjects.Graphics;
  private quarterBarBg!: Phaser.GameObjects.Rectangle;
  private quarterBarFg!: Phaser.GameObjects.Rectangle;
  private healthBarBg!: Phaser.GameObjects.Rectangle;
  private healthBarFg!: Phaser.GameObjects.Rectangle;
  private picksLabel!: Phaser.GameObjects.Text;
  private quarterLabel!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  private cx = 0;
  private cy = 0;

  private onUpdate?: (time: number, delta: number) => void;

  constructor(ctx: MinigameContext, resolve: (r: MinigameResult) => void) {
    this.ctx = ctx;
    this.resolveOuter = resolve;
  }

  start(): void {
    this.buildUi();
    this.bindInput();
    this.startNewQuarter(0);
    this.refreshLabels();
    this.onUpdate = (_time, delta) => this.tick(delta);
    this.ctx.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
  }

  // ──────────────────────────────────────────────────────────────────────
  // UI
  // ──────────────────────────────────────────────────────────────────────

  private buildUi(): void {
    const cam = this.ctx.scene.cameras.main;
    const PW = 220;
    const PH = 170;
    this.cx = cam.width / 2;
    this.cy = cam.height / 2;

    this.dim = this.ctx.scene.add
      .rectangle(this.cx, this.cy, cam.width, cam.height, 0x000000, 0.6)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH);

    this.panelBorder = this.ctx.scene.add
      .rectangle(this.cx, this.cy, PW + 4, PH + 4, 0xfbbf24, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.panelBg = this.ctx.scene.add
      .rectangle(this.cx, this.cy, PW, PH, 0x1a0e08, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);

    this.titleText = this.ctx.scene.add
      .text(this.cx, this.cy - PH / 2 + 9, 'GANZÚA', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '9px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.subtitleText = this.ctx.scene.add
      .text(this.cx, this.cy - PH / 2 + 19, this.ctx.roomLabel + ' — 4 cuartos', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#c08a4f',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.lockGfx = this.ctx.scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Quarter fill bar — relleno del cuarto activo.
    this.quarterBarBg = this.ctx.scene.add
      .rectangle(this.cx, this.cy + PH / 2 - 22, PW - 24, 5, 0x3a2618, 1)
      .setStrokeStyle(1, 0x6b4425, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);
    this.quarterBarFg = this.ctx.scene.add
      .rectangle(this.cx - (PW - 24) / 2, this.cy + PH / 2 - 22, 0, 4, 0x4ade80, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);

    this.healthBarBg = this.ctx.scene.add
      .rectangle(this.cx, this.cy + PH / 2 - 13, PW - 24, 3, 0x3a2618, 1)
      .setStrokeStyle(1, 0x6b4425, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);
    this.healthBarFg = this.ctx.scene.add
      .rectangle(this.cx - (PW - 24) / 2, this.cy + PH / 2 - 13, PW - 24, 2, 0xef4444, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);

    this.picksLabel = this.ctx.scene.add
      .text(this.cx, this.cy + PH / 2 - 5, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#c08a4f',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.quarterLabel = this.ctx.scene.add
      .text(this.cx, this.cy - PH / 2 + 30, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#fbbf24',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.hintText = this.ctx.scene.add
      .text(this.cx, this.cy + PH / 2 + 8, 'A/D: girar  ·  SPACE: presión  ·  ESC: salir', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#9ca3af',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);
  }

  private bindInput(): void {
    const kb = this.ctx.scene.input.keyboard;
    if (!kb) return;
    this.keyA = kb.addKey('A');
    this.keyD = kb.addKey('D');
    this.keyLeft = kb.addKey('LEFT');
    this.keyRight = kb.addKey('RIGHT');
    this.keySpace = kb.addKey('SPACE');
    this.keyEsc = kb.addKey('ESC');

    this.keyEsc.on('down', () => this.abort());
  }

  // ──────────────────────────────────────────────────────────────────────
  // QUARTER LIFECYCLE
  // ──────────────────────────────────────────────────────────────────────

  private startNewQuarter(idx: number): void {
    this.quarterIdx = idx;
    this.quarterFill = 0;
    this.sweetAngle = Math.floor(Math.random() * 360);
    // No reseteamos pickAngle ni pickHealth — sigue donde estaba la ganzúa.
    this.refreshLabels();
    this.redrawLock();
  }

  private refreshLabels(): void {
    this.quarterLabel.setText(
      `cuarto ${this.completedQuarters + 1}/${QUARTERS}`,
    );
    this.picksLabel.setText(`ganzúas: ${this.picksRemaining}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // TICK
  // ──────────────────────────────────────────────────────────────────────

  private tick(delta: number): void {
    if (this.finished) return;
    if (this.inQuarterTransition) return; // bloqueamos input durante transición
    if (this.inPickBreakDialog) return; // bloqueamos durante cuadro María

    // 1) rotación
    const rotating =
      (this.keyA?.isDown || this.keyLeft?.isDown ? -1 : 0) +
      (this.keyD?.isDown || this.keyRight?.isDown ? 1 : 0);
    if (rotating !== 0) {
      this.pickAngle = (this.pickAngle + rotating * ROTATE_SPEED_DEG_PER_FRAME + 360) % 360;
    }

    // 2) presión
    const pressing = !!this.keySpace?.isDown;
    this.pickPressed = pressing;
    const inSweet = this.angleDistance(this.pickAngle, this.sweetAngle) <= TOLERANCE_DEG;

    // It.6: la ganzúa se consume MIENTRAS PRESIONAS SPACE, esté o no en
    // sweet spot. NO regenera. El sweet spot decide si el cuarto avanza
    // o se drena, pero la ganzúa SE GASTA igual. Esto incentiva apretar
    // poco y bien (en vez de mantener SPACE indiscriminadamente).
    if (pressing) {
      this.pickHealth -= delta;
      if (this.pickHealth <= 0) {
        this.pickHealth = 0;
        this.breakPick();
        return;
      }
      if (inSweet) {
        // Avanza cuarto. Sin shake.
        this.quarterFill = Math.min(1, this.quarterFill + delta / QUARTER_FILL_MS);
        this.pickShakeOffset = 0;
      } else {
        // Drena cuarto al ritmo del fill (no más rápido). Shake suave
        // para feedback de "estás apretando mal".
        this.quarterFill = Math.max(
          0,
          this.quarterFill - (delta / QUARTER_FILL_MS) * QUARTER_DRAIN_MULT,
        );
        this.pickShakeOffset = (Math.random() - 0.5) * 2;
      }
    } else {
      // No presiona — todo estable. Salud no regenera (lifetime fijo).
      this.pickShakeOffset = 0;
    }

    // 3) ¿cuarto completo?
    if (this.quarterFill >= 1) {
      this.quarterCompleted();
      return;
    }

    // 4) redraw
    this.redrawLock();
    this.redrawBars();
  }

  // ──────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ──────────────────────────────────────────────────────────────────────

  private quarterCompleted(): void {
    // CRÍTICO: bloquear el tick INMEDIATAMENTE para no re-disparar.
    this.inQuarterTransition = true;
    this.quarterFill = 0; // visual reset también, para que el cuarto se vea como "saltado a verde completo"
    const cam = this.ctx.scene.cameras.main;
    // Click visual.
    const click = this.ctx.scene.add
      .text(cam.width / 2, cam.height / 2 - 12, 'click', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#4ade80',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);
    this.ctx.scene.tweens.add({
      targets: click,
      alpha: 0,
      y: click.y - 10,
      duration: 500,
      onComplete: () => click.destroy(),
    });

    this.completedQuarters += 1;
    this.cylinderRotation = (this.cylinderRotation + 90) % 360;

    if (this.completedQuarters >= QUARTERS) {
      // KCHACK final.
      const kchack = this.ctx.scene.add
        .text(cam.width / 2, cam.height / 2 - 10, 'KCHACK', {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '14px',
          color: '#fbbf24',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 6);
      this.ctx.scene.tweens.add({
        targets: kchack,
        alpha: 0,
        y: kchack.y - 10,
        duration: 700,
        ease: 'Cubic.easeOut',
        onComplete: () => kchack.destroy(),
      });
      this.ctx.scene.cameras.main.shake(150, 0.005);
      this.ctx.scene.time.delayedCall(550, () => this.finish(true));
    } else {
      // Siguiente cuarto.
      this.ctx.scene.time.delayedCall(280, () => {
        if (this.finished) return;
        this.startNewQuarter(this.completedQuarters);
        this.inQuarterTransition = false;
      });
    }
  }

  private breakPick(): void {
    this.picksRemaining -= 1;
    this.refreshLabels();
    // Bloquea el tick para que no siga procesando rotación/SPACE durante
    // el cuadro de María.
    this.inPickBreakDialog = true;

    const cam = this.ctx.scene.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    // *CRACK* visual breve.
    const piece = this.ctx.scene.add
      .text(cx, cy, '*CRACK*', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#ef4444',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 5);
    this.ctx.scene.tweens.add({
      targets: piece,
      alpha: 0,
      y: piece.y - 6,
      duration: 480,
      onComplete: () => piece.destroy(),
    });
    this.ctx.scene.cameras.main.shake(120, 0.004);

    // Pasados ~500ms del crack, sale el cuadro de María.
    this.ctx.scene.time.delayedCall(500, () => {
      if (this.finished) return;
      const isLast = this.picksRemaining <= 0;
      const pool = isLast ? MARIA_PICK_BREAK_SECOND : MARIA_PICK_BREAK_FIRST;
      const phrase = pool[Math.floor(Math.random() * pool.length)];
      this.showMariaDialog(
        'María: ' + phrase,
        isLast ? 0xef4444 : 0xfbbf24,
        () => {
          if (this.finished) return;
          if (isLast) {
            // Game over.
            this.finish(false, 'failed');
            return;
          }
          // Continúa con la siguiente ganzúa. Salud reset al lifetime
          // total, sweet spot se reaaleatoriza (justo: no aprovecharte
          // del ángulo en que se rompió la ganzúa). El fill del cuarto
          // SE MANTIENE — no pierdes progreso por romper la ganzúa.
          this.pickHealth = PICK_LIFETIME_MS;
          this.sweetAngle = Math.floor(Math.random() * 360);
          this.refreshLabels();
          this.redrawLock();
          this.inPickBreakDialog = false;
        },
      );
    });
  }

  /**
   * Cuadro de diálogo de María. Similar al showMindDialog del PPT pero
   * en color rosa María. Bloquea hasta SPACE/ENTER (se autocierra a los
   * 3.5s para que no se quede atascado si la jugadora no pulsa).
   */
  private showMariaDialog(
    text: string,
    color: number,
    after: () => void,
  ): void {
    this.clearMariaDialog();
    const cam = this.ctx.scene.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    const overlay = this.ctx.scene.add
      .rectangle(cx, cy, 280, 50, 0xff8ab8, 0.16)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 7);
    const t = this.ctx.scene.add
      .text(cx, cy, text, {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#' + color.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 250 },
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 8);
    const hint = this.ctx.scene.add
      .text(cx, cy + 22, 'SPACE / ENTER', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#9ca3af',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 8);
    this.mariaDialogObjects.push(overlay, t, hint);

    this.ctx.scene.tweens.add({
      targets: overlay,
      alpha: { from: 0.16, to: 0.32 },
      duration: 280,
      yoyo: true,
      repeat: 1,
    });

    let resolved = false;
    const close = () => {
      if (resolved || this.finished) return;
      resolved = true;
      window.removeEventListener('keydown', onKey);
      this.clearMariaDialog();
      after();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    // Auto-close fallback por si la jugadora no pulsa nada.
    this.ctx.scene.time.delayedCall(3500, close);
  }

  private clearMariaDialog(): void {
    for (const o of this.mariaDialogObjects) o.destroy();
    this.mariaDialogObjects = [];
  }

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────

  private redrawLock(): void {
    const cam = this.ctx.scene.cameras.main;
    const cx = cam.width / 2 + this.pickShakeOffset;
    const cy = cam.height / 2 - 4;
    const R = 28;

    const g = this.lockGfx;
    g.clear();

    // Cilindro: aro exterior gris + interior oscuro.
    g.fillStyle(0x6b4425, 1);
    g.fillCircle(cx, cy, R);
    g.fillStyle(0x1a0e08, 1);
    g.fillCircle(cx, cy, R - 3);

    // Marca de las 12 (referencia visual de "norte"). Rota con el cilindro.
    const northRad = (this.cylinderRotation - 90) * (Math.PI / 180);
    const nx = cx + Math.cos(northRad) * (R - 1);
    const ny = cy + Math.sin(northRad) * (R - 1);
    g.fillStyle(0xc08a4f, 1);
    g.fillRect(nx - 1, ny - 1, 2, 2);

    // 4 cuartos como segmentos del aro. Los completos VERDE, el activo
    // se rellena según quarterFill, los pendientes en marrón apagado.
    const segGap = 0.05; // gap pequeño entre segmentos
    for (let i = 0; i < QUARTERS; i++) {
      const start = (-Math.PI / 2) + i * (Math.PI / 2) + segGap;
      const end = (-Math.PI / 2) + (i + 1) * (Math.PI / 2) - segGap;
      let color: number;
      let width = 2;
      if (i < this.completedQuarters) {
        color = 0x4ade80; // completo
        width = 3;
      } else if (i === this.completedQuarters) {
        // Activo: parpadea suave + la porción correspondiente al fill se
        // pinta en verde por encima.
        color = 0x6b7280;
        width = 2;
        g.lineStyle(width, color, 1);
        g.beginPath();
        g.arc(cx, cy, R - 1, start, end, false);
        g.strokePath();
        // Fill verde proporcional.
        if (this.quarterFill > 0) {
          const fillEnd = start + (end - start) * this.quarterFill;
          g.lineStyle(3, 0x4ade80, 1);
          g.beginPath();
          g.arc(cx, cy, R - 1, start, fillEnd, false);
          g.strokePath();
        }
        continue;
      } else {
        color = 0x3a2618; // pendiente
        width = 2;
      }
      g.lineStyle(width, color, 1);
      g.beginPath();
      g.arc(cx, cy, R - 1, start, end, false);
      g.strokePath();
    }

    // Ganzúa.
    const rad = (this.pickAngle - 90) * (Math.PI / 180);
    const px = cx + Math.cos(rad) * (R - 4);
    const py = cy + Math.sin(rad) * (R - 4);
    const inSweet = this.angleDistance(this.pickAngle, this.sweetAngle) <= TOLERANCE_DEG;
    g.lineStyle(2, this.pickPressed && inSweet ? 0x4ade80 : 0xfbbf24, 1);
    g.lineBetween(cx, cy, px, py);
    g.fillStyle(0xfbbf24, 1);
    g.fillRect(px - 1.5, py - 1.5, 3, 3);
  }

  private redrawBars(): void {
    const max = this.quarterBarBg.width;
    this.quarterBarFg.width = max * this.quarterFill;
    // It.6: la barra es ahora el LIFETIME restante de la ganzúa (no salud
    // que regenera). 0 = ganzúa rota.
    this.healthBarFg.width = max * (this.pickHealth / PICK_LIFETIME_MS);
    if (this.pickHealth / PICK_LIFETIME_MS < 0.3) {
      this.healthBarFg.fillColor = 0xb91c1c;
    } else {
      this.healthBarFg.fillColor = 0xef4444;
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // FINISH
  // ──────────────────────────────────────────────────────────────────────

  private abort(): void {
    if (this.finished) return;
    this.finish(false, 'aborted');
  }

  private finish(success: boolean, reason?: 'completed' | 'aborted' | 'failed'): void {
    if (this.finished) return;
    this.finished = true;
    this.cleanup();
    this.resolveOuter({
      success,
      reason: reason ?? (success ? 'completed' : 'failed'),
    });
  }

  private cleanup(): void {
    if (this.onUpdate) {
      this.ctx.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
      this.onUpdate = undefined;
    }
    this.keyEsc?.removeAllListeners();
    // OJO: NO removeKey() — Phaser reusa Keys con la apartment scene.

    // Limpia cuadro de María si quedara abierto (it.6).
    this.clearMariaDialog();

    [
      this.dim,
      this.panelBg,
      this.panelBorder,
      this.titleText,
      this.subtitleText,
      this.lockGfx,
      this.quarterBarBg,
      this.quarterBarFg,
      this.healthBarBg,
      this.healthBarFg,
      this.picksLabel,
      this.quarterLabel,
      this.hintText,
    ].forEach((o) => o?.destroy());
  }

  // ──────────────────────────────────────────────────────────────────────
  // UTIL
  // ──────────────────────────────────────────────────────────────────────

  private angleDistance(a: number, b: number): number {
    return Math.abs(((a - b + 540) % 360) - 180);
  }
}
