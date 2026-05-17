import * as Phaser from 'phaser';
import type { MinigameContext, MinigameResult, MinigameRunner } from '../types';
import { showMinigameIntro } from '../_shared/MinigameIntroPanel';
import { Sfx } from '../../systems/SfxBank';

/**
 * PUERTA ATASCADA — terraza.  REWORK v2 (más profundidad).
 *
 * Cambios respecto a v1:
 *   - ZONA VERDE SE MUEVE entre tirones (no centrada siempre). Tras
 *     cada acierto/fallo, se reposiciona aleatoriamente dentro de un
 *     rango razonable. Te obliga a leer dónde está antes de tirar.
 *   - SPEED del cursor SUBE con cada acierto (no sólo con cada fallo).
 *     A más progreso, más urgencia.
 *   - BACKSLIDE: si fallas, pierdes 1 de los aciertos acumulados (no
 *     resetea a 0). Da sensación de "casi lo tenía".
 *   - Texto narrativo del estado de la puerta:
 *       0/3 → "rígida"
 *       1/3 → "cediendo"
 *       2/3 → "casi"
 *       3/3 → "¡SE ABRE!"
 *   - IntroPanel antes de empezar.
 *
 * Diegética (panel pequeño arriba, no cubre la escena).
 *
 * ESC para abortar.
 */

const PANEL_DEPTH = 1700;
const TARGET_TIRONES = 3;
const BAR_WIDTH = 130;
const BAR_HEIGHT = 12;
const TARGET_ZONE_WIDTH = 22;
const INITIAL_SPEED = 0.85; // ratio (0..1) por segundo del cursor
const SPEED_INCREMENT_HIT = 0.22;
const SPEED_INCREMENT_MISS = 0.18;
const MAX_SPEED = 2.6;
const ZONE_MIN_RATIO = 0.18; // posición mínima de la zona dentro de la barra (0 izq, 1 der)
const ZONE_MAX_RATIO = 0.82;

const DOOR_STATE_LABELS = ['rígida', 'cediendo', 'casi', '¡SE ABRE!'];

export const runStuckDoorMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>(async (resolve) => {
    const ok = await showMinigameIntro(ctx.scene, {
      title: 'PUERTA ATASCADA — TERRAZA',
      description:
        'La puerta lleva años sin abrirse.\nTira con timing: pulsa SPACE cuando el cursor esté en la zona verde.\n3 tirones consecutivos para abrir.',
      controls: 'SPACE: tirar  ·  ESC: salir',
    });
    if (!ok) return resolve({ success: false, reason: 'aborted' });
    new StuckDoorGame(ctx, resolve).start();
  });
};

class StuckDoorGame {
  private ctx: MinigameContext;
  private resolveOuter: (r: MinigameResult) => void;

  // Estado.
  private cursor = 0; // 0..1 posición del cursor en la barra
  private dir = 1;
  private speed = INITIAL_SPEED;
  private tirones = 0;
  private finished = false;
  private cooldownUntil = 0;
  private zoneCenterRatio = 0.5; // posición del centro de la zona verde (0..1)

  // Input.
  private keySpace?: Phaser.Input.Keyboard.Key;
  private keyEsc?: Phaser.Input.Keyboard.Key;

  // Visuales.
  private panelBg!: Phaser.GameObjects.Rectangle;
  private panelBorder!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private barBg!: Phaser.GameObjects.Rectangle;
  private barTargetZone!: Phaser.GameObjects.Rectangle;
  private barCursor!: Phaser.GameObjects.Rectangle;
  private tironeContainer!: Phaser.GameObjects.Container;
  private tironeMarks: Phaser.GameObjects.Rectangle[] = [];
  private hintText!: Phaser.GameObjects.Text;
  private doorStateText!: Phaser.GameObjects.Text;

  // Refs de centro del panel.
  private panelCx = 0;
  private panelCy = 0;

  private onUpdate?: (time: number, delta: number) => void;

  constructor(ctx: MinigameContext, resolve: (r: MinigameResult) => void) {
    this.ctx = ctx;
    this.resolveOuter = resolve;
  }

  start(): void {
    this.buildUi();
    this.bindInput();
    this.relocateZone();
    this.refreshDoorState();
    this.onUpdate = (_time, delta) => this.tick(delta);
    this.ctx.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
  }

  // ──────────────────────────────────────────────────────────────────────
  // UI
  // ──────────────────────────────────────────────────────────────────────

  private buildUi(): void {
    const cam = this.ctx.scene.cameras.main;
    const PW = 170;
    const PH = 72;
    const cx = cam.width / 2;
    const cy = 40;
    this.panelCx = cx;
    this.panelCy = cy;

    this.panelBorder = this.ctx.scene.add
      .rectangle(cx, cy, PW + 2, PH + 2, 0xfbbf24, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH);
    this.panelBg = this.ctx.scene.add
      .rectangle(cx, cy, PW, PH, 0x1a0e08, 0.92)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);

    this.titleText = this.ctx.scene.add
      .text(cx, cy - PH / 2 + 7, 'PUERTA ATASCADA — tira con timing', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);

    // Estado narrativo de la puerta.
    this.doorStateText = this.ctx.scene.add
      .text(cx, cy - PH / 2 + 18, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#c08a4f',
        fontStyle: 'italic',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);

    // Barra base.
    const barY = cy + 4;
    this.barBg = this.ctx.scene.add
      .rectangle(cx, barY, BAR_WIDTH, BAR_HEIGHT, 0x3a2618, 1)
      .setStrokeStyle(1, 0x6b4425, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);

    // Zona objetivo (verde).
    this.barTargetZone = this.ctx.scene.add
      .rectangle(cx, barY, TARGET_ZONE_WIDTH, BAR_HEIGHT - 2, 0x4ade80, 0.55)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Cursor.
    this.barCursor = this.ctx.scene.add
      .rectangle(cx - BAR_WIDTH / 2, barY, 3, BAR_HEIGHT - 2, 0xfbbf24, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);

    // Marcas tirones.
    this.tironeContainer = this.ctx.scene.add
      .container(cx, cy + PH / 2 - 8)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);
    const marksTotalW = TARGET_TIRONES * 7 + (TARGET_TIRONES - 1) * 3;
    for (let i = 0; i < TARGET_TIRONES; i++) {
      const mx = -marksTotalW / 2 + i * 10 + 3.5;
      const m = this.ctx.scene.add
        .rectangle(mx, 0, 7, 5, 0x3a2618, 1)
        .setStrokeStyle(1, 0x6b4425, 1);
      this.tironeContainer.add(m);
      this.tironeMarks.push(m);
    }

    this.hintText = this.ctx.scene.add
      .text(cx, cy + PH / 2 + 4, 'SPACE: tirar  ·  ESC: salir', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '5px',
        color: '#9ca3af',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);
  }

  private bindInput(): void {
    const kb = this.ctx.scene.input.keyboard;
    if (!kb) return;
    this.keySpace = kb.addKey('SPACE');
    this.keyEsc = kb.addKey('ESC');

    this.keySpace.on('down', () => this.tryTiron());
    this.keyEsc.on('down', () => this.abort());
  }

  // ──────────────────────────────────────────────────────────────────────
  // TICK
  // ──────────────────────────────────────────────────────────────────────

  private tick(delta: number): void {
    if (this.finished) return;

    this.cursor += this.dir * (this.speed * delta) / 1000;
    if (this.cursor >= 1) {
      this.cursor = 1;
      this.dir = -1;
    } else if (this.cursor <= 0) {
      this.cursor = 0;
      this.dir = 1;
    }

    const xLeft = this.panelCx - BAR_WIDTH / 2;
    this.barCursor.x = xLeft + this.cursor * BAR_WIDTH;
  }

  // ──────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ──────────────────────────────────────────────────────────────────────

  private tryTiron(): void {
    if (this.finished) return;
    const now = this.ctx.scene.time.now;
    if (now < this.cooldownUntil) return;
    this.cooldownUntil = now + 220;

    const cursorPx = this.cursor * BAR_WIDTH;
    const zoneCenterPx = this.zoneCenterRatio * BAR_WIDTH;
    const inZone = Math.abs(cursorPx - zoneCenterPx) <= TARGET_ZONE_WIDTH / 2;

    if (inZone) {
      this.tirones += 1;
      this.markTirone(this.tirones - 1, true);
      this.spawnPulse(true);
      this.refreshDoorState();
      // Acierto: zona se mueve y cursor acelera un poco.
      this.relocateZone();
      this.speed = Math.min(MAX_SPEED, this.speed + SPEED_INCREMENT_HIT);
      if (this.tirones >= TARGET_TIRONES) {
        this.spawnKchack();
        this.ctx.scene.time.delayedCall(450, () => this.finish(true));
      }
    } else {
      // Fallo: backslide (-1 en aciertos, mínimo 0).
      if (this.tirones > 0) {
        this.tirones -= 1;
        this.markTirone(this.tirones, false); // pinta el siguiente que perdiste
      }
      this.spawnPulse(false);
      this.refreshDoorState();
      // Zona se mueve y cursor acelera más fuerte.
      this.relocateZone();
      this.speed = Math.min(MAX_SPEED, this.speed + SPEED_INCREMENT_MISS);
    }
  }

  private relocateZone(): void {
    const ratio = ZONE_MIN_RATIO + Math.random() * (ZONE_MAX_RATIO - ZONE_MIN_RATIO);
    this.zoneCenterRatio = ratio;
    const xLeft = this.panelCx - BAR_WIDTH / 2;
    this.barTargetZone.x = xLeft + ratio * BAR_WIDTH;
  }

  private markTirone(idx: number, success: boolean): void {
    const m = this.tironeMarks[idx];
    if (!m) return;
    if (success) {
      m.setFillStyle(0x4ade80, 1);
      this.ctx.scene.tweens.add({
        targets: m,
        scaleX: 1.4,
        scaleY: 1.4,
        duration: 120,
        yoyo: true,
      });
    } else {
      // Backslide: tirone perdido vuelve a marrón.
      m.setFillStyle(0x3a2618, 1);
      this.ctx.scene.tweens.add({
        targets: m,
        scaleX: 0.7,
        scaleY: 0.7,
        duration: 120,
        yoyo: true,
      });
    }
  }

  private refreshDoorState(): void {
    if (!this.doorStateText.scene) return;
    const idx = Math.min(this.tirones, DOOR_STATE_LABELS.length - 1);
    this.doorStateText.setText('puerta: ' + DOOR_STATE_LABELS[idx]);
    if (this.tirones >= 3) this.doorStateText.setColor('#4ade80');
    else if (this.tirones === 2) this.doorStateText.setColor('#fbbf24');
    else this.doorStateText.setColor('#c08a4f');
  }

  private spawnPulse(success: boolean): void {
    const txt = success ? '*GLAC*' : '...';
    const t = this.ctx.scene.add
      .text(this.panelCx, this.panelCy + 22, txt, {
        fontFamily: "'Silkscreen', monospace",
        fontSize: success ? '8px' : '7px',
        color: success ? '#4ade80' : '#9ca3af',
        fontStyle: success ? 'bold' : 'normal',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 5);
    this.ctx.scene.tweens.add({
      targets: t,
      alpha: 0,
      y: t.y + 5,
      duration: 380,
      onComplete: () => t.destroy(),
    });

    if (!success) {
      this.ctx.scene.cameras.main.shake(80, 0.002);
    }
  }

  private spawnKchack(): void {
    const cam = this.ctx.scene.cameras.main;
    const t = this.ctx.scene.add
      .text(cam.width / 2, cam.height / 2, 'KCHACK', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '14px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);
    this.ctx.scene.tweens.add({
      targets: t,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
    this.ctx.scene.cameras.main.shake(120, 0.005);
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
    this.keySpace?.removeAllListeners();
    this.keyEsc?.removeAllListeners();
    // OJO: NO removeKey() — Phaser reusa Keys con la apartment scene.

    [
      this.panelBg,
      this.panelBorder,
      this.titleText,
      this.doorStateText,
      this.barBg,
      this.barTargetZone,
      this.barCursor,
      this.tironeContainer,
      this.hintText,
    ].forEach((o) => o?.destroy());
  }
}
