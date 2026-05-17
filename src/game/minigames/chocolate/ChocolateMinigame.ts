import * as Phaser from 'phaser';
import type { MinigameContext, MinigameResult, MinigameRunner } from '../types';
import { showMinigameIntro } from '../_shared/MinigameIntroPanel';
import { Sfx } from '../../systems/SfxBank';

/**
 * CHOCOLATE — minijuego de la habitación de María.  REWORK v4 (bailongo).
 *
 * Cambios respecto a v3:
 *   - Quitados los marcadores ✓/▶ delante de cada sílaba.
 *   - La canción ahora son Texts INDIVIDUALES por sílaba en grid (uno
 *     por palabra) → cada sílaba puede animarse por su cuenta.
 *   - ACIERTO: la sílaba pasa a VERDE permanente y se enciende su
 *     "BAILONGO": un sway sinusoidal sutil de y-offset que se aplica a
 *     TODAS las sílabas verdes acumuladas (con pequeño stagger por
 *     vecino → efecto wave/coral). Sensación de flow state.
 *   - FALLO: la sílaba esperada se pone ROJA + SHAKE DURO (~280ms),
 *     después se cierra el minijuego.
 *   - IntroPanel antes de empezar (sin spoilers de mecánica).
 *
 * El resto se mantiene de v3:
 *   - Patrón fijo (siempre el mismo).
 *   - Mapeo CHOCO=A+L · LA=S+K · TE=D+J · CHO=A · CO=L.
 *   - SIN RED — un fallo y muere.
 *   - 3 niveles con tiempo total decreciente: 12s / 8s / 5s.
 *   - Cheat sheet permanente.
 *   - Hands con dedos que se iluminan al pulsar.
 *
 * ESC para abortar.
 */

const PANEL_DEPTH = 2000;

type Syllable = 'CHOCO' | 'LA' | 'TE' | 'CHO' | 'CO';

const PATTERN: Syllable[] = [
  'CHOCO', 'CHOCO', 'LA', 'LA',
  'CHOCO', 'CHOCO', 'TE', 'TE',
  'CHOCO', 'LA', 'CHOCO', 'TE',
  'CHO', 'CO', 'LA', 'TE',
];

const KEY_MAP: Record<Syllable, string[]> = {
  CHOCO: ['A', 'L'],
  LA: ['S', 'K'],
  TE: ['D', 'J'],
  CHO: ['A'],
  CO: ['L'],
};

const ALL_KEYS = ['A', 'S', 'D', 'J', 'K', 'L'] as const;
type TrackedKey = (typeof ALL_KEYS)[number];

type LevelParams = {
  timeLimitMs: number;
  label: string;
};

const LEVELS: LevelParams[] = [
  { timeLimitMs: 12000, label: 'L1 · tranquila' },
  { timeLimitMs: 8000,  label: 'L2 · rápida' },
  { timeLimitMs: 5000,  label: 'L3 · final' },
];

const CHORD_WINDOW_MS = 130;

// Bailongo: amplitud y velocidad del sway de las sílabas verdes.
const BAILONGO_AMPL_PX = 1.6;
const BAILONGO_PERIOD_MS = 520;
const BAILONGO_STAGGER_MS = 70; // delay entre sílabas vecinas → efecto wave

export const runChocolateMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>(async (resolve) => {
    const ok = await showMinigameIntro(ctx.scene, {
      title: 'CHOCO·CHOCO·LA·LA',
      description:
        'Juego de memoria muscular. 3 niveles.\n' +
        'Sólo una PRO del chocolala podrá abrir esta habitación.\n\n' +
        'Coloca las manos:\n' +
        'izquierda en A·S·D · derecha en J·K·L\n' +
        'CHOCO = A+L  ·  LA = S+K  ·  TE = D+J',
      controls: 'A·S·D | J·K·L · ESC para salir',
    });
    if (!ok) return resolve({ success: false, reason: 'aborted' });
    new ChocolateGame(ctx, resolve).start();
  });
};

type SyllableGO = {
  text: Phaser.GameObjects.Text;
  baseX: number;
  baseY: number;
  index: number; // posición en el patrón (para stagger del bailongo)
};

class ChocolateGame {
  private ctx: MinigameContext;
  private resolveOuter: (r: MinigameResult) => void;

  // Estado.
  private levelIdx = 0;
  private cursorIdx = 0;
  private finished = false;
  private levelStartMs = 0;
  private chordPressed: Set<TrackedKey> = new Set();
  private chordStartedAt = 0;
  private pendingTransitionTimer?: Phaser.Time.TimerEvent;

  // Input.
  private keyEsc?: Phaser.Input.Keyboard.Key;
  private keyDownHandler!: (event: KeyboardEvent) => void;
  private keyUpHandler!: (event: KeyboardEvent) => void;

  // Visuales.
  private dim!: Phaser.GameObjects.Rectangle;
  private panelBg!: Phaser.GameObjects.Rectangle;
  private panelBorder!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private cheatText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private fingers: Map<TrackedKey, { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = new Map();
  private separator!: Phaser.GameObjects.Text;
  private timeBarBg!: Phaser.GameObjects.Rectangle;
  private timeBarFg!: Phaser.GameObjects.Rectangle;
  private hintText!: Phaser.GameObjects.Text;

  // Sílabas — array paralelo al PATTERN.
  private syllables: SyllableGO[] = [];
  /** Índices de las sílabas que están en estado "acertada" (verdes, bailongo). */
  private greenIdx: Set<number> = new Set();

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
    this.runLevel();
    this.onUpdate = (time, _delta) => this.tick(time);
    this.ctx.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
  }

  // ──────────────────────────────────────────────────────────────────────
  // UI
  // ──────────────────────────────────────────────────────────────────────

  private buildUi(): void {
    const cam = this.ctx.scene.cameras.main;
    const PW = 290;
    const PH = 200;
    this.cx = cam.width / 2;
    this.cy = cam.height / 2;

    this.dim = this.ctx.scene.add
      .rectangle(this.cx, this.cy, cam.width, cam.height, 0x000000, 0.7)
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
      .text(this.cx, this.cy - PH / 2 + 10, 'CHOCO·CHOCO·LA·LA', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '9px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.levelText = this.ctx.scene.add
      .text(this.cx, this.cy - PH / 2 + 22, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#c08a4f',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.cheatText = this.ctx.scene.add
      .text(
        this.cx,
        this.cy - PH / 2 + 35,
        'CHOCO=A+L  ·  LA=S+K  ·  TE=D+J  ·  CHO=A  ·  CO=L',
        {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '6px',
          color: '#9ca3af',
        },
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Sílabas — grid wrap. Calculamos el ancho de cada sílaba con un
    // espaciado fijo y dejamos saltos de línea cuando no caben.
    this.buildSyllableGrid(PW);

    // Status text efímero (mensaje de entrada, fallo, etc.).
    this.statusText = this.ctx.scene.add
      .text(this.cx, this.cy + 22, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Hands.
    const fingerY = this.cy + 50;
    const leftX = this.cx - 38;
    const rightX = this.cx + 11;
    const layout: Array<{ k: TrackedKey; x: number }> = [
      { k: 'A', x: leftX + 0 },
      { k: 'S', x: leftX + 14 },
      { k: 'D', x: leftX + 28 },
      { k: 'J', x: rightX + 0 },
      { k: 'K', x: rightX + 14 },
      { k: 'L', x: rightX + 28 },
    ];
    for (const item of layout) {
      const box = this.ctx.scene.add
        .rectangle(item.x, fingerY, 12, 14, 0x3a2618, 1)
        .setStrokeStyle(1, 0x6b4425, 1)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 3);
      const label = this.ctx.scene.add
        .text(item.x, fingerY, item.k, {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '8px',
          color: '#c08a4f',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 4);
      this.fingers.set(item.k, { box, label });
    }
    this.separator = this.ctx.scene.add
      .text(this.cx, fingerY, '|', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '12px',
        color: '#6b4425',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Time bar.
    this.timeBarBg = this.ctx.scene.add
      .rectangle(this.cx, this.cy + PH / 2 - 18, PW - 24, 5, 0x3a2618, 1)
      .setStrokeStyle(1, 0x6b4425, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);
    this.timeBarFg = this.ctx.scene.add
      .rectangle(this.cx - (PW - 24) / 2, this.cy + PH / 2 - 18, PW - 24, 4, 0x4ade80, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);

    this.hintText = this.ctx.scene.add
      .text(this.cx, this.cy + PH / 2 - 8, 'ESC: salir  ·  un fallo = se cierra', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#6b4425',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);
  }

  private buildSyllableGrid(panelW: number): void {
    // Estimo ancho por sílaba (monospace 9px ≈ 5.4px/char). Añado padding
    // entre sílabas. Salto de línea cuando excede el ancho útil.
    const fontSize = 9;
    const charPx = 5.6;
    const padBetween = 8;
    const usableW = panelW - 28;

    // 1ª pasada: calcular líneas (qué sílabas van en cada fila).
    const rows: number[][] = [[]];
    let curRowW = 0;
    for (let i = 0; i < PATTERN.length; i++) {
      const w = PATTERN[i].length * charPx;
      const wWithPad = w + (rows[rows.length - 1].length === 0 ? 0 : padBetween);
      if (curRowW + wWithPad > usableW) {
        rows.push([]);
        curRowW = w;
      } else {
        curRowW += wWithPad;
      }
      rows[rows.length - 1].push(i);
    }

    // 2ª pasada: posicionar.
    const lineHeight = fontSize + 4;
    const totalH = rows.length * lineHeight;
    const startY = this.cy - 6 - totalH / 2;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      // Ancho real de esta fila.
      let rowW = 0;
      for (let j = 0; j < row.length; j++) {
        rowW += PATTERN[row[j]].length * charPx;
        if (j > 0) rowW += padBetween;
      }
      let x = this.cx - rowW / 2;
      const y = startY + r * lineHeight;
      for (let j = 0; j < row.length; j++) {
        const i = row[j];
        const w = PATTERN[i].length * charPx;
        const cx = x + w / 2;
        const t = this.ctx.scene.add
          .text(cx, y, PATTERN[i], {
            fontFamily: "'Silkscreen', monospace",
            fontSize: fontSize + 'px',
            color: '#6b4425',
            fontStyle: 'bold',
          })
          .setOrigin(0.5, 0.5)
          .setScrollFactor(0)
          .setDepth(PANEL_DEPTH + 3);
        this.syllables.push({ text: t, baseX: cx, baseY: y, index: i });
        x += w + padBetween;
      }
    }
  }

  private bindInput(): void {
    const kb = this.ctx.scene.input.keyboard;
    if (!kb) return;
    this.keyEsc = kb.addKey('ESC');
    this.keyEsc.on('down', () => this.abort());

    this.keyDownHandler = (e: KeyboardEvent) => {
      const k = (e.key || '').toUpperCase() as TrackedKey;
      if (!ALL_KEYS.includes(k)) return;
      this.handleKeyDown(k);
    };
    this.keyUpHandler = (e: KeyboardEvent) => {
      const k = (e.key || '').toUpperCase() as TrackedKey;
      if (!ALL_KEYS.includes(k)) return;
      this.lightFinger(k, false);
    };
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  // ──────────────────────────────────────────────────────────────────────
  // FLOW
  // ──────────────────────────────────────────────────────────────────────

  private runLevel(): void {
    if (this.finished) return;
    this.cursorIdx = 0;
    this.chordPressed.clear();
    this.chordStartedAt = 0;
    this.greenIdx.clear();
    this.levelStartMs = this.ctx.scene.time.now;

    // Reset visuales: todas las sílabas a gris.
    for (const s of this.syllables) {
      s.text.setColor('#6b4425');
      s.text.setScale(1);
      s.text.x = s.baseX;
      s.text.y = s.baseY;
    }

    const lvl = LEVELS[this.levelIdx];
    this.safeSetText(this.levelText, lvl.label + '  ·  tienes ' + (lvl.timeLimitMs / 1000) + 's');
    this.safeSetText(this.statusText, '¡cántala!');
    this.statusText.setColor('#fbbf24');
  }

  private failGame(reason: string, syllableIdx: number | null): void {
    if (this.finished) return;
    this.safeSetText(this.statusText, reason);
    this.statusText.setColor('#ef4444');

    // Sílaba esperada → roja + shake duro durante ~280ms, luego cierra.
    if (syllableIdx !== null) {
      const s = this.syllables[syllableIdx];
      if (s && s.text.scene) {
        s.text.setColor('#ef4444');
        // Shake horizontal.
        let shakeT = 0;
        const shakeTimer = this.ctx.scene.time.addEvent({
          delay: 30,
          repeat: 8,
          callback: () => {
            shakeT++;
            const dx = (shakeT % 2 === 0 ? 1 : -1) * 3;
            if (s.text.scene) s.text.x = s.baseX + dx;
          },
          callbackScope: this,
        });
        // Camera shake leve también.
        this.ctx.scene.cameras.main.shake(280, 0.005);
        // Tras shake, cierra.
        this.pendingTransitionTimer = this.ctx.scene.time.delayedCall(400, () => {
          shakeTimer.remove();
          if (s.text.scene) s.text.x = s.baseX;
          if (this.finished) return;
          this.finish(false, 'failed');
        });
        return;
      }
    }

    // Fallback (sin sílaba focal): cierra tras 500ms.
    this.pendingTransitionTimer = this.ctx.scene.time.delayedCall(500, () => {
      if (this.finished) return;
      this.finish(false, 'failed');
    });
  }

  private passLevel(): void {
    if (this.finished) return;
    if (this.levelIdx + 1 >= LEVELS.length) {
      this.safeSetText(this.statusText, '¡CHOCOLATE! ✓');
      this.statusText.setColor('#4ade80');
      this.pendingTransitionTimer = this.ctx.scene.time.delayedCall(900, () => {
        if (this.finished) return;
        this.finish(true);
      });
      return;
    }
    this.safeSetText(this.statusText, `nivel ${this.levelIdx + 1} ✓ — ahora más rápido`);
    this.statusText.setColor('#4ade80');
    this.pendingTransitionTimer = this.ctx.scene.time.delayedCall(1200, () => {
      if (this.finished) return;
      this.levelIdx += 1;
      this.runLevel();
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // INPUT
  // ──────────────────────────────────────────────────────────────────────

  private handleKeyDown(k: TrackedKey): void {
    if (this.finished) return;
    this.lightFinger(k, true);

    const expectedSyll = PATTERN[this.cursorIdx];
    if (!expectedSyll) return;
    const expectedSet = new Set(KEY_MAP[expectedSyll] as TrackedKey[]);

    if (!expectedSet.has(k)) {
      this.failGame('te has trabado en ' + expectedSyll, this.cursorIdx);
      return;
    }

    if (this.chordPressed.size === 0) {
      this.chordStartedAt = this.ctx.scene.time.now;
    }
    this.chordPressed.add(k);

    if (this.setEqual(this.chordPressed, expectedSet)) {
      this.markSyllableHit(this.cursorIdx);
      this.advanceCursor();
    }
  }

  private markSyllableHit(idx: number): void {
    const s = this.syllables[idx];
    if (!s || !s.text.scene) return;
    s.text.setColor('#4ade80');
    // Pop pequeño al acertar — sensación de "click rítmico".
    this.ctx.scene.tweens.add({
      targets: s.text,
      scaleX: 1.35,
      scaleY: 1.35,
      duration: 120,
      yoyo: true,
      ease: 'Cubic.easeOut',
    });
    this.greenIdx.add(idx);
  }

  private advanceCursor(): void {
    this.cursorIdx += 1;
    this.chordPressed.clear();
    this.chordStartedAt = 0;

    if (this.cursorIdx >= PATTERN.length) {
      this.passLevel();
    }
  }

  private lightFinger(k: TrackedKey, on: boolean): void {
    const f = this.fingers.get(k);
    if (!f || !f.box.scene) return;
    if (on) {
      f.box.setFillStyle(0xfbbf24, 1);
      f.label.setColor('#1a0e08');
    } else {
      f.box.setFillStyle(0x3a2618, 1);
      f.label.setColor('#c08a4f');
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // TICK
  // ──────────────────────────────────────────────────────────────────────

  private tick(time: number): void {
    if (this.finished) return;
    const lvl = LEVELS[this.levelIdx];
    const tElapsed = time - this.levelStartMs;

    if (tElapsed >= lvl.timeLimitMs) {
      this.failGame('se acabó el tiempo', null);
      return;
    }

    if (this.timeBarFg.scene) {
      const ratio = Math.max(0, 1 - tElapsed / lvl.timeLimitMs);
      this.timeBarFg.width = (this.timeBarBg.width - 0) * ratio;
      if (ratio < 0.25) this.timeBarFg.fillColor = 0xef4444;
      else if (ratio < 0.5) this.timeBarFg.fillColor = 0xfbbf24;
      else this.timeBarFg.fillColor = 0x4ade80;
    }

    // Bailongo: aplica sway sinusoidal a las sílabas verdes con stagger.
    if (this.greenIdx.size > 0) {
      for (const idx of this.greenIdx) {
        const s = this.syllables[idx];
        if (!s || !s.text.scene) continue;
        const phase = ((time + idx * BAILONGO_STAGGER_MS) % BAILONGO_PERIOD_MS) / BAILONGO_PERIOD_MS;
        const offset = Math.sin(phase * Math.PI * 2) * BAILONGO_AMPL_PX;
        s.text.y = s.baseY + offset;
      }
    }

    // Timeout chord parcial.
    if (
      this.chordPressed.size > 0 &&
      this.chordStartedAt > 0 &&
      time - this.chordStartedAt > CHORD_WINDOW_MS
    ) {
      const expected = PATTERN[this.cursorIdx];
      const expectedSet = new Set(KEY_MAP[expected] as TrackedKey[]);
      if (!this.setEqual(this.chordPressed, expectedSet)) {
        this.failGame('media sílaba — pulsa las dos a la vez', this.cursorIdx);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────

  private safeSetText(t: Phaser.GameObjects.Text | undefined, s: string): void {
    if (!t || !t.scene) return;
    t.setText(s);
  }

  private setEqual(a: Set<TrackedKey>, b: Set<TrackedKey>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
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
    this.pendingTransitionTimer?.remove();
    this.pendingTransitionTimer = undefined;

    if (this.statusText) this.ctx.scene.tweens.killTweensOf(this.statusText);
    for (const s of this.syllables) {
      if (s.text.scene) this.ctx.scene.tweens.killTweensOf(s.text);
    }

    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
    if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
    this.keyEsc?.removeAllListeners();

    [
      this.dim,
      this.panelBg,
      this.panelBorder,
      this.titleText,
      this.levelText,
      this.cheatText,
      this.statusText,
      this.timeBarBg,
      this.timeBarFg,
      this.hintText,
      this.separator,
    ].forEach((o) => o?.destroy());
    for (const f of this.fingers.values()) {
      f.box.destroy();
      f.label.destroy();
    }
    this.fingers.clear();
    for (const s of this.syllables) s.text.destroy();
    this.syllables = [];
    this.greenIdx.clear();
  }
}
