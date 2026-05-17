import * as Phaser from 'phaser';
import type { MinigameContext, MinigameResult, MinigameRunner } from '../types';
import { showMinigameIntro } from '../_shared/MinigameIntroPanel';
import { S, COLORS, FONT_STACK } from '../../systems/TextStyle';
import { Sfx } from '../../systems/SfxBank';

/**
 * EL TRILERO DE KERO — minijuego del menú de Kero (Día 9b).
 *
 * Mecánica clásica de "shell game":
 *   1) 3 cojines en fila. Bajo uno hay un ovillo de lana.
 *   2) FASE PEEK — el cojín del centro se levanta unos segundos: ves
 *      el ovillo. Memoriza dónde está.
 *   3) FASE SHUFFLE — los cojines bailan: N swaps random entre cojines
 *      adyacentes (animación de arco, uno por encima del otro). El
 *      ovillo "viaja" siempre con el cojín que lo cubre, así que su
 *      posición cambia con los swaps.
 *   4) FASE PICK — cojines quietos. Click sobre uno.
 *   5) FASE REVEAL — el cojín elegido se levanta. Si hay ovillo → ronda
 *      ganada. Si no → ronda perdida (se enseña dónde estaba).
 *
 * 3 rondas con dificultad escalada (más swaps + más rápido). Si aciertas
 * 2/3 → win → unlock 'misterioso' (regalo con secretCode).
 *
 * ESC para abortar (no aplica cooldown).
 *
 * Visual: minimal pero limpio — 3 rectángulos coloridos (cojines) + un
 * círculo rojo (ovillo). Sin assets externos, todo con primitivas
 * Phaser. La gracia está en la animación.
 */

const PANEL_DEPTH = 2000;

// Layout.
const CUSHION_W = 56;
const CUSHION_H = 38;
const CUSHION_GAP = 16;
const BALL_R = 8;

const ROUNDS_TOTAL = 3;
const ROUNDS_TO_WIN = 2;

interface RoundConfig {
  swaps: number;
  swapDurationMs: number;
}
// Día 9f: cojines unificados (mismo color, sin números visibles en el
// cojín). Antes los colores+números delataban dónde estaba el ovillo.
// Ahora trilero real → puedes nerfear un poco la velocidad/swaps.
const ROUND_CONFIGS: RoundConfig[] = [
  { swaps: 8, swapDurationMs: 320 },
  { swaps: 12, swapDurationMs: 260 },
  { swaps: 16, swapDurationMs: 210 },
];

const PEEK_DURATION_MS = 1800; // un pelín más que antes (1400 → 1800)
const COUNTDOWN_TICK_MS = 600; // duración de cada "3" / "2" / "1"
const REVEAL_DURATION_MS = 1500;

type Phase =
  | 'idle'
  | 'peek'
  | 'countdown'
  | 'shuffle'
  | 'pick'
  | 'reveal'
  | 'between'
  | 'final';

interface CushionGO {
  /** Index lógico del cojín (0,1,2) — NO cambia, sólo el orden visual. */
  id: number;
  rect: Phaser.GameObjects.Rectangle;
  border: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  baseY: number;
  /** Color para diferenciar cojines (decorativo). */
  color: number;
}

export const runKeroShellMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>(async (resolve) => {
    const ok = await showMinigameIntro(ctx.scene, {
      title: 'EL TRILERO DE KERO',
      description:
        'Kero ha aprendido a esconder cosas.\n' +
        'Hay un ovillo bajo un cojín.\n\n' +
        'Memoriza dónde está. Los cojines van a bailar.\n' +
        '3 rondas. Acierta 2 para ganar.',
      controls: 'CLIC para elegir cojín  ·  ESC salir',
    });
    if (!ok) return resolve({ success: false, reason: 'aborted' });
    new KeroShellGame(ctx, resolve).start();
  });
};

class KeroShellGame {
  private ctx: MinigameContext;
  private resolveOuter: (r: MinigameResult) => void;

  // Estado.
  private phase: Phase = 'idle';
  private finished = false;
  private currentRound = 0; // 0..ROUNDS_TOTAL-1
  private wins = 0;
  /**
   * `slotOf[cushionId]` = posición visual actual del cojín cushionId.
   * Y `cushionAtSlot[slot]` = qué cushionId está en ese slot. Mantenemos
   * ambos invariantes en sync — ayuda al reasoning del shuffle.
   */
  private slotOf: number[] = [0, 1, 2];
  private cushionAtSlot: number[] = [0, 1, 2];
  /** ID del cojín que ESCONDE el ovillo (ID lógico, no slot). */
  private ballCushionId = 1;
  /** Ms cuando termina la fase actual (para timing entre fases). */
  private phaseEndsAtMs = 0;
  /** Animaciones en curso del shuffle — para esperar a que terminen. */
  private pendingTweens = 0;
  /** Cuántos swaps quedan en la fase shuffle. */
  private swapsRemaining = 0;
  private swapDurationMs = 400;

  // Visuales.
  private dim!: Phaser.GameObjects.Rectangle;
  private bg!: Phaser.GameObjects.Rectangle;
  private panelBorder!: Phaser.GameObjects.Rectangle;
  private panelBg!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private hudRound!: Phaser.GameObjects.Text;
  private hudScore!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private cushions: CushionGO[] = [];
  /** Día 9f: etiquetas de slot (1/2/3) fijas bajo el suelo. */
  private slotLabels: Phaser.GameObjects.Text[] = [];
  private ball!: Phaser.GameObjects.Arc;

  // Centro & dims.
  private cx = 0;
  private cy = 0;
  private readonly PW = 280;
  private readonly PH = 200;

  // Slots: posiciones x en pantalla por índice 0,1,2.
  private slotXs: number[] = [];
  private cushionRestY = 0;

  // Input.
  private keyDownHandler!: (e: KeyboardEvent) => void;
  private onUpdate?: (time: number, delta: number) => void;

  constructor(ctx: MinigameContext, resolve: (r: MinigameResult) => void) {
    this.ctx = ctx;
    this.resolveOuter = resolve;
  }

  start(): void {
    this.buildUi();
    this.bindInput();
    this.beginRound(0);

    this.onUpdate = (_t, _d) => this.tick();
    this.ctx.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
  }

  // ──────────────────────────────────────────────────────────────────
  // UI
  // ──────────────────────────────────────────────────────────────────

  private buildUi(): void {
    const cam = this.ctx.scene.cameras.main;
    this.cx = cam.width / 2;
    this.cy = cam.height / 2;

    this.dim = this.ctx.scene.add
      .rectangle(this.cx, this.cy, cam.width, cam.height, 0x000000, 0.78)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH);
    this.panelBorder = this.ctx.scene.add
      .rectangle(this.cx, this.cy, this.PW + 4, this.PH + 4, 0xfbbf24, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.panelBg = this.ctx.scene.add
      .rectangle(this.cx, this.cy, this.PW, this.PH, 0x1a0e08, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);
    // Una "alfombra" interna para que se vea cozy.
    this.bg = this.ctx.scene.add
      .rectangle(this.cx, this.cy + 14, this.PW - 24, 80, 0x3a2618, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.titleText = this.ctx.scene.add
      .text(this.cx, this.cy - this.PH / 2 + 12, 'EL TRILERO DE KERO', S.header())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);

    // HUD ronda + score (arriba bajo el título).
    this.hudRound = this.ctx.scene.add
      .text(this.cx - this.PW / 2 + 10, this.cy - this.PH / 2 + 26, '', {
        fontFamily: FONT_STACK,
        fontSize: '8px',
        color: COLORS.yellowDim,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);
    this.hudScore = this.ctx.scene.add
      .text(this.cx + this.PW / 2 - 10, this.cy - this.PH / 2 + 26, '', {
        fontFamily: FONT_STACK,
        fontSize: '8px',
        color: COLORS.yellowDim,
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);

    // Status text central (mensajes de fase).
    this.statusText = this.ctx.scene.add
      .text(this.cx, this.cy - 40, '', {
        fontFamily: FONT_STACK,
        fontSize: '9px',
        color: COLORS.yellow,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);

    // 3 slots.
    const totalW = 3 * CUSHION_W + 2 * CUSHION_GAP;
    const startX = this.cx - totalW / 2 + CUSHION_W / 2;
    this.slotXs = [startX, startX + CUSHION_W + CUSHION_GAP, startX + 2 * (CUSHION_W + CUSHION_GAP)];
    this.cushionRestY = this.cy + 20;

    // Ovillo (debajo de un cojín — depth menor).
    this.ball = this.ctx.scene.add
      .circle(this.slotXs[1], this.cushionRestY + 4, BALL_R, 0xef4444, 1)
      .setStrokeStyle(1, 0x6b1717, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 5);
    // Decoración: 3 lineas sobre el ovillo (lana enrollada).
    // Skip — la animación + tint hace el trabajo.

    // Día 9f: cojines IDÉNTICOS (mismo color, sin label visible). Antes
    // los números pegados al cojín y los colores delataban dónde iba el
    // ovillo. Ahora trilero real — sólo los ojos.
    const CUSHION_COLOR = 0x6b3a25; // marrón cálido oscuro, único color
    const CUSHION_TRIM = 0x4a2818;  // ribete más oscuro, decoración
    for (let i = 0; i < 3; i++) {
      const x = this.slotXs[i];
      const y = this.cushionRestY;
      const border = this.ctx.scene.add
        .rectangle(x, y, CUSHION_W + 2, CUSHION_H + 2, 0x1a0e08, 1)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 6);
      const rect = this.ctx.scene.add
        .rectangle(x, y, CUSHION_W, CUSHION_H, CUSHION_COLOR, 1)
        .setStrokeStyle(2, CUSHION_TRIM, 1)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 7)
        .setInteractive({ useHandCursor: true });
      // Mantenemos `label` en el struct para no romper otros métodos,
      // pero lo dejamos invisible (alpha 0). Sigue moviéndose con el
      // cojín en los tweens — no problema, no se ve.
      const label = this.ctx.scene.add
        .text(x, y, '', {
          fontFamily: FONT_STACK,
          fontSize: '14px',
          color: COLORS.textWhite,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 8)
        .setAlpha(0);

      const cushion: CushionGO = {
        id: i,
        rect,
        border,
        label,
        baseY: y,
        color: CUSHION_COLOR,
      };
      rect.on('pointerdown', () => this.handleCushionClick(cushion.id));
      this.cushions.push(cushion);
    }

    // Etiquetas de SLOT (1/2/3) — FIJAS bajo el suelo, no se mueven con
    // los cojines. Sólo sirven como referencia para el atajo de teclado.
    for (let i = 0; i < 3; i++) {
      const slotLabel = this.ctx.scene.add
        .text(this.slotXs[i], this.cushionRestY + CUSHION_H / 2 + 10, ['1', '2', '3'][i], {
          fontFamily: FONT_STACK,
          fontSize: '8px',
          color: COLORS.gray,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 4);
      // Lo metemos en el slot 0 del array de cushions de forma colateral
      // — pero para no romper la estructura, lo guardamos aparte:
      this.slotLabels.push(slotLabel);
    }

    this.hintText = this.ctx.scene.add
      .text(this.cx, this.cy + this.PH / 2 - 10, 'CLIC en el cojín  ·  1/2/3 también vale  ·  ESC salir', S.hint())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);
  }

  private bindInput(): void {
    this.keyDownHandler = (e: KeyboardEvent) => {
      if (this.finished) return;
      const k = (e.key || '').toUpperCase();
      if (k === 'ESCAPE' || k === 'ESC') {
        e.preventDefault();
        if (this.phase === 'final') {
          this.finishFromFinal();
        } else {
          this.abort();
        }
        return;
      }
      if (this.phase === 'final' && (k === ' ' || k === 'SPACEBAR' || k === 'ENTER')) {
        e.preventDefault();
        this.finishFromFinal();
        return;
      }
      // Atajos numéricos cuando estás en pick.
      if (this.phase === 'pick') {
        if (k === '1') {
          this.handleCushionClickBySlot(0);
        } else if (k === '2') {
          this.handleCushionClickBySlot(1);
        } else if (k === '3') {
          this.handleCushionClickBySlot(2);
        }
      }
    };
    window.addEventListener('keydown', this.keyDownHandler);
    this.ctx.scene.events.once('shutdown', () => this.abort());
    this.ctx.scene.events.once('destroy', () => this.abort());
  }

  // ──────────────────────────────────────────────────────────────────
  // FLOW: rondas
  // ──────────────────────────────────────────────────────────────────

  private beginRound(round: number): void {
    this.currentRound = round;
    this.refreshHud();

    // Reset slots: cojines vuelven al orden visual 0,1,2.
    for (let i = 0; i < 3; i++) {
      this.slotOf[i] = i;
      this.cushionAtSlot[i] = i;
      const c = this.cushions[i];
      c.rect.x = this.slotXs[i];
      c.border.x = this.slotXs[i];
      c.label.x = this.slotXs[i];
      c.rect.y = c.baseY;
      c.border.y = c.baseY;
      c.label.y = c.baseY;
      c.label.setAlpha(1);
    }

    // Día 9e: el ovillo empieza en un cojín RANDOM (no siempre el centro).
    const startSlot = Math.floor(Math.random() * 3);
    this.ballCushionId = this.cushionAtSlot[startSlot];
    this.updateBallPosition();
    this.ball.y = this.cushionRestY + 4;
    this.ball.setAlpha(0); // empieza oculto

    // Setup ronda.
    const cfg = ROUND_CONFIGS[round];
    this.swapDurationMs = cfg.swapDurationMs;
    this.swapsRemaining = cfg.swaps;

    this.phase = 'peek';
    this.setStatus(
      `RONDA ${round + 1}/${ROUNDS_TOTAL}  ·  el ovillo está bajo el cojín ${startSlot + 1}…`,
      COLORS.yellow,
    );
    // Levanta el cojín del slot inicial random para enseñar el ovillo.
    this.peekCushion(startSlot);
  }

  /**
   * Levanta el cojín del slot indicado y muestra el ovillo. Cuando
   * termina, baja el cojín y pasa a fase shuffle.
   */
  private peekCushion(slot: number): void {
    const cushionId = this.cushionAtSlot[slot];
    const cushion = this.cushions[cushionId];
    const liftY = cushion.baseY - CUSHION_H - 2;

    // Sube el cojín.
    this.ctx.scene.tweens.add({
      targets: [cushion.rect, cushion.border, cushion.label],
      y: liftY,
      duration: 280,
      ease: 'Cubic.easeOut',
    });
    // Fade in del ovillo.
    this.ctx.scene.tweens.add({
      targets: this.ball,
      alpha: 1,
      duration: 200,
      ease: 'Cubic.easeOut',
    });
    // Después del PEEK_DURATION, baja el cojín y oculta ovillo.
    this.ctx.scene.time.delayedCall(PEEK_DURATION_MS, () => {
      if (this.finished || this.phase !== 'peek') return;
      this.ctx.scene.tweens.add({
        targets: [cushion.rect, cushion.border, cushion.label],
        y: cushion.baseY,
        duration: 220,
        ease: 'Cubic.easeIn',
      });
      this.ctx.scene.tweens.add({
        targets: this.ball,
        alpha: 0,
        duration: 180,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          if (this.finished) return;
          this.startCountdown();
        },
      });
    });
  }

  /**
   * Día 9e: countdown 3..2..1 antes del shuffle. Cojines vibran sutil
   * en cada tick (build-up de tensión).
   */
  private startCountdown(): void {
    if (this.finished) return;
    this.phase = 'countdown';
    let n = 3;
    const tick = () => {
      if (this.finished || this.phase !== 'countdown') return;
      this.setStatus(`${n}…`, COLORS.yellow);
      // Vibración corta en los cojines.
      for (const c of this.cushions) {
        if (!c.rect.scene) continue;
        const baseX = this.slotXs[this.slotOf[c.id]];
        this.ctx.scene.tweens.add({
          targets: [c.rect, c.border, c.label],
          x: { from: baseX - 1, to: baseX + 1 },
          duration: 80,
          repeat: 2,
          yoyo: true,
          onComplete: () => {
            if (!c.rect.scene) return;
            c.rect.x = baseX;
            c.border.x = baseX;
            c.label.x = baseX;
          },
        });
      }
      n -= 1;
      if (n > 0) {
        this.ctx.scene.time.delayedCall(COUNTDOWN_TICK_MS, tick);
      } else {
        this.ctx.scene.time.delayedCall(COUNTDOWN_TICK_MS, () => {
          if (this.finished || this.phase !== 'countdown') return;
          this.startShuffle();
        });
      }
    };
    tick();
  }

  private startShuffle(): void {
    if (this.finished) return;
    this.phase = 'shuffle';
    this.setStatus('… los cojines bailan …', COLORS.yellow);
    this.scheduleNextSwap();
  }

  private scheduleNextSwap(): void {
    if (this.finished) return;
    if (this.swapsRemaining <= 0) {
      this.endShuffle();
      return;
    }
    this.swapsRemaining -= 1;
    this.executeSwap();
  }

  /**
   * Ejecuta UN swap: elige 2 slots adyacentes random (de los 2 pares
   * posibles 0-1 y 1-2; o elige 0-2 ocasionalmente para spice). Anima
   * los dos cojines intercambiando posiciones en arco. Cuando ambos
   * tweens terminan, llama scheduleNextSwap.
   */
  private executeSwap(): void {
    // 70% adyacente, 30% extremos (más confuso).
    const r = Math.random();
    let slotA: number;
    let slotB: number;
    if (r < 0.7) {
      // Par adyacente: 0-1 o 1-2.
      slotA = Math.random() < 0.5 ? 0 : 1;
      slotB = slotA + 1;
    } else {
      // Extremos.
      slotA = 0;
      slotB = 2;
    }

    const cushionA = this.cushions[this.cushionAtSlot[slotA]];
    const cushionB = this.cushions[this.cushionAtSlot[slotB]];
    const xA = this.slotXs[slotA];
    const xB = this.slotXs[slotB];
    const archHeight = 22;

    // Actualiza el tracking lógico ANTES de animar (los siguientes swaps
    // ya consideran la nueva posición).
    const idA = cushionA.id;
    const idB = cushionB.id;
    this.cushionAtSlot[slotA] = idB;
    this.cushionAtSlot[slotB] = idA;
    this.slotOf[idA] = slotB;
    this.slotOf[idB] = slotA;

    this.pendingTweens = 2;
    const onSwapPartDone = () => {
      this.pendingTweens -= 1;
      if (this.pendingTweens === 0) {
        // Mantener ovillo siguiendo a su cojín (invisible).
        this.updateBallPosition();
        this.ctx.scene.time.delayedCall(60, () => this.scheduleNextSwap());
      }
    };

    // A va por encima (yoyo arc up), B por debajo (yoyo arc down).
    this.tweenArc(cushionA, xA, xB, -archHeight, this.swapDurationMs, onSwapPartDone);
    this.tweenArc(cushionB, xB, xA, +archHeight, this.swapDurationMs, onSwapPartDone);
  }

  /**
   * Tween de un cojín de fromX a toX con un arco vertical (yoyo de
   * archDelta). Ojo: no usamos un yoyo nativo de Phaser porque el yoyo
   * vuelve al inicio; aquí vamos a una posición DISTINTA.
   * En su lugar, usamos un timeline manual: sube primero, baja después,
   * pero ambos en x interpolan de fromX a toX.
   */
  private tweenArc(
    cushion: CushionGO,
    fromX: number,
    toX: number,
    archDelta: number,
    durationMs: number,
    onComplete: () => void,
  ): void {
    const targets = [cushion.rect, cushion.border, cushion.label];
    const baseY = cushion.baseY;
    const halfDur = durationMs / 2;

    // Fase 1: 0 → mid (x se mueve la mitad, y se desplaza al pico).
    this.ctx.scene.tweens.add({
      targets,
      x: (fromX + toX) / 2,
      y: baseY + archDelta,
      duration: halfDur,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        // Fase 2: mid → end (x acaba, y vuelve a baseY).
        this.ctx.scene.tweens.add({
          targets,
          x: toX,
          y: baseY,
          duration: halfDur,
          ease: 'Cubic.easeIn',
          onComplete,
        });
      },
    });
  }

  /** Coloca el ovillo bajo el cojín que actualmente lo cubre. */
  private updateBallPosition(): void {
    const slot = this.slotOf[this.ballCushionId];
    this.ball.x = this.slotXs[slot];
    // Mantenemos y constante (siempre debajo del cojín en posición
    // "rest"), no sigue al cojín en su arco — el ovillo está "anclado"
    // a la mesa. Visualmente esto se ve correcto porque el ball está
    // alpha=0 durante shuffle.
    this.ball.y = this.cushionRestY + 4;
  }

  private endShuffle(): void {
    if (this.finished) return;
    this.phase = 'pick';
    this.setStatus('¿dónde está el ovillo?', COLORS.yellow);
  }

  // ──────────────────────────────────────────────────────────────────
  // PICK + REVEAL
  // ──────────────────────────────────────────────────────────────────

  private handleCushionClick(cushionId: number): void {
    if (this.phase !== 'pick' || this.finished) return;
    const slot = this.slotOf[cushionId];
    this.handleCushionClickBySlot(slot);
  }

  private handleCushionClickBySlot(slot: number): void {
    if (this.phase !== 'pick' || this.finished) return;
    const pickedCushionId = this.cushionAtSlot[slot];
    const correct = pickedCushionId === this.ballCushionId;
    this.phase = 'reveal';
    this.revealRound(slot, correct);
  }

  private revealRound(pickedSlot: number, correct: boolean): void {
    const pickedCushionId = this.cushionAtSlot[pickedSlot];
    const ballSlot = this.slotOf[this.ballCushionId];
    const ballCushion = this.cushions[this.ballCushionId];

    // Sube el cojín elegido. Si no era el correcto, también sube el del ovillo.
    const liftPicked = () => {
      const pc = this.cushions[pickedCushionId];
      this.ctx.scene.tweens.add({
        targets: [pc.rect, pc.border, pc.label],
        y: pc.baseY - CUSHION_H - 2,
        duration: 250,
        ease: 'Cubic.easeOut',
      });
    };
    const liftBallCushion = () => {
      this.ctx.scene.tweens.add({
        targets: [ballCushion.rect, ballCushion.border, ballCushion.label],
        y: ballCushion.baseY - CUSHION_H - 2,
        duration: 250,
        ease: 'Cubic.easeOut',
      });
    };

    // Posicionar ball en el slot que SÍ tiene el ovillo, hacerlo visible.
    this.ball.x = this.slotXs[ballSlot];
    this.ball.alpha = 1;

    liftPicked();
    if (!correct) {
      // Tras 300ms, también levantamos el cojín correcto (revelación).
      this.ctx.scene.time.delayedCall(350, () => liftBallCushion());
      this.setStatus('¡fallaste! estaba en el ' + (ballSlot + 1), COLORS.error);
      this.ctx.scene.cameras.main.shake(220, 0.005);
    } else {
      this.wins += 1;
      this.refreshHud();
      this.setStatus('¡ahí estaba!', COLORS.success);
      // Pequeño bounce del ovillo.
      this.ctx.scene.tweens.add({
        targets: this.ball,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 220,
        yoyo: true,
        ease: 'Cubic.easeOut',
      });
    }

    this.ctx.scene.time.delayedCall(REVEAL_DURATION_MS, () => {
      if (this.finished) return;
      this.ball.alpha = 0;
      this.ball.setScale(1);
      // Siguiente ronda o final.
      if (this.currentRound + 1 >= ROUNDS_TOTAL) {
        this.beginFinalPhase();
      } else {
        this.beginRound(this.currentRound + 1);
      }
    });
  }

  private beginFinalPhase(): void {
    this.phase = 'final';
    const success = this.wins >= ROUNDS_TO_WIN;
    if (success) {
      this.setStatus(
        `¡${this.wins}/${ROUNDS_TOTAL}!  Kero asiente.  SPACE para cerrar`,
        COLORS.success,
      );
    } else {
      this.setStatus(
        `${this.wins}/${ROUNDS_TOTAL}.  Kero parpadea, decepcionado.  SPACE para cerrar`,
        COLORS.error,
      );
    }
    this.lastResultWin = success;
  }

  private lastResultWin = false;

  private finishFromFinal(): void {
    this.finish(this.lastResultWin, this.lastResultWin ? 'completed' : 'failed');
  }

  // ──────────────────────────────────────────────────────────────────
  // TICK + UTILS
  // ──────────────────────────────────────────────────────────────────

  private tick(): void {
    // Nada por ahora — toda la lógica es event-driven.
  }

  private setStatus(msg: string, color: string): void {
    if (!this.statusText.scene) return;
    this.statusText.setText(msg);
    this.statusText.setColor(color);
  }

  private refreshHud(): void {
    if (this.hudRound.scene) {
      this.hudRound.setText('ronda ' + (this.currentRound + 1) + '/' + ROUNDS_TOTAL);
    }
    if (this.hudScore.scene) {
      this.hudScore.setText('aciertos ' + this.wins + '/' + ROUNDS_TO_WIN);
    }
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
    [
      this.dim,
      this.bg,
      this.panelBorder,
      this.panelBg,
      this.titleText,
      this.statusText,
      this.hudRound,
      this.hudScore,
      this.hintText,
      this.ball,
    ].forEach((o) => o?.destroy());
    for (const c of this.cushions) {
      c.rect.destroy();
      c.border.destroy();
      c.label.destroy();
    }
    this.cushions = [];
    for (const sl of this.slotLabels) sl.destroy();
    this.slotLabels = [];
  }
}
