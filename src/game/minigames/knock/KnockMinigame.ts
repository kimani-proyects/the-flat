import * as Phaser from 'phaser';
import type { MinigameContext, MinigameResult, MinigameRunner, LockedWallDef } from '../types';
import { showMinigameIntro } from '../_shared/MinigameIntroPanel';
import { Sfx } from '../../systems/SfxBank';

/**
 * TOC-TOC — minijuego del baño.
 *
 * El juego "suena" un patrón de toques (visualmente: dots que se iluminan
 * en secuencia sobre la puerta — F a la izq, J a la der). María lo replica
 * pulsando F (nudillo izq) y J (nudillo der) en el mismo orden y ritmo.
 *
 * 3 niveles:
 *   1) Shave-and-a-haircut clásico (5 toques).
 *   2) 9 toques con un silencio intermedio (timing).
 *   3) 13 toques con un contratiempo (off-beat al final).
 *
 * Tolerancia decrecente. 3 intentos por nivel. Fallo definitivo → restart
 * desde nivel 1. Esc para abortar.
 *
 * Diegético: NO cubre la pantalla. Pequeño panel flotante anclado al
 * viewport (esquina superior, no tapa al personaje) + indicadores de
 * F/J abajo. Sigues "viendo" el piso.
 */

type Knuckle = 'F' | 'J';
type KnockEvent = { k: Knuckle; t: number }; // t en ms desde el inicio del patrón

const PATTERNS: KnockEvent[][] = [
  // 1) Shave-and-a-haircut: F-F-J · F · J  (5 toques)
  [
    { k: 'F', t: 0 },
    { k: 'F', t: 250 },
    { k: 'J', t: 500 },
    { k: 'F', t: 1100 },
    { k: 'J', t: 1500 },
  ],
  // 2) 9 toques con silencio intermedio
  [
    { k: 'F', t: 0 },
    { k: 'J', t: 220 },
    { k: 'F', t: 440 },
    { k: 'J', t: 660 },
    // pausa larga aquí (1100 ms en lugar de 220)
    { k: 'F', t: 1760 },
    { k: 'F', t: 1980 },
    { k: 'J', t: 2200 },
    { k: 'F', t: 2420 },
    { k: 'J', t: 2640 },
  ],
  // 3) 7 toques con orden no obvio (S2.14: simplificado, era 13)
  [
    { k: 'J', t: 0 },
    { k: 'F', t: 250 },
    { k: 'F', t: 500 },
    { k: 'J', t: 800 },
    { k: 'F', t: 1050 },
    { k: 'J', t: 1300 },
    { k: 'J', t: 1550 },
  ],
];

// TOLERANCE eliminada — el knock ahora es sólo secuencia, sin timing.
const ATTEMPTS_PER_LEVEL = 3;

const PANEL_DEPTH = 1700;

export const runKnockMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>(async (resolve) => {
    const ok = await showMinigameIntro(ctx.scene, {
      title: 'TOC-TOC — BAÑO',
      description:
        'Escucha el patrón de toques y replícalo.\nF = nudillo izquierdo, J = nudillo derecho.\n3 patrones de dificultad creciente.',
      controls: 'F · J · ESC para salir',
    });
    if (!ok) return resolve({ success: false, reason: 'aborted' });
    new KnockGame(ctx, resolve).start();
  });
};

class KnockGame {
  private ctx: MinigameContext;
  private resolve: (r: MinigameResult) => void;
  private scene: Phaser.Scene;

  // UI: pequeño panel arriba-derecha. NO cubre la escena.
  private panel!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  // 2 columnas (F | J) con dots que se iluminan al ritmo del patrón.
  private leftDots: Phaser.GameObjects.Arc[] = [];
  private rightDots: Phaser.GameObjects.Arc[] = [];
  private dotsContainer!: Phaser.GameObjects.Rectangle;
  // Hint de teclas abajo del panel.
  private inputHintF!: Phaser.GameObjects.Text;
  private inputHintJ!: Phaser.GameObjects.Text;
  // Labels F/J encima de las columnas de dots + el "ESC = salir" inferior.
  // Se trackean explícitamente porque el cleanup tiene que destruirlos —
  // si no, quedan flotando en el viewport tras cerrar el panel.
  private columnLabelF!: Phaser.GameObjects.Text;
  private columnLabelJ!: Phaser.GameObjects.Text;
  private escHintLabel!: Phaser.GameObjects.Text;

  // Estado.
  private level = 0;
  private attemptsLeft = ATTEMPTS_PER_LEVEL;
  private playingDemo = false;
  private listening = false;
  private fCount = 0;
  private jCount = 0;
  private playerEvents: KnockEvent[] = [];
  private playerStartedAt = 0;
  private destroyed = false;

  // Keys.
  private keyF!: Phaser.Input.Keyboard.Key;
  private keyJ!: Phaser.Input.Keyboard.Key;
  private esc!: Phaser.Input.Keyboard.Key;

  constructor(ctx: MinigameContext, resolve: (r: MinigameResult) => void) {
    this.ctx = ctx;
    this.resolve = resolve;
    this.scene = ctx.scene;
  }

  start(): void {
    this.buildUi();
    this.bindKeys();
    this.startLevel(0);
  }

  private buildUi(): void {
    const cam = this.scene.cameras.main;
    const w = cam.width;
    // Panel arriba-centro, no muy grande (160×100). Anclado al viewport.
    const panelW = 170;
    const panelH = 110;
    const px = w / 2;
    const py = 12 + panelH / 2;

    this.panel = this.scene.add
      .rectangle(px, py, panelW, panelH, 0x0b0c10, 0.9)
      .setStrokeStyle(2, 0x5eead4, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH);

    this.title = this.scene.add
      .text(px, py - panelH / 2 + 6, 'TOC-TOC', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#5eead4',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);

    this.subtitle = this.scene.add
      .text(px, py - panelH / 2 + 20, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#9ca3af',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);

    this.status = this.scene.add
      .text(px, py + 6, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);

    // Bg para los dots (visual minimal — solo dos columnas).
    this.dotsContainer = this.scene.add
      .rectangle(px, py + 30, 100, 24, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);

    // Cada lado tiene 7 dots horizontales que se iluminan en orden de toque.
    const dotY = py + 30;
    for (let i = 0; i < 7; i++) {
      const offset = (i - 3) * 6;
      const lf = this.scene.add
        .circle(px - 26 + offset * 0, dotY, 2, 0x1a0e08, 1)
        .setStrokeStyle(1, 0x5eead4, 0.6)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 2);
      // los repartimos a la izquierda en horizontal
      lf.x = px - 50 + i * 6;
      this.leftDots.push(lf);

      const rj = this.scene.add
        .circle(px + 8 + i * 6, dotY, 2, 0x1a0e08, 1)
        .setStrokeStyle(1, 0xff5c8a, 0.6)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 2);
      this.rightDots.push(rj);
    }

    // Etiquetas F y J en cada columna. OJO: hay que GUARDAR la referencia
    // para destruirlas en cleanup. Si no, quedan flotando en pantalla tras
    // ESC (bug encontrado en iteración 3).
    this.columnLabelF = this.scene.add
      .text(px - 56, dotY, 'F', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#5eead4',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);
    this.columnLabelJ = this.scene.add
      .text(px + 56, dotY, 'J', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#ff5c8a',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);

    this.inputHintF = this.scene.add
      .text(px - 50, py + panelH / 2 - 6, 'F = nudillo izq', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#6b7280',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.inputHintJ = this.scene.add
      .text(px + 50, py + panelH / 2 - 6, 'J = nudillo der', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#6b7280',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);

    this.escHintLabel = this.scene.add
      .text(px, py + panelH / 2 + 4, 'ESC = salir', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#6b7280',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
  }

  private bindKeys(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keyF = kb.addKey(K.F, true, false);
    this.keyJ = kb.addKey(K.J, true, false);
    this.esc = kb.addKey(K.ESC);
    this.keyF.on('down', () => this.onKnock('F'));
    this.keyJ.on('down', () => this.onKnock('J'));
    this.esc.on('down', () => this.abort());
  }

  private startLevel(idx: number): void {
    this.level = idx;
    this.attemptsLeft = ATTEMPTS_PER_LEVEL;
    this.subtitle.setText(`Nivel ${idx + 1}/3 — escucha y replica`);
    this.startAttempt();
  }

  private startAttempt(): void {
    this.playerEvents = [];
    this.listening = false;
    this.status.setText('escuchando…');
    this.status.setColor('#fbbf24');
    this.playDemoPattern();
  }

  private async playDemoPattern(): Promise<void> {
    this.playingDemo = true;
    const pattern = PATTERNS[this.level];
    // Apaga dots primero + resetea contadores por knuckle.
    this.resetDotColors();
    this.fCount = 0;
    this.jCount = 0;

    // Programa cada knock: visual flash en su columna + tiny scale tween.
    for (let i = 0; i < pattern.length; i++) {
      const ev = pattern[i];
      this.scene.time.delayedCall(ev.t + 200, () => {
        if (this.destroyed) return;
        this.flashDot(ev.k, i, false);
      });
    }
    // Al terminar la demo, comienza la fase de listening.
    const total = pattern[pattern.length - 1].t + 600;
    this.scene.time.delayedCall(total + 300, () => {
      if (this.destroyed) return;
      this.playingDemo = false;
      this.beginListening();
    });
  }

  private beginListening(): void {
    this.resetDotColors();
    this.listening = true;
    this.playerStartedAt = 0;
    // S2.14: limpieza explícita por si quedó basura de intento anterior.
    this.playerEvents = [];
    this.fCount = 0;
    this.jCount = 0;
    this.status.setText(`tu turno (${this.attemptsLeft} intentos)`);
    this.status.setColor('#5eead4');
  }

  private onKnock(k: Knuckle): void {
    if (!this.listening || this.playingDemo) return;
    const now = this.scene.time.now;
    if (this.playerStartedAt === 0) this.playerStartedAt = now;
    const t = now - this.playerStartedAt;
    this.playerEvents.push({ k, t });
    const idx = this.playerEvents.length - 1;
    this.flashDot(k, idx, true);

    // Si ya tenemos tantos eventos como el patrón, evaluamos.
    const expected = PATTERNS[this.level];
    if (this.playerEvents.length >= expected.length) {
      this.listening = false;
      this.scene.time.delayedCall(150, () => this.evaluate());
    }
  }

  private flashDot(k: Knuckle, _globalSlot: number, isPlayer: boolean): void {
    const dots = k === 'F' ? this.leftDots : this.rightDots;
    // S2.14.2: slot POR knuckle — F va 0,1,2... y J va 0,1,2... independientes.
    // Antes era índice global; un nivel con 9 toques superaba los 7 dots.
    const counter = k === 'F' ? this.fCount : this.jCount;
    if (counter >= dots.length) return;
    const dot = dots[counter];
    if (k === 'F') this.fCount++;
    else this.jCount++;
    if (!dot) return;
    Sfx.knock(k === 'F' ? 'L' : 'R');
    const color = isPlayer ? (k === 'F' ? 0x5eead4 : 0xff5c8a) : 0xfbbf24;
    dot.setFillStyle(color, 1);
    this.scene.tweens.add({
      targets: dot,
      scale: { from: 1.6, to: 1 },
      duration: 220,
      ease: 'Cubic.easeOut',
    });
  }

  private resetDotColors(): void {
    for (const d of this.leftDots) {
      d.setFillStyle(0x1a0e08, 1).setScale(1);
    }
    for (const d of this.rightDots) {
      d.setFillStyle(0x1a0e08, 1).setScale(1);
    }
  }

  private evaluate(): void {
    const expected = PATTERNS[this.level];
    const player = this.playerEvents;
    // S2.14 SIMPLE: sólo importa la SECUENCIA (L/R, L/R, ...) — sin
    // timing. Si coincide longitud + orden de F/J → pass. No hay
    // tempos, no hay tolerancias. María sólo tiene que imitar QUÉ tecla
    // se pulsa y en qué orden.
    if (player.length !== expected.length) {
      return this.attemptFailed();
    }
    for (let i = 0; i < expected.length; i++) {
      if (player[i].k !== expected[i].k) return this.attemptFailed();
    }
    this.attemptPassed();
  }

  private attemptFailed(): void {
    this.attemptsLeft--;
    this.status.setText('“está ocupado.”');
    this.status.setColor('#ff5c8a');
    if (this.attemptsLeft <= 0) {
      // Restart desde nivel 1.
      this.scene.time.delayedCall(900, () => {
        if (this.destroyed) return;
        this.startLevel(0);
      });
      return;
    }
    this.scene.time.delayedCall(900, () => {
      if (this.destroyed) return;
      this.startAttempt();
    });
  }

  private attemptPassed(): void {
    this.status.setText('¡correcto!');
    this.status.setColor('#5eead4');
    if (this.level + 1 >= PATTERNS.length) {
      this.scene.time.delayedCall(700, () => {
        if (this.destroyed) return;
        this.cleanup();
        this.resolve({ success: true, reason: 'completed' });
      });
    } else {
      this.scene.time.delayedCall(700, () => {
        if (this.destroyed) return;
        this.startLevel(this.level + 1);
      });
    }
  }

  private abort(): void {
    if (this.destroyed) return;
    this.cleanup();
    this.resolve({ success: false, reason: 'aborted' });
  }

  private cleanup(): void {
    this.destroyed = true;
    this.panel.destroy();
    this.title.destroy();
    this.subtitle.destroy();
    this.status.destroy();
    this.dotsContainer.destroy();
    for (const d of this.leftDots) d.destroy();
    for (const d of this.rightDots) d.destroy();
    this.inputHintF.destroy();
    this.inputHintJ.destroy();
    // Etiquetas de columna F/J + hint ESC — antes leakeaban en pantalla.
    this.columnLabelF?.destroy();
    this.columnLabelJ?.destroy();
    this.escHintLabel?.destroy();
    this.keyF.removeAllListeners();
    this.keyJ.removeAllListeners();
    this.esc.removeAllListeners();
    // OJO: NO removeKey() — Phaser reusa la misma Key para F/J/ESC en otras
    // partes de la escena; quitarla aquí podría romper input futuro.
  }
}

// Re-export del tipo del def por conveniencia (evita un import nuevo).
export type { LockedWallDef };
