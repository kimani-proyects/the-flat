import * as Phaser from 'phaser';
import type { MinigameContext, MinigameResult, MinigameRunner } from '../types';
import { showMinigameIntro } from '../_shared/MinigameIntroPanel';
import { S, COLORS, FONT_STACK } from '../../systems/TextStyle';
import { pickWordleAnswer } from '../../data/wordleWords';
import { todayDateKey } from '../../systems/MinigameCooldown';
import { Sfx } from '../../systems/SfxBank';

/**
 * WORDLE — minijuego de Haku (Día 9a).
 *
 * Mecánica clásica:
 *   - 6 intentos para adivinar una palabra de 5 letras.
 *   - Tras cada intento, feedback por casilla:
 *       VERDE  → letra correcta en la posición correcta.
 *       AMARILLO → letra está en la palabra pero en otra posición.
 *       GRIS    → letra no está en la palabra.
 *   - Las teclas del teclado virtual también se colorean acumulando
 *     información (la "mejor" pista vista para esa letra: green > yellow
 *     > gray, no se sobrescribe a peor).
 *
 * Política de duplicados (regla NYTimes Wordle):
 *   - 1ª pasada: marcar todos los GREEN y restar esas letras del answer.
 *   - 2ª pasada: para no-greens, si la letra está en answer-restante,
 *     amarillo + restar. Si no, gris.
 *
 * Daily seed: la palabra del día se elige con `todayDateKey()` así que
 * todas las jugadoras (María) ven la misma palabra el mismo día. La hash
 * está estabilizada con FNV-1a en wordleWords.ts.
 *
 * Cooldown 24h: el caller (CatSystem) llama a markMinigamePlayed
 * `'haku-wordle'` cuando el promise resuelve, gane o pierda. Aquí dentro
 * SÓLO guardamos el resultado en wordleHistory[date] al terminar.
 *
 * Unlock 'cena': también lo decide el caller — si success=true y aún no
 * está desbloqueado, hace `unlockGift('cena')`.
 *
 * ESC para abortar (no cuenta como intento; resuelve con
 * success=false, reason='aborted', y el caller decide si aplica
 * cooldown o no).
 */

const PANEL_DEPTH = 2000;

const ROWS = 6;
const COLS = 5;

// Tamaños de la grid.
const CELL = 16;
const CELL_GAP = 2;

// Tamaños del teclado.
const KEY_W = 13;
const KEY_H = 14;
const KEY_GAP = 2;

const KB_ROWS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['↵', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
];

type LetterStatus = 'empty' | 'pending' | 'green' | 'yellow' | 'gray';

const STATUS_FILL: Record<LetterStatus, number> = {
  empty: 0x1a0e08,
  pending: 0x3a2618,
  green: 0x4ade80,
  yellow: 0xfbbf24,
  gray: 0x4b5563,
};

const STATUS_TEXT_COLOR: Record<LetterStatus, string> = {
  empty: COLORS.textBeige,
  pending: COLORS.textWhite,
  green: '#062b13',
  yellow: '#3a2618',
  gray: '#e5e7eb',
};

const STATUS_RANK: Record<LetterStatus, number> = {
  empty: 0,
  pending: 0,
  gray: 1,
  yellow: 2,
  green: 3,
};

interface CellGO {
  bg: Phaser.GameObjects.Rectangle;
  border: Phaser.GameObjects.Rectangle;
  letter: Phaser.GameObjects.Text;
  status: LetterStatus;
}

interface KeyGO {
  key: string;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  status: LetterStatus;
}

export const runWordleMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>(async (resolve) => {
    const ok = await showMinigameIntro(ctx.scene, {
      title: 'WORDLE · HAKU',
      description:
        'Haku te observa, parpadea despacio.\n' +
        '6 intentos para adivinar una palabra de 5 letras.\n\n' +
        'VERDE = letra y posición correctas.\n' +
        'AMARILLO = letra correcta, otra posición.\n' +
        'GRIS = letra no está.',
      controls: 'A-Z escribir · ENTER enviar · ⌫ borrar · ESC salir',
    });
    if (!ok) return resolve({ success: false, reason: 'aborted' });
    new WordleGame(ctx, resolve).start();
  });
};

class WordleGame {
  private ctx: MinigameContext;
  private resolveOuter: (r: MinigameResult) => void;

  // Estado del juego.
  private answer: string;
  private currentRow = 0;
  private currentCol = 0;
  private guesses: string[] = []; // tracking de las palabras enviadas
  private finished = false;
  private endingPhase = false; // tras win/lose, esperando SPACE para cerrar

  // Visuales.
  private dim!: Phaser.GameObjects.Rectangle;
  private panelBg!: Phaser.GameObjects.Rectangle;
  private panelBorder!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private cells: CellGO[][] = []; // [row][col]
  private keys: Map<string, KeyGO> = new Map();

  // Centro & dims.
  private cx = 0;
  private cy = 0;
  private readonly PW = 220;
  private readonly PH = 260;

  // Input.
  private keyDownHandler!: (e: KeyboardEvent) => void;

  constructor(ctx: MinigameContext, resolve: (r: MinigameResult) => void) {
    this.ctx = ctx;
    this.resolveOuter = resolve;
    this.answer = pickWordleAnswer(todayDateKey());
  }

  start(): void {
    this.buildUi();
    this.bindInput();
    this.setStatus('intento 1/6', COLORS.yellow);
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

    // Header.
    this.titleText = this.ctx.scene.add
      .text(this.cx, this.cy - this.PH / 2 + 12, 'WORDLE · HAKU', S.header())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);
    this.subtitleText = this.ctx.scene.add
      .text(this.cx, this.cy - this.PH / 2 + 26, 'palabra del día · ' + todayDateKey(), S.hint())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Grid: total width 5*16 + 4*2 = 88, total height 6*16 + 5*2 = 106.
    const gridW = COLS * CELL + (COLS - 1) * CELL_GAP;
    const gridH = ROWS * CELL + (ROWS - 1) * CELL_GAP;
    const gridLeft = this.cx - gridW / 2;
    const gridTop = this.cy - this.PH / 2 + 38;

    for (let r = 0; r < ROWS; r++) {
      const row: CellGO[] = [];
      for (let c = 0; c < COLS; c++) {
        const x = gridLeft + c * (CELL + CELL_GAP) + CELL / 2;
        const y = gridTop + r * (CELL + CELL_GAP) + CELL / 2;
        const border = this.ctx.scene.add
          .rectangle(x, y, CELL + 1, CELL + 1, 0x6b4425, 1)
          .setScrollFactor(0)
          .setDepth(PANEL_DEPTH + 3);
        const bg = this.ctx.scene.add
          .rectangle(x, y, CELL - 1, CELL - 1, STATUS_FILL.empty, 1)
          .setScrollFactor(0)
          .setDepth(PANEL_DEPTH + 4);
        const letter = this.ctx.scene.add
          .text(x, y, '', {
            fontFamily: FONT_STACK,
            fontSize: '11px',
            color: STATUS_TEXT_COLOR.empty,
            fontStyle: 'bold',
          })
          .setOrigin(0.5, 0.5)
          .setScrollFactor(0)
          .setDepth(PANEL_DEPTH + 5);
        row.push({ bg, border, letter, status: 'empty' });
      }
      this.cells.push(row);
    }

    // Status text (entre grid y teclado).
    const statusY = gridTop + gridH + 8;
    this.statusText = this.ctx.scene.add
      .text(this.cx, statusY, '', {
        fontFamily: FONT_STACK,
        fontSize: '8px',
        color: COLORS.yellow,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Teclado: 3 filas centradas, fila 3 con teclas Enter/Backspace anchas.
    const kbTop = statusY + 14;
    for (let r = 0; r < KB_ROWS.length; r++) {
      const row = KB_ROWS[r];
      // Calcular ancho real de la fila (las teclas especiales son más anchas).
      let totalW = 0;
      for (let i = 0; i < row.length; i++) {
        const w = row[i] === '↵' || row[i] === '⌫' ? KEY_W * 2 + KEY_GAP : KEY_W;
        totalW += w;
        if (i < row.length - 1) totalW += KEY_GAP;
      }
      let x = this.cx - totalW / 2;
      const y = kbTop + r * (KEY_H + KEY_GAP) + KEY_H / 2;
      for (let i = 0; i < row.length; i++) {
        const k = row[i];
        const w = k === '↵' || k === '⌫' ? KEY_W * 2 + KEY_GAP : KEY_W;
        const cx = x + w / 2;
        const bg = this.ctx.scene.add
          .rectangle(cx, y, w - 1, KEY_H - 1, 0x3a2618, 1)
          .setStrokeStyle(1, 0x6b4425, 1)
          .setScrollFactor(0)
          .setDepth(PANEL_DEPTH + 3);
        const label = this.ctx.scene.add
          .text(cx, y, k, {
            fontFamily: FONT_STACK,
            fontSize: '8px',
            color: COLORS.textWhite,
            fontStyle: 'bold',
          })
          .setOrigin(0.5, 0.5)
          .setScrollFactor(0)
          .setDepth(PANEL_DEPTH + 4);
        this.keys.set(k, { key: k, bg, label, status: 'empty' });
        x += w + KEY_GAP;
      }
    }

    this.hintText = this.ctx.scene.add
      .text(this.cx, this.cy + this.PH / 2 - 8, 'A-Z · ENTER · ⌫  ·  ESC salir', S.hint())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);
  }

  private bindInput(): void {
    this.keyDownHandler = (e: KeyboardEvent) => {
      if (this.finished) return;
      const k = (e.key || '').toUpperCase();

      if (k === 'ESCAPE' || k === 'ESC') {
        e.preventDefault();
        this.abort();
        return;
      }

      if (this.endingPhase) {
        // Sólo SPACE/ENTER cierran tras win/lose.
        if (k === ' ' || k === 'SPACEBAR' || k === 'ENTER') {
          e.preventDefault();
          this.finish(this.lastResultWin, this.lastResultWin ? 'completed' : 'failed');
        }
        return;
      }

      if (k === 'ENTER') {
        e.preventDefault();
        this.submitRow();
        return;
      }
      if (k === 'BACKSPACE') {
        e.preventDefault();
        this.removeLetter();
        return;
      }
      if (/^[A-Z]$/.test(k)) {
        e.preventDefault();
        this.addLetter(k);
      }
    };
    window.addEventListener('keydown', this.keyDownHandler);

    // Defensive: si la escena se cierra (cambio a Hub, nav fuera del
    // juego), limpiamos para no dejar listeners colgando.
    this.ctx.scene.events.once('shutdown', () => this.abort());
    this.ctx.scene.events.once('destroy', () => this.abort());
  }

  // ──────────────────────────────────────────────────────────────────
  // INPUT HANDLERS
  // ──────────────────────────────────────────────────────────────────

  private addLetter(letter: string): void {
    if (this.currentCol >= COLS) return;
    const cell = this.cells[this.currentRow][this.currentCol];
    cell.letter.setText(letter);
    cell.status = 'pending';
    cell.bg.setFillStyle(STATUS_FILL.pending, 1);
    cell.letter.setColor(STATUS_TEXT_COLOR.pending);
    // Pequeño pop de feedback.
    this.ctx.scene.tweens.add({
      targets: cell.letter,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 80,
      yoyo: true,
      ease: 'Cubic.easeOut',
    });
    this.currentCol += 1;
  }

  private removeLetter(): void {
    if (this.currentCol <= 0) return;
    this.currentCol -= 1;
    const cell = this.cells[this.currentRow][this.currentCol];
    cell.letter.setText('');
    cell.status = 'empty';
    cell.bg.setFillStyle(STATUS_FILL.empty, 1);
    cell.letter.setColor(STATUS_TEXT_COLOR.empty);
  }

  private submitRow(): void {
    if (this.currentCol < COLS) {
      this.setStatus('faltan letras', COLORS.error);
      this.shakeRow(this.currentRow);
      return;
    }
    let guess = '';
    for (let c = 0; c < COLS; c++) {
      guess += this.cells[this.currentRow][c].letter.text;
    }
    guess = guess.toUpperCase();
    this.guesses.push(guess);

    // Computar feedback (regla NYTimes con duplicados).
    const statuses = this.computeStatuses(guess, this.answer);

    // Aplicar status visual a la fila + actualizar teclado.
    for (let c = 0; c < COLS; c++) {
      const cell = this.cells[this.currentRow][c];
      cell.status = statuses[c];
      cell.bg.setFillStyle(STATUS_FILL[statuses[c]], 1);
      cell.letter.setColor(STATUS_TEXT_COLOR[statuses[c]]);
      this.bumpKeyStatus(guess[c], statuses[c]);
    }

    // ¿Win?
    if (guess === this.answer) {
      this.lastResultWin = true;
      this.endingPhase = true;
      this.setStatus(
        `¡biennn! Haku ronronea.  SPACE para cerrar`,
        COLORS.success,
      );
      // Pequeña celebración: pop de cada celda en orden.
      for (let c = 0; c < COLS; c++) {
        const cell = this.cells[this.currentRow][c];
        this.ctx.scene.tweens.add({
          targets: [cell.bg, cell.letter, cell.border],
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 200,
          yoyo: true,
          delay: c * 80,
          ease: 'Cubic.easeOut',
        });
      }
      return;
    }

    // ¿Lose?
    this.currentRow += 1;
    this.currentCol = 0;
    if (this.currentRow >= ROWS) {
      this.lastResultWin = false;
      this.endingPhase = true;
      this.setStatus(
        `era ${this.answer}.  SPACE para cerrar`,
        COLORS.error,
      );
      this.ctx.scene.cameras.main.shake(280, 0.005);
      return;
    }

    this.setStatus(
      'intento ' + (this.currentRow + 1) + '/6',
      COLORS.yellow,
    );
  }

  private lastResultWin = false;

  /**
   * Feedback Wordle clásico con duplicados.
   *
   * 1ª pasada: marcar GREEN y restar la letra del "remainingAnswer".
   * 2ª pasada: para no-greens, si está en remaining → YELLOW + resta.
   *            si no → GRAY.
   */
  private computeStatuses(guess: string, answer: string): LetterStatus[] {
    const out: LetterStatus[] = new Array(COLS).fill('gray');
    const remaining: (string | null)[] = answer.split('');

    // Pasada 1: greens.
    for (let i = 0; i < COLS; i++) {
      if (guess[i] === answer[i]) {
        out[i] = 'green';
        remaining[i] = null;
      }
    }
    // Pasada 2: yellows / grays.
    for (let i = 0; i < COLS; i++) {
      if (out[i] === 'green') continue;
      const idx = remaining.indexOf(guess[i]);
      if (idx !== -1) {
        out[i] = 'yellow';
        remaining[idx] = null;
      } else {
        out[i] = 'gray';
      }
    }
    return out;
  }

  private bumpKeyStatus(letter: string, newStatus: LetterStatus): void {
    const k = this.keys.get(letter);
    if (!k) return;
    if (STATUS_RANK[newStatus] > STATUS_RANK[k.status]) {
      k.status = newStatus;
      k.bg.setFillStyle(STATUS_FILL[newStatus], 1);
      k.label.setColor(STATUS_TEXT_COLOR[newStatus]);
    }
  }

  private shakeRow(row: number): void {
    const cells = this.cells[row];
    let shake = 0;
    const timer = this.ctx.scene.time.addEvent({
      delay: 30,
      repeat: 6,
      callback: () => {
        shake++;
        const dx = (shake % 2 === 0 ? 1 : -1) * 3;
        for (const cell of cells) {
          if (!cell.bg.scene) continue;
          cell.bg.x += dx;
          cell.border.x += dx;
          cell.letter.x += dx;
        }
      },
    });
    this.ctx.scene.time.delayedCall(220, () => {
      timer.remove();
      // Reset positions exactly using grid math.
      const gridW = COLS * CELL + (COLS - 1) * CELL_GAP;
      const gridLeft = this.cx - gridW / 2;
      for (let c = 0; c < COLS; c++) {
        const x = gridLeft + c * (CELL + CELL_GAP) + CELL / 2;
        const cell = cells[c];
        if (!cell.bg.scene) continue;
        cell.bg.x = x;
        cell.border.x = x;
        cell.letter.x = x;
      }
    });
  }

  private setStatus(msg: string, color: string): void {
    if (!this.statusText.scene) return;
    this.statusText.setText(msg);
    this.statusText.setColor(color);
  }

  // ──────────────────────────────────────────────────────────────────
  // FINISH
  // ──────────────────────────────────────────────────────────────────

  private abort(): void {
    if (this.finished) return;
    this.finish(false, 'aborted');
  }

  /**
   * Devuelve el número de intentos usados (1-6 si ganó/perdió, else 0).
   * Sólo lo necesita el caller para wordleHistory.tries — pero como esta
   * clase resuelve sólo con boolean, lo dejamos pasar por el reason o lo
   * leemos del array `guesses`. En practica el caller no lo necesita
   * porque se guarda aquí mismo en `finish`.
   */
  private finish(success: boolean, reason: 'completed' | 'aborted' | 'failed'): void {
    if (this.finished) return;
    this.finished = true;
    // Persistir resultado en wordleHistory si NO fue aborted (no marca
    // tampoco cooldown — el caller sí lo hace siempre).
    if (reason !== 'aborted') {
      // Importación dinámica para evitar circulares con el store.
      import('@/lib/stores/gameStore').then(({ useProgressStore }) => {
        useProgressStore.getState().setWordleResult(todayDateKey(), {
          won: success,
          tries: this.guesses.length,
        });
      });
    }
    this.cleanup();
    this.resolveOuter({ success, reason });
  }

  private cleanup(): void {
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
    [
      this.dim,
      this.panelBg,
      this.panelBorder,
      this.titleText,
      this.subtitleText,
      this.statusText,
      this.hintText,
    ].forEach((o) => o?.destroy());
    for (const row of this.cells) {
      for (const cell of row) {
        cell.bg.destroy();
        cell.border.destroy();
        cell.letter.destroy();
      }
    }
    this.cells = [];
    for (const k of this.keys.values()) {
      k.bg.destroy();
      k.label.destroy();
    }
    this.keys.clear();
  }
}
