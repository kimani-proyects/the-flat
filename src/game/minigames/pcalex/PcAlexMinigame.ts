import * as Phaser from 'phaser';
import type { MinigameContext, MinigameResult, MinigameRunner } from '../types';
import { S, FONT_STACK } from '../../systems/TextStyle';
import { useProgressStore } from '@/lib/stores/gameStore';
import { GIFTS } from '../../data/gifts';
import { TOMODACHI_SERIAL, toMorse, HAS_REAL_SERIAL } from '../../data/secrets';
import { Sfx } from '../../systems/SfxBank';

/**
 * PC ALEX — terminal bash de hacking (S2.5).
 *
 * Estilo terminal con texto verde sobre fondo negro. María va siguiendo
 * comandos guiados (no escribe libremente). Al final introduce el CÓDIGO
 * del regalo "misterioso" de Kero (KER0-NALA-HAKU-2026) que se reveló
 * al canjear en regalos.exe. Si lo introduce bien → desbloquea la
 * escotilla. Persistente.
 *
 * También incluye un comando MORSE para descifrar el serial del Tomodachi
 * (utilidad extra del PC).
 */

const PANEL_DEPTH = 2400;
const TERMINAL_GREEN = '#33ff66';
const TERMINAL_DIM = '#226633';

/**
 * Pequeñas notas que Alex deja en system-status para María. Se elige
 * una al azar cada vez que abre el script. Tonito cariñoso pero con
 * humor para no resultar empalagoso.
 */
const ALEX_NOTES: string[] = [
  'felicidades, guapetona.',
  'feliz cumple, jefa.',
  'felicidades, princesa. (sé que odias esa palabra).',
  'felicidades — un año más conmigo aguantándote.',
  'que cumplas muchos más, pero todos así de raros.',
  'felicidades, María. en serio.',
  'feliz cumpleaños — el regalo es este piso entero.',
  'felicidades, monstrua de los gatos.',
  'lo de Haku duele. pero está bien estar tristes hoy.',
  'pase lo que pase, vuelvo a casa.',
  'nadie cuida de estos animales como tú.',
  'sé que es muy de mí dejarte notas en un terminal.',
];
const SECRET_CODE = GIFTS.misterioso.secretCode || 'HAKU-KERO-NALA';

export const runPcAlexMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>((resolve) => {
    new PcAlexShell(ctx, resolve).start();
  });
};

interface AppDef {
  label: string;
  run: () => Promise<void>;
}

class PcAlexShell {
  private ctx: MinigameContext;
  private resolveOuter: (r: MinigameResult) => void;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private finished = false;
  private appOpen = false;
  private keyDownHandler!: (e: KeyboardEvent) => void;
  private apps: AppDef[] = [];
  private cursor = 0;
  private menuTexts: Phaser.GameObjects.Text[] = [];

  constructor(ctx: MinigameContext, resolve: (r: MinigameResult) => void) {
    this.ctx = ctx;
    this.resolveOuter = resolve;
    this.apps = [
      { label: '1. unlock-hatch.sh    — abrir escotilla con código', run: () => this.runHatchUnlock() },
      { label: '2. morse-decode.sh    — descifrar serial morse', run: () => this.runMorseDecoder() },
      { label: '3. system-status.sh   — estado del sistema', run: () => this.runSystemStatus() },
      { label: '4. logout             — apagar PC', run: async () => { this.finish(); } },
    ];
  }

  start(): void {
    this.buildTerminal();
    this.bindInput();
  }

  private buildTerminal(): void {
    const cam = this.ctx.scene.cameras.main;
    const W = cam.width, H = cam.height;

    this.layer.push(
      this.ctx.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setScrollFactor(0).setDepth(PANEL_DEPTH),
    );
    // Scanlines decorativos.
    for (let y = 0; y < H; y += 3) {
      this.layer.push(
        this.ctx.scene.add.rectangle(W / 2, y, W, 1, 0x33ff66, 0.05).setScrollFactor(0).setDepth(PANEL_DEPTH + 1),
      );
    }

    // Header.
    this.layer.push(
      this.ctx.scene.add.text(8, 8, '┌─ alex@theflat:~$ ─────────────────────────────────┐', {
        fontFamily: FONT_STACK, fontSize: '8px', color: TERMINAL_GREEN,
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(PANEL_DEPTH + 2),
      this.ctx.scene.add.text(8, 18, 'AlexOS v3.14 · ' + new Date().toLocaleDateString(), {
        fontFamily: FONT_STACK, fontSize: '8px', color: TERMINAL_DIM,
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(PANEL_DEPTH + 2),
      this.ctx.scene.add.text(8, 32, 'Selecciona una utilidad:', {
        fontFamily: FONT_STACK, fontSize: '9px', color: TERMINAL_GREEN, fontStyle: 'bold',
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(PANEL_DEPTH + 2),
    );

    // Menú de apps.
    const startY = 48;
    const rowH = 14;
    for (let i = 0; i < this.apps.length; i++) {
      const t = this.ctx.scene.add.text(16, startY + i * rowH, this.apps[i].label, {
        fontFamily: FONT_STACK, fontSize: '9px', color: TERMINAL_GREEN,
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(PANEL_DEPTH + 2);
      this.menuTexts.push(t);
      this.layer.push(t);
    }
    this.refreshCursor();

    // Hint.
    this.layer.push(
      this.ctx.scene.add.text(8, H - 14, '↑/↓ navegar  ·  ENTER ejecutar  ·  ESC salir', {
        fontFamily: FONT_STACK, fontSize: '8px', color: TERMINAL_DIM,
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(PANEL_DEPTH + 2),
    );
  }

  private refreshCursor(): void {
    for (let i = 0; i < this.menuTexts.length; i++) {
      if (i === this.cursor) {
        this.menuTexts[i].setText('▶ ' + this.apps[i].label);
        this.menuTexts[i].setColor('#fbbf24');
      } else {
        this.menuTexts[i].setText('  ' + this.apps[i].label);
        this.menuTexts[i].setColor(TERMINAL_GREEN);
      }
    }
  }

  private bindInput(): void {
    this.keyDownHandler = (e: KeyboardEvent) => {
      if (this.finished || this.appOpen) return;
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); Sfx.click(); this.cursor = (this.cursor - 1 + this.apps.length) % this.apps.length; this.refreshCursor(); }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); Sfx.click(); this.cursor = (this.cursor + 1) % this.apps.length; this.refreshCursor(); }
      else if (k === ' ' || k === 'Enter') { e.preventDefault(); void this.runCurrent(); }
      else if (k === 'Escape' || k === 'Esc') { e.preventDefault(); this.finish(); }
    };
    window.addEventListener('keydown', this.keyDownHandler);
    this.ctx.scene.events.once('shutdown', () => this.finish());
    this.ctx.scene.events.once('destroy', () => this.finish());
  }

  private async runCurrent(): Promise<void> {
    const app = this.apps[this.cursor];
    if (!app) return;
    this.appOpen = true;
    try { await app.run(); } finally { this.appOpen = false; }
  }

  // ─── UNLOCK HATCH ─────────────────────────────────────────────────

  private runHatchUnlock(): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = this.ctx.scene.cameras.main;
      const W = cam.width, H = cam.height;
      const D = PANEL_DEPTH + 10;
      const els: Phaser.GameObjects.GameObject[] = [];
      els.push(
        this.ctx.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.95).setScrollFactor(0).setDepth(D),
      );

      const lines: string[] = [
        '> ./unlock-hatch.sh',
        '',
        '─── HATCH UNLOCK PROTOCOL ───────────',
        '',
        'la escotilla del piso está bloqueada',
        'con un cierre electrónico.',
        '',
        'introduce el CÓDIGO que viene con el',
        'regalo MISTERIOSO de Kero.',
        '',
        'pista: canjéalo desde regalos.exe',
        'del PC de María.',
        '',
      ];
      let yCursor = 8;
      const printLine = (txt: string, color = TERMINAL_GREEN) => {
        const t = this.ctx.scene.add.text(8, yCursor, txt, {
          fontFamily: FONT_STACK, fontSize: '8px', color,
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 1);
        els.push(t);
        yCursor += 10;
      };
      for (const l of lines) printLine(l);

      // Estado actual.
      const alreadyUnlocked = useProgressStore.getState().hatchUnlocked;
      if (alreadyUnlocked) {
        printLine('STATUS: escotilla YA desbloqueada. ✓', '#4ade80');
      }

      // Input area. Capturamos la ref del prompt ANTES de añadir más
      // elementos para que updatePrompt actualice el correcto.
      let buffer = '';
      const promptText = this.ctx.scene.add.text(8, yCursor, 'CODE> _', {
        fontFamily: FONT_STACK, fontSize: '8px', color: '#fbbf24',
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 1);
      els.push(promptText);
      yCursor += 10;
      const updatePrompt = () => {
        if (!promptText.scene) return;
        promptText.setText('CODE> ' + buffer + '_');
      };

      const status = this.ctx.scene.add.text(8, H - 30, '', {
        fontFamily: FONT_STACK, fontSize: '9px', color: '#ef4444', fontStyle: 'bold',
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 2);
      els.push(status);

      const hint = this.ctx.scene.add.text(8, H - 14, 'A-Z 0-9 - escribir  ·  ENTER validar  ·  ESC volver', {
        fontFamily: FONT_STACK, fontSize: '8px', color: TERMINAL_DIM,
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 2);
      els.push(hint);

      const cleanup = () => {
        window.removeEventListener('keydown', onKey);
        for (const o of els) if ((o as any).scene) o.destroy();
        resolve();
      };

      const onKey = (e: KeyboardEvent) => {
        const k = e.key;
        if (k === 'Escape' || k === 'Esc') { e.preventDefault(); cleanup(); return; }
        if (k === 'Enter') {
          e.preventDefault();
          if (buffer.toUpperCase() === SECRET_CODE) {
            useProgressStore.getState().setHatchUnlocked(true); Sfx.unlock();
            // S2.13: marcar habitacion-secreta como desbloqueada → el
            // LockedWallSystem dispara el derrumbe del muro automáticamente.
            useProgressStore.getState().unlockRoom('habitacion-secreta');
            status.setText('✓ código válido. escotilla desbloqueada.').setColor('#4ade80');
          } else {
            status.setText('✗ código incorrecto. inténtalo otra vez.').setColor('#ef4444');
            buffer = '';
            updatePrompt();
          }
          return;
        }
        if (k === 'Backspace') {
          e.preventDefault();
          buffer = buffer.slice(0, -1);
          updatePrompt();
          return;
        }
        if (k.length === 1 && /[A-Za-z0-9-]/.test(k) && buffer.length < 24) {
          e.preventDefault();
          buffer += k.toUpperCase();
          updatePrompt();
        }
      };
      window.addEventListener('keydown', onKey);
    });
  }

  // ─── MORSE DECODER ────────────────────────────────────────────────

  private runMorseDecoder(): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = this.ctx.scene.cameras.main;
      const W = cam.width, H = cam.height;
      const D = PANEL_DEPTH + 10;
      const els: Phaser.GameObjects.GameObject[] = [];
      els.push(
        this.ctx.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.95).setScrollFactor(0).setDepth(D),
      );

      const lines: string[] = [
        '> ./morse-decode.sh',
        '',
        '─── MORSE DECODER ──────────────────',
        '',
        'introduce el código morse usando',
        '"." y "-" separados por ESPACIOS.',
        '',
        '⚠ CUIDADO CON LOS ESPACIOS ⚠',
        '(un espacio = separador entre letras)',
        '',
        'EJEMPLO:',
        '... --- ...   → SOS',
        '',
      ];
      let yCursor = 8;
      const printLine = (txt: string, color = TERMINAL_GREEN) => {
        const t = this.ctx.scene.add.text(8, yCursor, txt, {
          fontFamily: FONT_STACK, fontSize: '8px', color,
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 1);
        els.push(t);
        yCursor += 10;
      };
      for (const l of lines) printLine(l);

      let buffer = '';
      printLine('MORSE> _', '#fbbf24');
      const promptIdx = els.length - 1;
      const updatePrompt = () => {
        (els[promptIdx] as Phaser.GameObjects.Text).setText('MORSE> ' + buffer + '_');
      };
      const result = this.ctx.scene.add.text(8, yCursor + 10, '', {
        fontFamily: FONT_STACK, fontSize: '10px', color: '#fbbf24', fontStyle: 'bold',
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 2);
      els.push(result);

      const hint = this.ctx.scene.add.text(8, H - 14, '. - ESPACIO  ·  ENTER descifrar  ·  BACKSPACE  ·  ESC volver', {
        fontFamily: FONT_STACK, fontSize: '8px', color: TERMINAL_DIM,
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 2);
      els.push(hint);

      const MORSE_MAP: Record<string, string> = {
        '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F', '--.': 'G', '....': 'H',
        '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P',
        '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
        '-.--': 'Y', '--..': 'Z',
        '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
        '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
      };
      const decode = (s: string): string => {
        // S2.8: UN espacio = separador entre letras. Sin separadores de palabra.
        return s.trim().split(/\s+/).map((c) => MORSE_MAP[c] || '?').join('');
      };

      const cleanup = () => {
        window.removeEventListener('keydown', onKey);
        for (const o of els) if ((o as any).scene) o.destroy();
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        const k = e.key;
        if (k === 'Escape' || k === 'Esc') { e.preventDefault(); cleanup(); return; }
        if (k === 'Enter') {
          e.preventDefault();
          if (!buffer.trim()) return;
          const decodedRaw = decode(buffer);
          const decoded = decodedRaw.replace(/\s+/g, '').toUpperCase();
          // Feedback visible: muestra el descifrado + cualquier ? destacado.
          const hasUnknown = decodedRaw.includes('?');
          result.setText('→ ' + decodedRaw + (hasUnknown ? '  (revisa espacios)' : ''));
          result.setColor(hasUnknown ? '#ef4444' : '#fbbf24');
          // S2.7: si el desciframiento iguala el SERIAL REAL del Tomodachi,
          // arrancamos el flujo Matrix-hack y unlockamos el regalo.
          const target = TOMODACHI_SERIAL_CLEAN.replace(/[-\s/]/g, '');
          if (target.length === 0) {
            result.setText('→ ' + decodedRaw + '  [serial vacío en secrets.local.ts]');
            result.setColor('#ef4444');
            return;
          }
          if (decoded === target) {
            // ¡MATCH! Bloquea más input y arranca animación.
            window.removeEventListener('keydown', onKey);
            this.runTomodachiUnlockAnim(els, () => cleanup());
          }
          return;
        }
        if (k === 'Backspace') {
          e.preventDefault();
          buffer = buffer.slice(0, -1);
          updatePrompt();
          return;
        }
        if (k === '.' || k === '-' || k === ' ') {
          e.preventDefault();
          if (buffer.length < 160) {
            buffer += k;
            updatePrompt();
          }
        }
      };
      window.addEventListener('keydown', onKey);
    });
  }

  // ─── SYSTEM STATUS ────────────────────────────────────────────────

  /**
   * S2.6: system-status.sh interactivo "hack style" para que sea bonito
   * cuando María lo abra en PC Alex. Animación tipo Matrix:
   *   1. Boot scan ("[OK] kernel..., [OK] memory..., [OK] network...").
   *   2. Stream de líneas que se escriben con typewriter una a una.
   *   3. Barra de "vibe" en ASCII llenándose.
   *   4. Panel final con el resumen real del estado de The Flat.
   *   5. SPACE/ENTER/ESC en cualquier momento para skip.
   */
  private runSystemStatus(): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = this.ctx.scene.cameras.main;
      const W = cam.width, H = cam.height;
      const D = PANEL_DEPTH + 10;
      const els: Phaser.GameObjects.GameObject[] = [];
      els.push(
        this.ctx.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.96).setScrollFactor(0).setDepth(D),
      );

      // Matrix-style columnas de carácteres cayendo en el fondo.
      const matrixChars = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF';
      const cols: { x: number; y: number; speed: number; text: Phaser.GameObjects.Text }[] = [];
      const NUM_COLS = Math.floor(W / 10);
      for (let i = 0; i < NUM_COLS; i++) {
        const t = this.ctx.scene.add.text(i * 10, Math.random() * H, '', {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#0a3a0a',
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 1).setAlpha(0.4);
        els.push(t);
        cols.push({ x: i * 10, y: Math.random() * H, speed: 1 + Math.random() * 2, text: t });
      }
      const matrixTimer = this.ctx.scene.time.addEvent({
        delay: 80,
        loop: true,
        callback: () => {
          for (const c of cols) {
            c.y += c.speed * 4;
            if (c.y > H + 20) c.y = -20;
            const ch = matrixChars[Math.floor(Math.random() * matrixChars.length)];
            c.text.setText(ch);
            c.text.setPosition(c.x, c.y);
          }
        },
      });

      // Header.
      els.push(
        this.ctx.scene.add.text(W / 2, 12, '╔═ ./system-status.sh ═╗', {
          fontFamily: FONT_STACK, fontSize: '10px', color: '#5eead4', fontStyle: 'bold',
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 3),
      );

      // Panel de log scrolleable (texto vivo).
      const logText = this.ctx.scene.add.text(8, 26, '', {
        fontFamily: FONT_STACK,
        fontSize: '8px',
        color: TERMINAL_GREEN,
        lineSpacing: 2,
        wordWrap: { width: W - 16, useAdvancedWrap: true },
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 3);
      els.push(logText);

      const skipHint = this.ctx.scene.add.text(W - 4, H - 12, 'SPACE skip · ESC volver', {
        fontFamily: FONT_STACK, fontSize: '7px', color: TERMINAL_DIM,
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(D + 4);
      els.push(skipHint);

      const s = useProgressStore.getState();
      const pct = (n: number, d: number) => Math.round((n / Math.max(d, 1)) * 100);
      const bar = (n: number, d: number, w = 16) => {
        const p = Math.min(1, n / Math.max(d, 1));
        const filled = Math.round(p * w);
        return '[' + '█'.repeat(filled) + '░'.repeat(w - filled) + '] ' + pct(n, d) + '%';
      };
      const vibePct = Math.min(
        100,
        s.unlockedRooms.length * 10 +
          s.unlockedGifts.length * 8 +
          Object.keys(s.redeemedGifts).length * 6 +
          (s.safeUnlocked ? 12 : 0) +
          (s.hatchUnlocked ? 14 : 0) +
          Math.min(s.tinderMatchedIds.length, 15) +
          Math.min(s.stackGameBest || 0, 30),
      );
      const vibeBar = (() => {
        const w = 28;
        const filled = Math.round((vibePct / 100) * w);
        return '[' + '█'.repeat(filled) + '░'.repeat(w - filled) + '] ' + vibePct + '%';
      })();

      // Script de líneas — algunas con typewriter, otras "boot scan".
      const script: { text: string; delay: number; color?: string }[] = [
        { text: '> initiating handshake...', delay: 200 },
        { text: '[OK] kernel: theflat-2.6.maria', delay: 220, color: '#5eead4' },
        { text: '[OK] memory: love & lore loaded', delay: 220, color: '#5eead4' },
        { text: '[OK] network: línea privada Alex⇄María', delay: 220, color: '#5eead4' },
        { text: '[OK] sensors: 3 gatos online', delay: 220, color: '#5eead4' },
        { text: '', delay: 80 },
        { text: '─── ESTADO DE THE FLAT ────────────', delay: 300, color: '#fbbf24' },
        { text: '', delay: 80 },
        { text: 'habitaciones    ' + bar(s.unlockedRooms.length, 5), delay: 280 },
        { text: 'regalos         ' + bar(s.unlockedGifts.length, 3), delay: 280 },
        { text: 'canjeados       ' + bar(Object.keys(s.redeemedGifts).length, 3), delay: 280 },
        { text: 'tinder cat      ' + bar(s.tinderMatchedIds.length, 15), delay: 280 },
        { text: 'stack record    ' + bar(Math.min(s.stackGameBest || 0, 30), 30), delay: 280 },
        { text: '', delay: 80 },
        { text: 'escotilla       ' + (s.hatchUnlocked ? '✓ ABIERTA' : '✗ cerrada'), delay: 220, color: s.hatchUnlocked ? '#4ade80' : '#ef4444' },
        { text: 'caja fuerte     ' + (s.safeUnlocked ? '✓ ABIERTA' : '✗ cerrada'), delay: 220, color: s.safeUnlocked ? '#4ade80' : '#ef4444' },
        { text: 'gatos spawn     ' + (s.catsSpawned ? '✓ activos' : '✗ pendientes'), delay: 220 },
        { text: '', delay: 80 },
        { text: '─── VIBE INDEX ────────────────────', delay: 300, color: '#fbbf24' },
        { text: 'amor / paciencia / sueños:', delay: 250 },
        { text: vibeBar, delay: 380, color: '#ff2e9f' },
        { text: '', delay: 100 },
        { text: '> EOF', delay: 200, color: '#5eead4' },
        { text: '> todo el progreso se guarda en disco.', delay: 240 },
        { text: '', delay: 80 },
        { text: '> [click panel derecho] notas de A.', delay: 380, color: '#fbbf24' },
      ];

      let idx = 0;
      let buffer = '';
      let done = false;
      let timer: Phaser.Time.TimerEvent | null = null;

      const finishAll = () => {
        if (done) return;
        done = true;
        if (timer) timer.remove();
        if (matrixTimer) matrixTimer.remove();
        // Pinta todo de golpe.
        buffer = script.map((l) => l.text).join('\n');
        logText.setText(buffer);
      };

      const advance = () => {
        if (done || idx >= script.length) return;
        const line = script[idx];
        buffer += (buffer ? '\n' : '') + line.text;
        logText.setText(buffer);
        idx += 1;
        if (idx >= script.length) {
          if (timer) timer.remove();
          return;
        }
        timer = this.ctx.scene.time.delayedCall(line.delay, advance);
      };
      timer = this.ctx.scene.time.delayedCall(150, advance);

      // ─── S2.11: Notas Alex — 2 fade-in auto, SIN click, cleanup garantizado.
      // Aparecen escalonadas en la mitad derecha con efecto Matrix typewriter.
      // Se autodestruyen cuando se cierra el system-status (en `cleanup`).
      const panelX = W * 0.50;
      const panelW = W * 0.48;
      const panelY = 80;
      // No background visible — sólo el texto sobre la matrix.
      const notesEls: Phaser.GameObjects.Text[] = [];
      const usedNoteIdx = new Set<number>();

      const pickNextNote = (): string => {
        if (usedNoteIdx.size >= ALEX_NOTES.length) usedNoteIdx.clear();
        let i = Math.floor(Math.random() * ALEX_NOTES.length);
        while (usedNoteIdx.has(i)) i = (i + 1) % ALEX_NOTES.length;
        usedNoteIdx.add(i);
        return ALEX_NOTES[i];
      };

      const noteHeader = this.ctx.scene.add.text(panelX + 8, panelY - 16, '— notas de A. —', {
        fontFamily: FONT_STACK, fontSize: '8px', color: '#ff2e9f', fontStyle: 'bold italic',
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 4);
      els.push(noteHeader);

      const revealNoteAt = (slot: number, text: string) => {
        const Y_PER_SLOT = 42;
        const yPos = panelY + slot * Y_PER_SLOT;
        const target = '"' + text + '"';
        const matrixChars = 'アイウエオカキクケコ0123456789ABCDEF#@$%&*';
        const noteText = this.ctx.scene.add
          .text(panelX + 8, yPos, '', {
            fontFamily: FONT_STACK, fontSize: '9px', color: '#ff2e9f', fontStyle: 'bold',
            wordWrap: { width: panelW - 16, useAdvancedWrap: true }, lineSpacing: 3,
            stroke: '#000000', strokeThickness: 2,
          }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 4).setAlpha(0);
        notesEls.push(noteText);
        els.push(noteText);
        this.ctx.scene.tweens.add({ targets: noteText, alpha: 1, duration: 400 });

        let charIdx = 0;
        const renderProgress = (donePass: boolean) => {
          if (!noteText.scene) return;
          let out = '';
          for (let i = 0; i < target.length; i++) {
            if (i < charIdx || donePass) {
              out += target[i];
            } else {
              const c = target[i];
              if (c === ' ' || c === String.fromCharCode(10)) out += c;
              else out += matrixChars[Math.floor(Math.random() * matrixChars.length)];
            }
          }
          noteText.setText(out);
        };
        const tick = this.ctx.scene.time.addEvent({
          delay: 35, loop: true,
          callback: () => {
            charIdx += 1;
            renderProgress(false);
            if (charIdx >= target.length) {
              tick.remove();
              renderProgress(true);
            }
          },
        });
        renderProgress(false);
      };

      // 2 notas — la primera a 1.5s, la segunda a 4.5s (cuando la primera
      // ya ha terminado de escribirse). Escalonado para que se lea cada una.
      this.ctx.scene.time.delayedCall(1500, () => revealNoteAt(0, pickNextNote()));
      this.ctx.scene.time.delayedCall(4500, () => revealNoteAt(1, pickNextNote()));

      const cleanup = () => {
        window.removeEventListener('keydown', onKey);
        if (timer) timer.remove();
        if (matrixTimer) matrixTimer.remove();
        // S2.8: mata cualquier tween activo de las notas + destruye historial.
        try {
          for (const n of notesEls) {
            if ((n as { scene?: unknown }).scene) {
              this.ctx.scene.tweens.killTweensOf(n);
              n.destroy();
            }
          }
          notesEls.length = 0;
        } catch { /* ignore */ }
        for (const o of els) if ((o as { scene?: unknown }).scene) o.destroy();
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        const k = e.key;
        if (k === 'Escape' || k === 'Esc') { e.preventDefault(); cleanup(); return; }
        if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
          e.preventDefault();
          if (!done) {
            finishAll();
          } else {
            cleanup();
          }
        }
      };
      window.addEventListener('keydown', onKey);
    });
  }


  /** S2.7: animación Matrix-hack al traducir el serial completo del
   *  Tomodachi Life. Tres fases:
   *    1. "ACCESS GRANTED" + glitch en pantalla.
   *    2. Pantallas de carga falsas con barras ASCII.
   *    3. Una decisión narrativa (María elige path).
   *    4. Reveal: "regalo añadido al repositorio" → unlockGift('tomodachi').
   */
  private runTomodachiUnlockAnim(parentEls: Phaser.GameObjects.GameObject[], onDone: () => void): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = this.ctx.scene.cameras.main;
      const W = cam.width, H = cam.height;
      const D = PANEL_DEPTH + 50;
      const els: Phaser.GameObjects.GameObject[] = [];

      // Background full negro encima del terminal.
      const bg = this.ctx.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1)
        .setScrollFactor(0).setDepth(D);
      els.push(bg);

      // Matrix rain encima.
      const matrixChars = 'アイウエオカキクケコ0123456789#@%&*+ABCDEF';
      type Col = { x: number; y: number; speed: number; text: Phaser.GameObjects.Text };
      const cols: Col[] = [];
      const NUM_COLS = Math.floor(W / 8);
      for (let i = 0; i < NUM_COLS; i++) {
        const t = this.ctx.scene.add.text(i * 8, Math.random() * H, '', {
          fontFamily: 'monospace', fontSize: '10px', color: '#22c55e',
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 1).setAlpha(0.7);
        els.push(t);
        cols.push({ x: i * 8, y: Math.random() * H, speed: 1.5 + Math.random() * 3, text: t });
      }
      const matrixTimer = this.ctx.scene.time.addEvent({
        delay: 40, loop: true,
        callback: () => {
          for (const c of cols) {
            c.y += c.speed * 6;
            if (c.y > H + 20) c.y = -20;
            c.text.setText(matrixChars[Math.floor(Math.random() * matrixChars.length)]);
            c.text.setPosition(c.x, c.y);
          }
        },
      });

      const phaseText = this.ctx.scene.add.text(W / 2, H / 2, '', {
        fontFamily: FONT_STACK, fontSize: '16px', color: '#22c55e', fontStyle: 'bold',
        align: 'center', lineSpacing: 4,
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5);
      els.push(phaseText);

      const subText = this.ctx.scene.add.text(W / 2, H / 2 + 24, '', {
        fontFamily: FONT_STACK, fontSize: '9px', color: '#5eead4',
        align: 'center', wordWrap: { width: W - 40, useAdvancedWrap: true }, lineSpacing: 3,
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5);
      els.push(subText);

      const wait = (ms: number) => new Promise<void>((r) => this.ctx.scene.time.delayedCall(ms, () => r()));
      const flash = () => {
        const f = this.ctx.scene.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.8)
          .setScrollFactor(0).setDepth(D + 10);
        this.ctx.scene.tweens.add({ targets: f, alpha: 0, duration: 200, onComplete: () => f.destroy() });
      };

      const askChoice = async (q: string, opts: string[]): Promise<number> => {
        phaseText.setText(q).setColor('#fbbf24');
        subText.setText('');
        let cursor = 0;
        const optTexts = opts.map((o, i) =>
          this.ctx.scene.add.text(W / 2, H / 2 + 50 + i * 18, '   ' + o, {
            fontFamily: FONT_STACK, fontSize: '11px', color: i === 0 ? '#22c55e' : '#888888',
          }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
        );
        els.push(...optTexts);
        const render = () => {
          for (let i = 0; i < opts.length; i++) {
            optTexts[i].setText((i === cursor ? '▸ ' : '  ') + opts[i]);
            optTexts[i].setColor(i === cursor ? '#22c55e' : '#888888');
          }
        };
        render();
        return new Promise<number>((res) => {
          const kh = (e: KeyboardEvent) => {
            const k = e.key;
            if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); cursor = (cursor - 1 + opts.length) % opts.length; render(); }
            else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); cursor = (cursor + 1) % opts.length; render(); }
            else if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
              e.preventDefault();
              window.removeEventListener('keydown', kh);
              for (const t of optTexts) t.destroy();
              res(cursor);
            }
          };
          window.addEventListener('keydown', kh);
        });
      };

      const fakeProgress = async (label: string, ms: number) => {
        phaseText.setText('').setColor('#22c55e');
        subText.setText(label).setColor('#22c55e');
        const start = Date.now();
        const W2 = 280;
        const bar = this.ctx.scene.add.text(W / 2, H / 2, '[' + ' '.repeat(28) + '] 0%', {
          fontFamily: FONT_STACK, fontSize: '12px', color: '#22c55e', fontStyle: 'bold',
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5);
        els.push(bar);
        while (true) {
          const t = (Date.now() - start) / ms;
          if (t >= 1) break;
          const filled = Math.floor(t * 28);
          bar.setText('[' + '█'.repeat(filled) + ' '.repeat(28 - filled) + '] ' + Math.floor(t * 100) + '%');
          await wait(60);
        }
        bar.setText('[' + '█'.repeat(28) + '] 100%').setColor('#fbbf24');
        await wait(300);
        bar.destroy();
      };

      const run = async () => {
        // Fase 1: ACCESS GRANTED + flash
        await wait(400);
        flash();
        phaseText.setText('ACCESS GRANTED').setColor('#22c55e');
        subText.setText(HAS_REAL_SERIAL
          ? 'serial nintendo eshop verified'
          : 'serial DEMO — configura secrets.local.ts');
        this.ctx.scene.cameras.main.shake(280, 0.005);
        await wait(1400);

        // Fase 2: fake progress bars
        phaseText.setText('');
        await fakeProgress('decrypting payload from safe vault...', 1300);
        await fakeProgress('bypassing nintendo region lock...', 1100);
        await fakeProgress('writing key to gift repository...', 1500);

        // Fase 3: decisión narrativa
        const choice = await askChoice(
          'PAYLOAD READY.',
          [
            'enviar a Regalos.exe (oficial)',
            'reenviar por correo a Alex',
            'imprimir en papel térmico',
          ],
        );
        phaseText.setText('').setColor('#22c55e');
        subText.setText([
          'ruta seleccionada: ',
          choice === 0 ? 'gift repository' : choice === 1 ? 'mail outbox' : 'thermal printer',
        ].join('')).setColor('#fbbf24');
        await wait(900);

        // Fase 4: unlock
        try {
          (useProgressStore.getState() as { unlockGift?: (id: string) => void }).unlockGift?.('tomodachi');
        } catch { /* ignore */ }
        phaseText.setText('+ REGALO AÑADIDO\nTOMODACHI LIFE — SWITCH').setColor('#ff2e9f');
        subText.setText('"abre Regalos.exe en el PC de María para verlo."').setColor('#fbcfe8');
        flash();
        this.ctx.scene.cameras.main.shake(200, 0.008);
        await wait(2800);

        // Cleanup
        if (matrixTimer) matrixTimer.remove();
        for (const o of els) if ((o as { scene?: unknown }).scene) o.destroy();
        onDone();
        resolve();
      };
      void run();
    });
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
    for (const o of this.layer) if ((o as any).scene) o.destroy();
    this.layer = [];
    this.resolveOuter({ success: true, reason: 'completed' });
  }
}

// ═════════════════════════════════════════════════════════════════════
//  CAJA FUERTE (habitación secreta) — PIN dial + papel con morse dentro
// ═════════════════════════════════════════════════════════════════════

/**
 * Caja fuerte: dial de 4 dígitos. Player ajusta cada dígito 0-9 con
 * arrows. ENTER valida. Pin correcto: 1105 (fecha cumple María).
 * Al abrir, revela un papel con el SERIAL EN MORSE para descifrar en
 * el PC de Alex via morse-decode.sh.
 */
const SAFE_PIN = '1105';
// S2.8: Serial real cargado de secrets.local.ts (no commiteado).
const TOMODACHI_SERIAL_REAL = TOMODACHI_SERIAL;
// Morse sin guiones ni espacios — UN espacio entre letras, sin separadores de palabra.
const TOMODACHI_MORSE = toMorse(TOMODACHI_SERIAL_REAL.replace(/[-\s/]/g, ''));
// Para chequear contra el desciframiento del usuario.
const TOMODACHI_SERIAL_CLEAN = TOMODACHI_SERIAL_REAL.replace(/[-\s/]/g, '').toUpperCase();
if (typeof window !== 'undefined' && !HAS_REAL_SERIAL) {
  // eslint-disable-next-line no-console
  console.warn('[Tomodachi] Sin serial real. Demo: ' + TOMODACHI_SERIAL_CLEAN);
}

export const runSafeMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>((resolve) => {
    const cam = ctx.scene.cameras.main;
    const W = cam.width, H = cam.height;
    const cx = W / 2, cy = H / 2;
    const D = PANEL_DEPTH;
    const els: Phaser.GameObjects.GameObject[] = [];
    const alreadyUnlocked = useProgressStore.getState().safeUnlocked;

    // ─── State & cleanup (declarados ARRIBA para evitar TDZ) ────────
    let cleaned = false;
    let mode: 'dial' | 'paper' = alreadyUnlocked ? 'paper' : 'dial';
    let onKey: (e: KeyboardEvent) => void = () => {};

    const cleanup = (success: boolean) => {
      if (cleaned) return;
      cleaned = true;
      window.removeEventListener('keydown', onKey);
      for (const o of els) if ((o as { scene?: unknown }).scene) o.destroy();
      els.length = 0;
      resolve({ success, reason: success ? 'completed' : 'aborted' });
    };

    // ─── Backdrop común ─────────────────────────────────────────────
    const backdrop = ctx.scene.add.rectangle(cx, cy, W, H, 0x1a0a08, 1)
      .setScrollFactor(0).setDepth(D);
    const titleText = ctx.scene.add.text(cx, 16, '', {
      fontFamily: FONT_STACK, fontSize: '14px', color: '#fbbf24', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 1);
    els.push(backdrop, titleText);

    // El contenido específico de cada modo se guarda aquí para destruirlo
    // al cambiar de modo sin tocar el backdrop.
    let modeEls: Phaser.GameObjects.GameObject[] = [];
    const clearModeEls = () => {
      for (const o of modeEls) if ((o as { scene?: unknown }).scene) o.destroy();
      modeEls = [];
    };

    // ─── PAPER MODE (caja abierta — muestra el morse) ───────────────
    const showPaper = () => {
      mode = 'paper';
      titleText.setText('CAJA FUERTE — ABIERTA');
      clearModeEls();
      modeEls.push(
        ctx.scene.add.rectangle(cx, cy, W - 60, H - 60, 0xf5ecd6, 1)
          .setStrokeStyle(2, 0x6b4425, 1).setScrollFactor(0).setDepth(D + 2),
        ctx.scene.add.text(cx, cy - 80, '✤ PAPEL ENCONTRADO ✤', {
          fontFamily: "'EB Garamond', serif", fontSize: '12px', color: '#2a1810', fontStyle: 'bold',
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 3),
        ctx.scene.add.text(cx, cy - 56, '"descifra esto en el PC de Alex"', {
          fontFamily: "'EB Garamond', serif", fontSize: '10px', color: '#2a1810', fontStyle: 'italic',
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 3),
        // ⚠ AVISO grande sobre espacios — lo más prominente.
        ctx.scene.add.rectangle(cx, cy - 28, W - 100, 22, 0xb91c1c, 1)
          .setScrollFactor(0).setDepth(D + 3),
        ctx.scene.add.text(cx, cy - 28, '⚠ CUIDADO CON LOS ESPACIOS ⚠', {
          fontFamily: FONT_STACK, fontSize: '11px', color: '#fafaf5', fontStyle: 'bold',
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 4),
        // El morse en grande, multilínea si hace falta.
        ctx.scene.add.text(cx, cy + 8, TOMODACHI_MORSE, {
          fontFamily: FONT_STACK, fontSize: '10px', color: '#1a0e08', fontStyle: 'bold',
          align: 'center', wordWrap: { width: W - 100, useAdvancedWrap: true }, lineSpacing: 5,
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 3),
        ctx.scene.add.text(cx, H - 14, 'ESC / E cerrar caja fuerte', S.hint())
          .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 4),
      );
      els.push(...modeEls);
    };

    // ─── DIAL MODE (4 dígitos PIN) ──────────────────────────────────
    const digits = [0, 0, 0, 0];
    let activeDigit = 0;
    const dialW = 32;
    const dialX0 = cx - (dialW * 4 + 12) / 2 + dialW / 2;
    const digitTexts: Phaser.GameObjects.Text[] = [];
    let cursorRect: Phaser.GameObjects.Rectangle | null = null;
    let statusText: Phaser.GameObjects.Text | null = null;

    const refreshDial = () => {
      for (let i = 0; i < 4; i++) digitTexts[i]?.setText(String(digits[i]));
      cursorRect?.setPosition(dialX0 + activeDigit * (dialW + 4), cy);
    };

    const showDial = () => {
      mode = 'dial';
      titleText.setText('CAJA FUERTE');
      clearModeEls();
      digitTexts.length = 0;
      for (let i = 0; i < 4; i++) {
        const dx = dialX0 + i * (dialW + 4);
        modeEls.push(
          ctx.scene.add.rectangle(dx, cy, dialW - 4, 40, 0x3a2a1a, 1)
            .setStrokeStyle(2, 0x6b4425, 1).setScrollFactor(0).setDepth(D + 2),
        );
        const t = ctx.scene.add.text(dx, cy, '0', {
          fontFamily: FONT_STACK, fontSize: '20px', color: '#fbbf24', fontStyle: 'bold',
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 3);
        digitTexts.push(t);
        modeEls.push(t);
      }
      cursorRect = ctx.scene.add.rectangle(0, cy, dialW, 44)
        .setStrokeStyle(2, 0xff2e9f, 1).setScrollFactor(0).setDepth(D + 4);
      modeEls.push(cursorRect);
      const hint = ctx.scene.add.text(cx, H - 32, 'pista: la fecha que más le gusta a María', {
        fontFamily: FONT_STACK, fontSize: '9px', color: '#9ca3af', fontStyle: 'italic',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 4);
      const controls = ctx.scene.add.text(cx, H - 14, '←/→ dígito  ·  ↑/↓ valor  ·  ENTER abrir  ·  ESC salir', S.hint())
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 4);
      statusText = ctx.scene.add.text(cx, cy + 50, '', {
        fontFamily: FONT_STACK, fontSize: '10px', color: '#ef4444', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 4);
      modeEls.push(hint, controls, statusText);
      els.push(...modeEls);
      refreshDial();
    };

    // ─── Input handler ──────────────────────────────────────────────
    onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (mode === 'paper') {
        if (k === 'Escape' || k === 'Esc' || k === 'e' || k === 'E') {
          e.preventDefault();
          cleanup(true);
        }
        return;
      }
      // DIAL MODE
      if (k === 'Escape' || k === 'Esc') { e.preventDefault(); cleanup(false); return; }
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        e.preventDefault(); activeDigit = (activeDigit - 1 + 4) % 4; refreshDial();
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        e.preventDefault(); activeDigit = (activeDigit + 1) % 4; refreshDial();
      } else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
        e.preventDefault(); Sfx.tick(); digits[activeDigit] = (digits[activeDigit] + 1) % 10; refreshDial();
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        e.preventDefault(); Sfx.tick(); digits[activeDigit] = (digits[activeDigit] + 9) % 10; refreshDial();
      } else if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        const pin = digits.join('');
        if (pin === SAFE_PIN) {
          useProgressStore.getState().setSafeUnlocked(true); Sfx.unlock();
          statusText?.setText('✓ PIN correcto. abriendo...').setColor('#4ade80');
          ctx.scene.time.delayedCall(800, () => {
            if (!cleaned) showPaper();
          });
        } else {
          statusText?.setText('✗ PIN incorrecto').setColor('#ef4444');
        }
      }
    };
    window.addEventListener('keydown', onKey);

    // ─── Init mode ──────────────────────────────────────────────────
    if (alreadyUnlocked) {
      showPaper();
    } else {
      showDial();
    }
  });
};

// ═════════════════════════════════════════════════════════════════════
//  ESCAPE HATCH PIN — keypad en la escotilla (4 dígitos = última del PIN del cumple, 0526)
// ═════════════════════════════════════════════════════════════════════

/**
 * Cuando la hatch está unlocked (vía PC Alex code), interactuar te
 * lleva al "lobby próximamente". Antes de ese paso te pide el PIN
 * adicional del cumple "0526" como sello final antes del lobby.
 */
const HATCH_PIN = '0526';

export const runHatchPinMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>((resolve) => {
    const cam = ctx.scene.cameras.main;
    const W = cam.width, H = cam.height;
    const cx = W / 2, cy = H / 2;
    const D = PANEL_DEPTH;
    const els: Phaser.GameObjects.GameObject[] = [];
    els.push(
      ctx.scene.add.rectangle(cx, cy, W, H, 0x0a0a14, 1).setScrollFactor(0).setDepth(D),
      ctx.scene.add.text(cx, 24, 'ESCOTILLA', { fontFamily: FONT_STACK, fontSize: '14px', color: '#00e5ff', fontStyle: 'bold' })
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 1),
      ctx.scene.add.text(cx, 44, '"último sello antes del lobby"', { fontFamily: FONT_STACK, fontSize: '8px', color: '#fbcfe8', fontStyle: 'italic' })
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 1),
    );
    const digits = [0, 0, 0, 0];
    let activeDigit = 0;
    const dialY = cy;
    const dialW = 36;
    const dialX0 = cx - (dialW * 4 + 16) / 2 + dialW / 2;
    const digitTexts: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < 4; i++) {
      const dx = dialX0 + i * (dialW + 6);
      els.push(
        ctx.scene.add.rectangle(dx, dialY, dialW - 6, 44, 0x14233a, 1)
          .setStrokeStyle(2, 0x00e5ff, 1).setScrollFactor(0).setDepth(D + 2),
      );
      const t = ctx.scene.add.text(dx, dialY, '0', {
        fontFamily: FONT_STACK, fontSize: '22px', color: '#00e5ff', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 3);
      digitTexts.push(t);
      els.push(t);
    }
    const cursorRect = ctx.scene.add.rectangle(0, dialY, dialW, 48)
      .setStrokeStyle(2, 0xff2e9f, 1).setScrollFactor(0).setDepth(D + 4);
    els.push(cursorRect);
    const refresh = () => {
      for (let i = 0; i < 4; i++) digitTexts[i].setText(String(digits[i]));
      cursorRect.setPosition(dialX0 + activeDigit * (dialW + 6), dialY);
    };
    refresh();
    const hint = ctx.scene.add.text(cx, H - 32, 'pista: mes y día del cumple, MMDD', {
      fontFamily: FONT_STACK, fontSize: '9px', color: '#9ca3af', fontStyle: 'italic',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 4);

    const status = ctx.scene.add.text(cx, cy + 50, '', {
      fontFamily: FONT_STACK, fontSize: '10px', color: '#ef4444', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 4);
    const controls = ctx.scene.add.text(cx, H - 14, '←/→ dígito  ·  ↑/↓ valor  ·  ENTER  ·  ESC salir', S.hint())
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 4);
    els.push(hint, status, controls);

    let cleaned = false;
    let onKey: (e: KeyboardEvent) => void = () => {};
    const cleanup = (success: boolean) => {
      if (cleaned) return;
      cleaned = true;
      window.removeEventListener('keydown', onKey);
      for (const o of els) if ((o as { scene?: unknown }).scene) o.destroy();
      resolve({ success, reason: success ? 'completed' : 'aborted' });
    };
    onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'Escape' || k === 'Esc') { e.preventDefault(); cleanup(false); return; }
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); activeDigit = (activeDigit - 1 + 4) % 4; refresh(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); activeDigit = (activeDigit + 1) % 4; refresh(); }
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); digits[activeDigit] = (digits[activeDigit] + 1) % 10; refresh(); }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); digits[activeDigit] = (digits[activeDigit] + 9) % 10; refresh(); }
      else if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        if (digits.join('') === HATCH_PIN) {
          status.setText('✓ entrando al lobby...').setColor('#4ade80');
          ctx.scene.time.delayedCall(900, () => cleanup(true));
        } else {
          status.setText('✗ PIN incorrecto').setColor('#ef4444');
        }
      }
    };
    window.addEventListener('keydown', onKey);
  });
};
