import * as Phaser from 'phaser';
import type { MinigameContext, MinigameResult, MinigameRunner } from '../types';
import { S, COLORS, FONT_STACK } from '../../systems/TextStyle';
import { useProgressStore } from '@/lib/stores/gameStore';
import { GIFTS, type Gift } from '../../data/gifts';
import type { GiftId, RedemptionData } from '@/lib/stores/gameStore';
import { TOMODACHI_SERIAL } from '../../data/secrets';
import { Sfx } from '../../systems/SfxBank';

/**
 * PC MARÍA — Sistema operativo (S2.5).
 *
 * 4 apps: Regalos.exe / Calendario.exe / Multimedia.exe / Minijuegos.exe.
 * Grid 2×2 separado (iconos grandes ocupando más pantalla).
 *
 * REGALOS: los 3 regalos aparecen TODOS disponibles desde el primer
 * arranque del PC. Antes de canjear sólo se ve la fuente ("de Haku")
 * y "???" — al canjear se REVELA el título + descripción + acción.
 *
 * CALENDARIO: 12 meses 2026, cada mes con wallpaper propio. Click
 * sobre día → escribir nota (persistida). El wallpaper del mes ACTUAL
 * está desbloqueado siempre; pasados también; futuros bloqueados.
 *
 * MULTIMEDIA: viewer de archivos en /assets/multimedia/.
 *
 * MINIJUEGOS: hub con Stack Game (funcional) + Connect 4 + Jinx
 * Shootout (los dos últimos placeholder por tiempo).
 */

const PANEL_DEPTH = 2400;

/** Da formato XXXX-XXXX-XXXX-XXXX al serial de 16 caracteres de Nintendo. */
function formatTomodachiSerial(s: string): string {
  const clean = s.replace(/[-\s/]/g, '').toUpperCase();
  if (clean.length !== 16) return s; // si no son 16, lo dejamos tal cual
  return clean.slice(0, 4) + '-' + clean.slice(4, 8) + '-' + clean.slice(8, 12) + '-' + clean.slice(12, 16);
}

export const runPcMariaMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>((resolve) => {
    new PcMariaShell(ctx, resolve).start();
  });
};

interface AppDef {
  id: string;
  label: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  open: () => Promise<void>;
}

class PcMariaShell {
  private ctx: MinigameContext;
  private resolveOuter: (r: MinigameResult) => void;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private apps: AppDef[] = [];
  private cursor = 0;
  private cursorMark!: Phaser.GameObjects.Rectangle;
  private clockText!: Phaser.GameObjects.Text;
  private clockTimer: Phaser.Time.TimerEvent | null = null;
  private finished = false;
  private appOpen = false;
  private keyDownHandler!: (e: KeyboardEvent) => void;
  private iconPositions: { x: number; y: number }[] = [];

  constructor(ctx: MinigameContext, resolve: (r: MinigameResult) => void) {
    this.ctx = ctx;
    this.resolveOuter = resolve;
    this.apps = [
      { id: 'regalos', label: 'Regalos', icon: '♥', iconColor: '#ff8ab8', bgColor: '#3a1a2a', open: () => this.openRegalosApp() },
      { id: 'calendar', label: 'Calendario', icon: '▣', iconColor: '#5eead4', bgColor: '#1a3a3a', open: () => this.openCalendarApp() },
      { id: 'media', label: 'Multimedia', icon: '▶', iconColor: '#fbbf24', bgColor: '#3a3a1a', open: () => this.openMultimediaApp() },
      { id: 'games', label: 'Minijuegos', icon: '◊', iconColor: '#a78bfa', bgColor: '#2a1a3a', open: () => this.openMinigamesApp() },
    ];
  }

  start(): void {
    this.buildDesktop();
    this.bindInput();
  }

  // ─── DESKTOP ──────────────────────────────────────────────────────

  private buildDesktop(): void {
    const cam = this.ctx.scene.cameras.main;
    const W = cam.width;
    const H = cam.height;

    // Wallpaper.
    this.layer.push(
      this.ctx.scene.add.rectangle(W / 2, H / 2, W, H, 0x2a1a3a, 1).setScrollFactor(0).setDepth(PANEL_DEPTH),
      this.ctx.scene.add.rectangle(W / 2, H * 0.7, W, H * 0.6, 0x4a2a5a, 0.5).setScrollFactor(0).setDepth(PANEL_DEPTH + 1),
    );
    // Estrellitas.
    for (let i = 0; i < 30; i++) {
      const s = this.ctx.scene.add
        .circle(Math.random() * W, Math.random() * (H - 30), Math.random() < 0.5 ? 1 : 0.5, 0xfafaf5, Math.random() * 0.5 + 0.3)
        .setScrollFactor(0).setDepth(PANEL_DEPTH + 2);
      this.layer.push(s);
    }

    // Header.
    this.layer.push(
      this.ctx.scene.add.text(W / 2, 12, '— PC de María —', { fontFamily: FONT_STACK, fontSize: '8px', color: '#fbcfe8', fontStyle: 'italic' })
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(PANEL_DEPTH + 5),
    );

    // Grid 2x2 GRANDE — ocupa mayoría del PC.
    const iconSize = 70;
    const iconGap = 40;
    const gridW = iconSize * 2 + iconGap;
    const gridH = iconSize * 2 + iconGap;
    const startX = (W - gridW) / 2;
    const startY = (H - gridH) / 2 - 6;
    this.iconPositions = [];

    for (let i = 0; i < this.apps.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ix = startX + col * (iconSize + iconGap);
      const iy = startY + row * (iconSize + iconGap);
      const app = this.apps[i];
      const cx = ix + iconSize / 2;
      const cy = iy + iconSize / 2;
      this.iconPositions.push({ x: cx, y: cy });

      this.layer.push(
        this.ctx.scene.add.rectangle(cx, cy, iconSize, iconSize, parseInt(app.bgColor.slice(1), 16), 1)
          .setStrokeStyle(2, parseInt(app.iconColor.slice(1), 16), 1)
          .setScrollFactor(0).setDepth(PANEL_DEPTH + 3),
        this.ctx.scene.add.text(cx, cy - 4, app.icon, { fontFamily: FONT_STACK, fontSize: '34px', color: app.iconColor, fontStyle: 'bold' })
          .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(PANEL_DEPTH + 4),
        this.ctx.scene.add.text(cx, iy + iconSize + 8, app.label, { fontFamily: FONT_STACK, fontSize: '11px', color: COLORS.textWhite, fontStyle: 'bold' })
          .setOrigin(0.5, 0).setScrollFactor(0).setDepth(PANEL_DEPTH + 4),
      );
    }

    // Cursor.
    this.cursorMark = this.ctx.scene.add.rectangle(this.iconPositions[0].x, this.iconPositions[0].y, iconSize + 8, iconSize + 8)
      .setStrokeStyle(3, 0xfbbf24, 1).setScrollFactor(0).setDepth(PANEL_DEPTH + 5);
    this.layer.push(this.cursorMark);

    // Taskbar + reloj.
    this.layer.push(
      this.ctx.scene.add.rectangle(W / 2, H - 8, W, 16, 0x1a0e2a, 1).setScrollFactor(0).setDepth(PANEL_DEPTH + 6),
      this.ctx.scene.add.text(8, H - 8, '◇ The Flat OS', { fontFamily: FONT_STACK, fontSize: '8px', color: '#fbcfe8', fontStyle: 'bold' })
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(PANEL_DEPTH + 7),
    );
    this.clockText = this.ctx.scene.add.text(W - 8, H - 8, '', { fontFamily: FONT_STACK, fontSize: '8px', color: '#fbcfe8' })
      .setOrigin(1, 0.5).setScrollFactor(0).setDepth(PANEL_DEPTH + 7);
    this.layer.push(this.clockText);
    this.updateClock();
    this.clockTimer = this.ctx.scene.time.addEvent({ delay: 30000, loop: true, callback: () => this.updateClock() });

    // Hint.
    this.layer.push(
      this.ctx.scene.add.text(W / 2, H - 22, '↑/↓/←/→ navegar  ·  ENTER abrir  ·  ESC apagar', S.hint())
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(PANEL_DEPTH + 7),
    );
  }

  private updateClock(): void {
    if (!this.clockText.scene) return;
    const now = new Date();
    this.clockText.setText(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  }

  private moveCursor(dx: number, dy: number): void { Sfx.click();
    const cols = 2, rows = 2;
    let col = this.cursor % cols, row = Math.floor(this.cursor / cols);
    col = (col + dx + cols) % cols;
    row = (row + dy + rows) % rows;
    this.cursor = row * cols + col;
    const pos = this.iconPositions[this.cursor];
    this.cursorMark.setPosition(pos.x, pos.y);
  }

  private bindInput(): void {
    this.keyDownHandler = (e: KeyboardEvent) => {
      if (this.finished || this.appOpen) return;
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); this.moveCursor(-1, 0); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); this.moveCursor(1, 0); }
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); this.moveCursor(0, -1); }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); this.moveCursor(0, 1); }
      else if (k === ' ' || k === 'Spacebar' || k === 'Enter') { e.preventDefault(); void this.openCurrentApp(); }
      else if (k === 'Escape' || k === 'Esc') { e.preventDefault(); this.finish(); }
    };
    window.addEventListener('keydown', this.keyDownHandler);
    this.ctx.scene.events.once('shutdown', () => this.finish());
    this.ctx.scene.events.once('destroy', () => this.finish());
  }

  private async openCurrentApp(): Promise<void> {
    const app = this.apps[this.cursor];
    if (!app) return;
    this.appOpen = true;
    try { await app.open(); } finally { this.appOpen = false; }
  }

  // ─── REGALOS.EXE ──────────────────────────────────────────────────

  private openRegalosApp(): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = this.ctx.scene.cameras.main;
      const W = cam.width, H = cam.height;
      const PW = W - 30, PH = H - 30, cx = W / 2, cy = H / 2;
      const D = PANEL_DEPTH + 20;
      const els: Phaser.GameObjects.GameObject[] = [];

      els.push(
        this.ctx.scene.add.rectangle(cx, cy, W, H, 0x000000, 0.4).setScrollFactor(0).setDepth(D),
        this.ctx.scene.add.rectangle(cx, cy, PW + 4, PH + 4, 0xff8ab8, 1).setScrollFactor(0).setDepth(D + 1),
        this.ctx.scene.add.rectangle(cx, cy, PW, PH, 0x1a0e2a, 1).setScrollFactor(0).setDepth(D + 2),
        this.ctx.scene.add.rectangle(cx, cy - PH / 2 + 8, PW, 16, 0xff8ab8, 1).setScrollFactor(0).setDepth(D + 3),
        this.ctx.scene.add.text(cx - PW / 2 + 8, cy - PH / 2 + 8, '♥ Regalos.exe', { fontFamily: FONT_STACK, fontSize: '9px', color: '#1a0e2a', fontStyle: 'bold' })
          .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 4),
      );

      // S2.5: TODOS los regalos disponibles desde el primer arranque.
      // El "secreto" es lo que ES cada regalo (revelado al canjear).
      // S2.8: 3 cards base + 4ª (tomodachi) SOLO si está unlocked vía morse.
      const baseGiftIds: GiftId[] = ['cena', 'misterioso', 'escapada'];
      let giftIds: GiftId[] = baseGiftIds.slice();
      const cardW = (PW - 60) / 3, cardH = PH - 80, cardY = cy + 4;
      let activeIdx = 0;

      // Función para refrescar las cards (al canjear se vuelve a llamar).
      const cardEls: Phaser.GameObjects.GameObject[][] = [];
      const renderCards = () => {
        for (const arr of cardEls) for (const o of arr) if ((o as any).scene) o.destroy();
        cardEls.length = 0;

        const st = useProgressStore.getState();
        // S2.8: añadir tomodachi sólo si está unlocked (aparece como 4ª card pequeña abajo).
        const tomodachiUnlocked = st.unlockedGifts.includes('tomodachi');
        giftIds = tomodachiUnlocked ? [...baseGiftIds, 'tomodachi'] : baseGiftIds.slice();
        for (let _i = 0; _i < giftIds.length; _i++) cardEls.push([]);
        const redeemed = st.redeemedGifts;
        const unlocked = st.unlockedGifts;
        for (let i = 0; i < giftIds.length; i++) {
          const id = giftIds[i];
          const gift = GIFTS[id];
          // S2.8: las 3 base ocupan la fila superior. Tomodachi se pinta
          // aparte tras el bucle con flip.
          if (id === 'tomodachi') continue;
          const cardX = cx - PW / 2 + 30 + i * (cardW + 10) + cardW / 2;
          const isRedeemed = redeemed[id] !== undefined;
          // S2.7: una carta sólo se puede canjear si está DESBLOQUEADA
          // (i.e., el minijuego del gato correspondiente está superado).
          const isUnlocked = unlocked.includes(id);
          const accent = parseInt(gift.accent.slice(1), 16);

          cardEls[i].push(
            this.ctx.scene.add.rectangle(cardX, cardY, cardW + 2, cardH + 2, accent, isUnlocked ? 1 : 0.35).setScrollFactor(0).setDepth(D + 3),
            this.ctx.scene.add.rectangle(cardX, cardY, cardW, cardH, 0x2a1a3a, 1).setScrollFactor(0).setDepth(D + 4),
          );

          // Reveal lógica:
          //   - bloqueado → '???' + texto "completa el juego del gato"
          //   - desbloqueado pero no canjeado → '???' + "canjea para descubrir"
          //   - canjeado → título + desc real
          let title: string;
          let desc: string;
          if (isRedeemed) {
            title = gift.title;
            desc = gift.description;
          } else if (isUnlocked) {
            title = '???';
            desc = gift.mysterious
              ? 'un sobre cerrado.\ncanjea para descubrir.'
              : 'un regalo.\ncanjea para descubrir.';
          } else {
            title = '🔒 BLOQUEADO';
            desc = 'completa el minijuego\nde ' + (gift.source ?? 'tu gato') + '\npara desbloquear.';
          }

          const titleColor = isUnlocked ? gift.accent : '#6b7280';
          const cta = isRedeemed
            ? '✓ CANJEADO'
            : (isUnlocked ? 'CANJEAR ♥' : '— bloqueado —');
          const ctaColor = isRedeemed ? '#4ade80' : (isUnlocked ? gift.accent : '#6b7280');

          cardEls[i].push(
            this.ctx.scene.add.text(cardX, cardY - cardH / 2 + 14, title, { fontFamily: FONT_STACK, fontSize: '11px', color: titleColor, fontStyle: 'bold' })
              .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
            this.ctx.scene.add.text(cardX, cardY - cardH / 2 + 30, 'de ' + gift.source, { fontFamily: FONT_STACK, fontSize: '8px', color: '#9ca3af', fontStyle: 'italic' })
              .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
            this.ctx.scene.add.text(cardX, cardY, desc, { fontFamily: FONT_STACK, fontSize: '8px', color: isUnlocked ? '#fbcfe8' : '#9ca3af', align: 'center', wordWrap: { width: cardW - 16, useAdvancedWrap: true }, lineSpacing: 2 })
              .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
            this.ctx.scene.add.text(cardX, cardY + cardH / 2 - 16, cta, { fontFamily: FONT_STACK, fontSize: '9px', color: ctaColor, fontStyle: 'bold' })
              .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
          );

          // Si es misterioso canjeado, muestra el código del sobre.
          if (isRedeemed && gift.mysterious && gift.secretCode) {
            cardEls[i].push(
              this.ctx.scene.add.text(cardX, cardY + cardH / 2 - 32, gift.secretCode, { fontFamily: FONT_STACK, fontSize: '8px', color: '#fbbf24', fontStyle: 'bold' })
                .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
            );
          }
        }

        // ─── S2.8: Tomodachi card flip (aparte) ──────────────────────
        if (tomodachiUnlocked) {
          const tomIdx = giftIds.indexOf('tomodachi');
          if (tomIdx >= 0) {
            const arr = cardEls[tomIdx];
            const tGift = GIFTS.tomodachi;
            const isTomRedeemed = redeemed.tomodachi !== undefined;
            const tW = 180, tH = 50;
            const tX = cx;
            const tY = cy + cardH / 2 + 24; // debajo de la fila normal
            const tAccent = parseInt(tGift.accent.slice(1), 16);
            // Card frame con tint para sensación de "sobre".
            const frame = this.ctx.scene.add.rectangle(tX, tY, tW + 4, tH + 4, tAccent, 1)
              .setScrollFactor(0).setDepth(D + 6);
            const bg = this.ctx.scene.add.rectangle(tX, tY, tW, tH, isTomRedeemed ? 0x4a2535 : 0x2a1a3a, 1)
              .setScrollFactor(0).setDepth(D + 7);
            arr.push(frame, bg);
            if (!isTomRedeemed) {
              // REVERSO: "?" gigante + leyenda "presiona ENTER".
              arr.push(
                this.ctx.scene.add.text(tX, tY - 6, '✉', {
                  fontFamily: FONT_STACK, fontSize: '18px', color: tGift.accent, fontStyle: 'bold',
                }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 8),
                this.ctx.scene.add.text(tX, tY + 14, 'sobre cerrado · ENTER para abrir', {
                  fontFamily: FONT_STACK, fontSize: '8px', color: '#fbcfe8', fontStyle: 'italic',
                }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 8),
              );
            } else {
              // FRENTE: serial real + título.
              arr.push(
                this.ctx.scene.add.text(tX, tY - 14, 'Tomodachi Life · Switch', {
                  fontFamily: FONT_STACK, fontSize: '9px', color: tGift.accent, fontStyle: 'bold',
                }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 8),
                this.ctx.scene.add.text(tX, tY + 2, formatTomodachiSerial(TOMODACHI_SERIAL), {
                  fontFamily: '"Courier New", "Lucida Console", monospace',
                  fontSize: '12px', color: '#fafaf5', fontStyle: 'bold',
                  // letterSpacing simulado via padding visual del char box
                }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 8),
                this.ctx.scene.add.text(tX, tY + 16, 'nintendo eshop · canjeado', {
                  fontFamily: FONT_STACK, fontSize: '7px', color: '#4ade80', fontStyle: 'italic',
                }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 8),
              );
            }
          }
        }
      };
      renderCards();

      // Cursor card.
      const cursorRect = this.ctx.scene.add.rectangle(0, 0, cardW + 10, cardH + 10)
        .setStrokeStyle(2, 0xfbbf24, 1).setScrollFactor(0).setDepth(D + 6);
      els.push(cursorRect);
      const positionCursor = () => {
        const idAt = giftIds[activeIdx];
        if (idAt === 'tomodachi') {
          cursorRect.setPosition(cx, cy + cardH / 2 + 24);
          cursorRect.setSize(190, 60);
        } else {
          const cardX = cx - PW / 2 + 30 + activeIdx * (cardW + 10) + cardW / 2;
          cursorRect.setPosition(cardX, cardY);
          cursorRect.setSize(cardW + 10, cardH + 10);
        }
      };
      positionCursor();

      // Status text para "CANJEADO!" feedback.
      const status = this.ctx.scene.add.text(cx, cy + PH / 2 - 28, '', { fontFamily: FONT_STACK, fontSize: '8px', color: '#4ade80', fontStyle: 'bold' })
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5);
      els.push(status);

      els.push(
        this.ctx.scene.add.text(cx, cy + PH / 2 - 12, '←/→ elegir  ·  ENTER canjear  ·  ESC cerrar', S.hint())
          .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
      );

      const cleanup = () => {
        window.removeEventListener('keydown', onKey);
        for (const o of els) if ((o as any).scene) o.destroy();
        for (const arr of cardEls) for (const o of arr) if ((o as any).scene) o.destroy();
        resolve();
      };

      const tryRedeem = () => {
        const id = giftIds[activeIdx];
        const st = useProgressStore.getState();
        const isRedeemed = st.redeemedGifts[id] !== undefined;
        if (isRedeemed) {
          status.setText('ya canjeado.').setColor('#9ca3af');
          return;
        }
        const isUnlocked = st.unlockedGifts.includes(id);
        if (!isUnlocked) {
          // S2.7: BLOQUEADO — necesita superar el minijuego del gato.
          status
            .setText('🔒 termina el juego de ' + (GIFTS[id].source ?? 'tu gato') + ' primero.')
            .setColor('#ef4444');
          return;
        }
        const data: RedemptionData = {
          date: new Date().toISOString().slice(0, 10),
          guest: 'Alex',
          notes: '',
          redeemedAtMs: Date.now(),
        };
        st.redeemGift(id, data);
        status.setText('✓ canjeado: ' + GIFTS[id].title).setColor('#4ade80');
        renderCards();
        // S2.8: si es tomodachi, hacer flip visual + camera shake corto.
        if (id === 'tomodachi') {
          const arr = cardEls[giftIds.indexOf('tomodachi')] || [];
          this.ctx.scene.tweens.add({
            targets: arr,
            scaleX: { from: 0, to: 1 },
            duration: 600,
            ease: 'Quad.easeOut',
          });
          this.ctx.scene.cameras.main.shake(120, 0.003);
        }
      };

      const onKey = (e: KeyboardEvent) => {
        const k = e.key;
        if (k === 'Escape' || k === 'Esc') { e.preventDefault(); cleanup(); }
        else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); activeIdx = (activeIdx - 1 + giftIds.length) % giftIds.length; positionCursor(); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); activeIdx = (activeIdx + 1) % giftIds.length; positionCursor(); }
        else if (k === ' ' || k === 'Spacebar' || k === 'Enter') { e.preventDefault(); tryRedeem(); }
      };
      window.addEventListener('keydown', onKey);
    });
  }

  // ─── CALENDARIO.EXE ───────────────────────────────────────────────

  private openCalendarApp(): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = this.ctx.scene.cameras.main;
      const W = cam.width, H = cam.height;
      const PW = W - 20, PH = H - 20, cx = W / 2, cy = H / 2;
      const D = PANEL_DEPTH + 20;
      const els: Phaser.GameObjects.GameObject[] = [];

      // Mes actual por defecto.
      let viewMonth = new Date().getMonth(); // 0-11
      const viewYear = 2026;
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const monthColors = [0x5e8aa5, 0xa78bfa, 0x14b8a6, 0xfde047, 0xff8ab8, 0xfbbf24, 0xef4444, 0xc78030, 0x84cc16, 0xb91c1c, 0x6b4425, 0x00e5ff];

      els.push(
        this.ctx.scene.add.rectangle(cx, cy, W, H, 0x000000, 0.4).setScrollFactor(0).setDepth(D),
        this.ctx.scene.add.rectangle(cx, cy, PW + 4, PH + 4, 0x5eead4, 1).setScrollFactor(0).setDepth(D + 1),
        this.ctx.scene.add.rectangle(cx, cy, PW, PH, 0x0e2a2a, 1).setScrollFactor(0).setDepth(D + 2),
        this.ctx.scene.add.rectangle(cx, cy - PH / 2 + 8, PW, 16, 0x5eead4, 1).setScrollFactor(0).setDepth(D + 3),
        this.ctx.scene.add.text(cx - PW / 2 + 8, cy - PH / 2 + 8, '▣ Calendario.exe — 2026', { fontFamily: FONT_STACK, fontSize: '9px', color: '#0e2a2a', fontStyle: 'bold' })
          .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 4),
      );

      // Sub-elementos que recalculamos al cambiar mes.
      let monthEls: Phaser.GameObjects.GameObject[] = [];
      let monthCoverImg: HTMLImageElement | null = null;
      let activeDay = new Date().getMonth() === viewMonth ? new Date().getDate() : 1;
      let editingNote = false;
      let editBuffer = '';

      const isMonthUnlocked = (m: number) => {
        const today = new Date();
        if (today.getFullYear() < viewYear) return false;
        if (today.getFullYear() > viewYear) return true;
        return m <= today.getMonth();
      };

      const renderMonth = () => {
        for (const o of monthEls) if ((o as any).scene) o.destroy();
        if (monthCoverImg && monthCoverImg.parentNode) {
          monthCoverImg.parentNode.removeChild(monthCoverImg);
          monthCoverImg = null;
        }
        monthEls = [];

        // Wallpaper del mes — color de fondo + intento de cargar foto
        // real desde /assets/multimedia/calendar/MM.jpg (overlay HTML).
        const unlocked = isMonthUnlocked(viewMonth);
        const color = unlocked ? monthColors[viewMonth] : 0x4a4a4a;
        monthEls.push(
          this.ctx.scene.add.rectangle(cx, cy - 8, PW - 20, PH - 60, color, 0.25).setScrollFactor(0).setDepth(D + 4),
        );
        if (unlocked && typeof document !== 'undefined') {
          // Foto HTML overlay (jpg del mes — si no existe, se queda solo el color).
          const img = document.createElement('img');
          img.src = `/assets/multimedia/calendar/${String(viewMonth + 1).padStart(2, '0')}.png`;
          img.alt = '';
          img.style.position = 'fixed';
          img.style.pointerEvents = 'none';
          img.style.zIndex = '9998';
          img.style.opacity = '0.35';
          img.style.objectFit = 'cover';
          img.onerror = () => { img.style.display = 'none'; };
          monthCoverImg = img;
          document.body.appendChild(img);
          // Posicionar dentro del canvas relative al wallpaper rect.
          const canvas = this.ctx.scene.game.canvas as HTMLCanvasElement;
          const r = canvas.getBoundingClientRect();
          const sx = r.width / this.ctx.scene.cameras.main.width;
          const sy = r.height / this.ctx.scene.cameras.main.height;
          img.style.left = r.left + (cx - (PW - 20) / 2) * sx + 'px';
          img.style.top = r.top + (cy - 8 - (PH - 60) / 2) * sy + 'px';
          img.style.width = (PW - 20) * sx + 'px';
          img.style.height = (PH - 60) * sy + 'px';
        }
        if (!unlocked) {
          monthEls.push(
            this.ctx.scene.add.text(cx, cy - 60, '🔒 BLOQUEADO', { fontFamily: FONT_STACK, fontSize: '12px', color: '#9ca3af', fontStyle: 'bold' })
              .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 6),
          );
        }

        // Header con mes.
        monthEls.push(
          this.ctx.scene.add.text(cx, cy - PH / 2 + 28, monthNames[viewMonth].toUpperCase() + ' ' + viewYear, { fontFamily: FONT_STACK, fontSize: '13px', color: unlocked ? '#5eead4' : '#9ca3af', fontStyle: 'bold' })
            .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 6),
        );

        // Grid de días.
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=dom
        const adjustedFirstDow = (firstDow + 6) % 7; // 0=lun
        const gridX = cx - 110, gridY = cy - PH / 2 + 52;
        const cellW = 30, cellH = 16;
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;
        const agendaEntries = useProgressStore.getState().agendaEntries;

        // Días de la semana header.
        const dows = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        for (let i = 0; i < 7; i++) {
          monthEls.push(
            this.ctx.scene.add.text(gridX + i * cellW + cellW / 2, gridY, dows[i], { fontFamily: FONT_STACK, fontSize: '8px', color: '#5eead4' })
              .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 6),
          );
        }

        for (let day = 1; day <= daysInMonth; day++) {
          const idx = adjustedFirstDow + day - 1;
          const row = Math.floor(idx / 7);
          const col = idx % 7;
          const dx = gridX + col * cellW + cellW / 2;
          const dy = gridY + 12 + row * cellH;
          const isToday = isCurrentMonth && day === today.getDate();
          const isActive = day === activeDay;
          const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasNote = !!agendaEntries[dateKey];

          if (isActive) {
            monthEls.push(
              this.ctx.scene.add.rectangle(dx, dy, cellW - 2, cellH - 2, 0xfbbf24, 0).setStrokeStyle(2, 0xfbbf24, 1).setScrollFactor(0).setDepth(D + 7),
            );
          }
          const dayColor = isToday ? '#fbbf24' : hasNote ? '#5eead4' : '#fafaf5';
          monthEls.push(
            this.ctx.scene.add.text(dx, dy, String(day), { fontFamily: FONT_STACK, fontSize: '8px', color: dayColor, fontStyle: hasNote ? 'bold' : 'normal' })
              .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 7),
          );
          if (hasNote) {
            monthEls.push(
              this.ctx.scene.add.circle(dx + 8, dy - 4, 1.5, 0x5eead4, 1).setScrollFactor(0).setDepth(D + 8),
            );
          }
        }

        // Panel de nota del día activo.
        const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(activeDay).padStart(2, '0')}`;
        const note = agendaEntries[dateKey] || '';
        monthEls.push(
          this.ctx.scene.add.rectangle(cx, cy + 50, PW - 40, 50, 0x1a3a3a, 1).setStrokeStyle(1, 0x5eead4, 1).setScrollFactor(0).setDepth(D + 6),
          this.ctx.scene.add.text(cx - PW / 2 + 24, cy + 32, `${dateKey}:`, { fontFamily: FONT_STACK, fontSize: '8px', color: '#5eead4', fontStyle: 'bold' })
            .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 7),
          this.ctx.scene.add.text(cx - PW / 2 + 24, cy + 50, editingNote ? editBuffer + '_' : (note || 'sin nota — pulsa T para escribir'), { fontFamily: FONT_STACK, fontSize: '8px', color: editingNote ? '#fbbf24' : (note ? '#fafaf5' : '#9ca3af'), wordWrap: { width: PW - 60, useAdvancedWrap: true } })
            .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 7),
        );
      };
      renderMonth();

      // Hint.
      els.push(
        this.ctx.scene.add.text(cx, cy + PH / 2 - 12, '←/→ día  ·  ↑/↓ semana  ·  [ ] mes  ·  T escribir  ·  DEL borrar  ·  C borrar todo  ·  ESC', { fontFamily: FONT_STACK, fontSize: '7px', color: COLORS.yellowDim })
          .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
      );

      const cleanup = () => {
        window.removeEventListener('keydown', onKey);
        for (const o of monthEls) if ((o as any).scene) o.destroy();
        for (const o of els) if ((o as any).scene) o.destroy();
        if (monthCoverImg && monthCoverImg.parentNode) {
          monthCoverImg.parentNode.removeChild(monthCoverImg);
          monthCoverImg = null;
        }
        resolve();
      };

      const dateKeyFor = (day: number) =>
        `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const onKey = (e: KeyboardEvent) => {
        const k = e.key;
        if (editingNote) {
          if (k === 'Escape' || k === 'Esc') {
            e.preventDefault();
            editingNote = false; editBuffer = '';
            renderMonth();
          } else if (k === 'Enter') {
            e.preventDefault();
            useProgressStore.getState().setAgendaEntry(dateKeyFor(activeDay), editBuffer);
            editingNote = false; editBuffer = '';
            renderMonth();
          } else if (k === 'Backspace') {
            e.preventDefault();
            editBuffer = editBuffer.slice(0, -1);
            renderMonth();
          } else if (k.length === 1 && editBuffer.length < 60) {
            e.preventDefault();
            editBuffer += k;
            renderMonth();
          }
          return;
        }
        const monthDays = new Date(viewYear, viewMonth + 1, 0).getDate();
        if (k === 'Escape' || k === 'Esc') { e.preventDefault(); cleanup(); }
        // S2.6: ←/→ navega DÍA a DÍA (wrap entre meses).
        else if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
          e.preventDefault();
          activeDay -= 1;
          if (activeDay < 1) {
            viewMonth = (viewMonth - 1 + 12) % 12;
            activeDay = new Date(viewYear, viewMonth + 1, 0).getDate();
          }
          renderMonth();
        }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
          e.preventDefault();
          activeDay += 1;
          if (activeDay > monthDays) {
            viewMonth = (viewMonth + 1) % 12;
            activeDay = 1;
          }
          renderMonth();
        }
        // ↑/↓ navega SEMANA a SEMANA (cap dentro del mes).
        else if (k === 'ArrowDown' || k === 's' || k === 'S') {
          e.preventDefault();
          activeDay = Math.min(monthDays, activeDay + 7);
          renderMonth();
        }
        else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
          e.preventDefault();
          activeDay = Math.max(1, activeDay - 7);
          renderMonth();
        }
        // [ ] cambia de MES.
        else if (k === '[' || k === '{') { Sfx.pageFlip();
          e.preventDefault();
          viewMonth = (viewMonth - 1 + 12) % 12;
          activeDay = 1;
          renderMonth();
        }
        else if (k === ']' || k === '}') { Sfx.pageFlip();
          e.preventDefault();
          viewMonth = (viewMonth + 1) % 12;
          activeDay = 1;
          renderMonth();
        }
        else if (k === 't' || k === 'T') {
          e.preventDefault();
          editingNote = true;
          editBuffer = useProgressStore.getState().agendaEntries[dateKeyFor(activeDay)] || '';
          renderMonth();
        } else if (k === 'Delete' || k === 'Del') {
          e.preventDefault();
          useProgressStore.getState().setAgendaEntry(dateKeyFor(activeDay), '');
          renderMonth();
        } else if (k === 'c' || k === 'C') {
          e.preventDefault();
          useProgressStore.getState().clearAllAgenda();
          renderMonth();
        }
      };
      window.addEventListener('keydown', onKey);
    });
  }

  // ─── MULTIMEDIA.EXE ───────────────────────────────────────────────

  private openMultimediaApp(): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = this.ctx.scene.cameras.main;
      const W = cam.width, H = cam.height;
      const PW = W - 30, PH = H - 30, cx = W / 2, cy = H / 2;
      const D = PANEL_DEPTH + 20;
      const els: Phaser.GameObjects.GameObject[] = [];
      let coverImg: HTMLImageElement | null = null;

      els.push(
        this.ctx.scene.add.rectangle(cx, cy, W, H, 0x000000, 0.4).setScrollFactor(0).setDepth(D),
        this.ctx.scene.add.rectangle(cx, cy, PW + 4, PH + 4, 0xfbbf24, 1).setScrollFactor(0).setDepth(D + 1),
        this.ctx.scene.add.rectangle(cx, cy, PW, PH, 0x2a1810, 1).setScrollFactor(0).setDepth(D + 2),
        this.ctx.scene.add.rectangle(cx, cy - PH / 2 + 8, PW, 16, 0xfbbf24, 1).setScrollFactor(0).setDepth(D + 3),
        this.ctx.scene.add.text(cx - PW / 2 + 8, cy - PH / 2 + 8, '▶ Multimedia.exe', { fontFamily: FONT_STACK, fontSize: '9px', color: '#2a1810', fontStyle: 'bold' })
          .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 4),
      );

      const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      let monthIdx = new Date().getMonth();

      const captionText = this.ctx.scene.add.text(cx, cy + PH / 2 - 38, '', {
        fontFamily: FONT_STACK, fontSize: '11px', color: '#fbbf24', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5);
      const counterText = this.ctx.scene.add.text(cx, cy + PH / 2 - 22, '', {
        fontFamily: FONT_STACK, fontSize: '8px', color: '#9ca3af',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5);
      els.push(captionText, counterText);
      els.push(
        this.ctx.scene.add.text(cx, cy + PH / 2 - 8, '←/→ cambiar mes  ·  ESC cerrar', S.hint())
          .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
      );

      const showMonth = () => {
        captionText.setText(MONTH_NAMES[monthIdx] + ' 2026');
        counterText.setText((monthIdx + 1) + ' / 12');
        if (coverImg && coverImg.parentNode) coverImg.parentNode.removeChild(coverImg);
        coverImg = null;
        if (typeof document === 'undefined') return;
        const img = document.createElement('img');
        img.src = '/assets/multimedia/calendar/' + String(monthIdx + 1).padStart(2, '0') + '.png';
        img.alt = '';
        img.style.position = 'fixed';
        img.style.pointerEvents = 'none';
        img.style.zIndex = '9998';
        img.style.objectFit = 'cover';
        img.style.imageRendering = 'pixelated';
        img.onerror = () => { img.style.display = 'none'; captionText.setText(MONTH_NAMES[monthIdx] + ' — sin foto'); };
        coverImg = img;
        document.body.appendChild(img);
        // Posicionar dentro del marco multimedia.
        const canvas = this.ctx.scene.game.canvas as HTMLCanvasElement;
        const r = canvas.getBoundingClientRect();
        const sx = r.width / cam.width;
        const sy = r.height / cam.height;
        const photoW = PW - 40, photoH = PH - 80;
        img.style.left = (r.left + (cx - photoW / 2) * sx) + 'px';
        img.style.top = (r.top + (cy - photoH / 2 - 4) * sy) + 'px';
        img.style.width = (photoW * sx) + 'px';
        img.style.height = (photoH * sy) + 'px';
      };
      showMonth();

      const cleanup = () => {
        window.removeEventListener('keydown', onKey);
        if (coverImg && coverImg.parentNode) coverImg.parentNode.removeChild(coverImg);
        coverImg = null;
        for (const o of els) if ((o as any).scene) o.destroy();
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        const k = e.key;
        if (k === 'Escape' || k === 'Esc') { e.preventDefault(); cleanup(); }
        else if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
          e.preventDefault(); monthIdx = (monthIdx - 1 + 12) % 12; showMonth();
        } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
          e.preventDefault(); monthIdx = (monthIdx + 1) % 12; showMonth();
        }
      };
      window.addEventListener('keydown', onKey);
    });
  }

  // ─── MINIJUEGOS.EXE ───────────────────────────────────────────────

  private openMinigamesApp(): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = this.ctx.scene.cameras.main;
      const W = cam.width, H = cam.height;
      const cx = W / 2, cy = H / 2;
      const PW = W - 30, PH = H - 30;
      const D = PANEL_DEPTH + 20;
      const els: Phaser.GameObjects.GameObject[] = [];

      // Chrome de la ventana (frame, título). Persiste durante la nav.
      els.push(
        this.ctx.scene.add.rectangle(cx, cy, W, H, 0x000000, 0.5).setScrollFactor(0).setDepth(D),
        this.ctx.scene.add.rectangle(cx, cy, PW + 4, PH + 4, 0xa78bfa, 1).setScrollFactor(0).setDepth(D + 1),
        this.ctx.scene.add.rectangle(cx, cy, PW, PH, 0x1a0e2a, 1).setScrollFactor(0).setDepth(D + 2),
        this.ctx.scene.add.rectangle(cx, cy - PH / 2 + 8, PW, 16, 0xa78bfa, 1).setScrollFactor(0).setDepth(D + 3),
        this.ctx.scene.add.text(cx - PW / 2 + 8, cy - PH / 2 + 8, '◊ Minijuegos.exe', { fontFamily: FONT_STACK, fontSize: '9px', color: '#1a0e2a', fontStyle: 'bold' })
          .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 4),
      );

      const games = [
        { id: 'stack', label: 'Stack Game', desc: 'apila bloques. arcade real.\n50 bloques = 400 tickets.', accent: '#fbbf24', accentN: 0xfbbf24 },
        { id: 'c4', label: 'Conecta 4', desc: 'el clásico. contra la máquina.', accent: '#5eead4', accentN: 0x5eead4 },
        { id: 'jinx', label: 'Jinx Shootout', desc: 'click rápido. dispara dianas.', accent: '#ff2e9f', accentN: 0xff2e9f },
      ];
      let cursor = 0;
      const gameY = cy - 10;
      const gameCardW = (PW - 60) / 3;

      // QA fix: pintar UNA vez + cursor móvil. Cards persistentes, sólo
      // movemos el cursor amarillo y refrescamos el bg/stroke activo.
      const cardBgs: Phaser.GameObjects.Rectangle[] = [];
      for (let i = 0; i < games.length; i++) {
        const gx = cx - PW / 2 + 30 + i * (gameCardW + 10) + gameCardW / 2;
        const bg = this.ctx.scene.add
          .rectangle(gx, gameY, gameCardW, 80, 0x2a1a3a, 1)
          .setStrokeStyle(1, games[i].accentN, 1)
          .setScrollFactor(0)
          .setDepth(D + 4);
        cardBgs.push(bg);
        els.push(
          bg,
          this.ctx.scene.add.text(gx, gameY - 28, games[i].label, { fontFamily: FONT_STACK, fontSize: '11px', color: games[i].accent, fontStyle: 'bold' })
            .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
          this.ctx.scene.add.text(gx, gameY + 10, games[i].desc, { fontFamily: FONT_STACK, fontSize: '8px', color: '#fbcfe8', align: 'center', wordWrap: { width: gameCardW - 12, useAdvancedWrap: true }, lineSpacing: 2 })
            .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
        );
      }

      const cursorMark = this.ctx.scene.add
        .rectangle(0, gameY, gameCardW + 8, 88)
        .setStrokeStyle(3, 0xfbbf24, 1)
        .setScrollFactor(0)
        .setDepth(D + 6);
      els.push(cursorMark);

      const positionCursor = () => {
        const gx = cx - PW / 2 + 30 + cursor * (gameCardW + 10) + gameCardW / 2;
        cursorMark.setPosition(gx, gameY);
        for (let i = 0; i < cardBgs.length; i++) {
          cardBgs[i].setFillStyle(i === cursor ? 0x3a2a4a : 0x2a1a3a, 1);
        }
      };
      positionCursor();

      // Stack best score display + hint.
      const best = useProgressStore.getState().stackGameBest || 0;
      els.push(
        this.ctx.scene.add.text(cx, cy + PH / 2 - 30, `Stack: récord ${best} bloques`, { fontFamily: FONT_STACK, fontSize: '8px', color: '#fbbf24' })
          .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
        this.ctx.scene.add.text(cx, cy + PH / 2 - 14, '←/→ elegir  ·  ENTER jugar  ·  ESC cerrar', S.hint())
          .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 5),
      );

      let active = true;
      const cleanup = () => {
        if (!active) return;
        active = false;
        window.removeEventListener('keydown', onKey);
        for (const o of els) if ((o as Phaser.GameObjects.GameObject & { scene?: unknown }).scene) o.destroy();
        resolve();
      };

      const onKey = async (e: KeyboardEvent) => {
        if (!active) return;
        const k = e.key;
        if (k === 'Escape' || k === 'Esc') { e.preventDefault(); cleanup(); }
        else if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
          e.preventDefault();
          cursor = (cursor - 1 + games.length) % games.length;
          positionCursor();
        } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
          e.preventDefault();
          cursor = (cursor + 1) % games.length;
          positionCursor();
        } else if (k === ' ' || k === 'Enter') {
          e.preventDefault();
          const gid = games[cursor].id;
          // Pausamos el listener del hub mientras corre el minijuego.
          window.removeEventListener('keydown', onKey);
          if (gid === 'stack') await runStackGame(this.ctx);
          else if (gid === 'c4') await runConnect4Game(this.ctx);
          else if (gid === 'jinx') await runJinxShootout(this.ctx);
          if (active) {
            // Volvemos a enganchar input para el hub.
            window.addEventListener('keydown', onKey);
          }
        }
      };
      window.addEventListener('keydown', onKey);
    });
  }

  // ─── COMMON: modal "next" simple ───────────────────────────────────

  private showAppWindow(title: string, lines: string[], accentColor = '#fbbf24'): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = this.ctx.scene.cameras.main;
      const W = cam.width, H = cam.height;
      const PW = W - 60, PH = 150, cx = W / 2, cy = H / 2;
      const D = PANEL_DEPTH + 20;
      const accent = parseInt(accentColor.slice(1), 16);
      const els = [
        this.ctx.scene.add.rectangle(cx, cy, W, H, 0x000000, 0.5).setScrollFactor(0).setDepth(D),
        this.ctx.scene.add.rectangle(cx, cy, PW + 4, PH + 4, accent, 1).setScrollFactor(0).setDepth(D + 1),
        this.ctx.scene.add.rectangle(cx, cy, PW, PH, 0x1a0e2a, 1).setScrollFactor(0).setDepth(D + 2),
        this.ctx.scene.add.text(cx, cy - PH / 2 + 14, title, { fontFamily: FONT_STACK, fontSize: '11px', color: accentColor, fontStyle: 'bold' })
          .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 3),
        this.ctx.scene.add.text(cx, cy + 4, lines.join('\n'), { fontFamily: FONT_STACK, fontSize: '9px', color: '#fbcfe8', align: 'center', lineSpacing: 3 })
          .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 3),
        this.ctx.scene.add.text(cx, cy + PH / 2 - 12, 'ESC cerrar', S.hint())
          .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 3),
      ];
      const close = () => {
        window.removeEventListener('keydown', onKey);
        for (const o of els) o.destroy();
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        const k = e.key;
        if (k === 'Escape' || k === 'Esc' || k === ' ' || k === 'Enter') { e.preventDefault(); close(); }
      };
      window.addEventListener('keydown', onKey);
    });
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
    this.clockTimer?.remove();
    this.clockTimer = null;
    for (const o of this.layer) if ((o as any).scene) o.destroy();
    this.layer = [];
    this.resolveOuter({ success: true, reason: 'completed' });
  }
}

// ═════════════════════════════════════════════════════════════════════
//  MINIJUEGOS — Stack / Connect 4 / Jinx Shootout
// ═════════════════════════════════════════════════════════════════════

/**
 * Stack Game: bloque oscila izq-dcha encima de la torre. SPACE para
 * dropear. Si está alineado con el de abajo → suma bloque. Si NO, se
 * recorta lo que sobresale. Si el bloque queda con <8px → GAME OVER.
 * Llegar a 50 → unlock secret "arcade".
 */
/**
 * Stack Game — rewrite limpio S2.7. Referencia: Ketchapp Stack (2016).
 *
 * Reglas:
 *   1. Un bloque (mover) oscila izq-dcha encima de la torre.
 *   2. SPACE/ENTER lo deja caer. Si solapa con el top, la PARTE QUE
 *      SOLAPA se queda como nuevo top; la parte que SOBRESALE cae con
 *      tween (efecto 3D fake).
 *   3. PERFECT (diff <= 3px) → no recorta, anima un "snap" + sonido
 *      agudo + streak counter. Cada 4 perfects seguidos regala +6px.
 *   4. Sin overlap → game over.
 *   5. Cada bloque tiene DOS caras: TOP (rect plano) + SIDE/FRONT
 *      (parallelogram simulada con triángulos para dar profundidad).
 *   6. Cuando la torre crece, el contenedor entero hace tween hacia
 *      abajo (smooth scroll, no jitter).
 *   7. Meta: 30 bloques → desbloquea regalo arcade.
 *
 * Bugs corregidos del rework S2.6:
 *   - Math overlap correcta en ambos sentidos
 *   - El cut piece SIEMPRE cae visible (incluso si <2px se omite limpiamente)
 *   - Scroll smooth con tween en lugar de step-by-frame jitter
 *   - state.gameOver gateado al inicio de cada handler
 *   - Cleanup completo en ESC, including tweens activos
 *   - El mover spawnea AL LADO opuesto al que viene → no aparece "pegado"
 */
/**
 * Stack Game — 3D real (S2.14 rework v2) — Graphics central + camera scroll.
 *
 *   - 1 sólo Phaser.Graphics que limpia + redibuja la torre completa cada
 *     frame. Sin entrelazados/glitches de polígonos recreados.
 *   - Cámara: cuando la torre supera cierta altura, se levanta un offset
 *     vertical que baja la torre entera (efecto "subir cámara").
 *   - Proyección oblicua: worldZ se proyecta diagonal arriba-izq.
 *   - Alternancia X/Z bien marcada con label en pantalla.
 */
function runStackGame(ctx: MinigameContext): Promise<void> {
  return new Promise<void>((resolve) => {
    const cam = ctx.scene.cameras.main;
    const W = cam.width, H = cam.height;
    const cx = W / 2;
    const D = PANEL_DEPTH + 30;
    const els: Phaser.GameObjects.GameObject[] = [];

    els.push(
      ctx.scene.add.rectangle(W / 2, H / 2, W, H, 0x0a0612, 1).setScrollFactor(0).setDepth(D),
      ctx.scene.add.text(cx, 14, 'STACK', { fontFamily: FONT_STACK, fontSize: '14px', color: '#fbbf24', fontStyle: 'bold' })
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 1),
    );
    const scoreText = ctx.scene.add.text(cx, 30, '0 / 50', { fontFamily: FONT_STACK, fontSize: '11px', color: '#fafaf5', fontStyle: 'bold' })
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 1);
    const streakText = ctx.scene.add.text(cx, 44, '', { fontFamily: FONT_STACK, fontSize: '9px', color: '#5eead4', fontStyle: 'bold' })
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 1);
    const flashText = ctx.scene.add.text(cx, 60, '', { fontFamily: FONT_STACK, fontSize: '11px', color: '#5eead4', fontStyle: 'bold' })
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 1).setAlpha(0);
    const axisText = ctx.scene.add.text(cx, H - 18, '', { fontFamily: FONT_STACK, fontSize: '9px', color: '#a78bfa', fontStyle: 'italic' })
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 1);
    els.push(scoreText, streakText, flashText, axisText);

    const ZX_OFFSET = -0.58;
    const ZY_OFFSET = -0.36;
    const TARGET_SCORE = 50;
    const BLOCK_H = 12;
    const BASE_W = 70;
    const BASE_D = 70;
    const RANGE = 90;
    const getPerfectTol = (s: number) => s < 10 ? 3 : s < 20 ? 2 : s < 35 ? 1.5 : 1;
    const COLORS: number[] = [
      0xff2e9f, 0x00e5ff, 0xfbbf24, 0x5eead4, 0xa78bfa, 0xfb7185, 0x84cc16, 0xf97316,
    ];

    let cameraOffsetY = 0;
    const ORIGIN_SCREEN_Y = H - 60;

    const project = (wx: number, wy: number, wz: number) => ({
      sx: cx + wx + wz * ZX_OFFSET,
      sy: ORIGIN_SCREEN_Y - (wy - cameraOffsetY) + wz * ZY_OFFSET,
    });

    interface PlacedBlock { x: number; y: number; z: number; w: number; d: number; color: number; }
    const tower: PlacedBlock[] = [];
    tower.push({ x: 0, y: 0, z: 0, w: BASE_W, d: BASE_D, color: 0x5eead4 });

    const gfx = ctx.scene.add.graphics().setScrollFactor(0).setDepth(D + 3);
    els.push(gfx);

    const drawBlock = (b: PlacedBlock, isMover = false) => {
      const cBase = b.color;
      const cDark1 = Phaser.Display.Color.IntegerToColor(cBase).darken(30).color;
      const cDark2 = Phaser.Display.Color.IntegerToColor(cBase).darken(50).color;
      const cStroke = Phaser.Display.Color.IntegerToColor(cBase).darken(70).color;
      const hw = b.w / 2, hh = BLOCK_H, hd = b.d / 2;
      const nbl = project(b.x - hw, b.y, b.z - hd);
      const nbr = project(b.x + hw, b.y, b.z - hd);
      const ntl = project(b.x - hw, b.y + hh, b.z - hd);
      const ntr = project(b.x + hw, b.y + hh, b.z - hd);
      const fbr = project(b.x + hw, b.y, b.z + hd);
      const ftl = project(b.x - hw, b.y + hh, b.z + hd);
      const ftr = project(b.x + hw, b.y + hh, b.z + hd);
      gfx.fillStyle(cDark1, 1);
      gfx.beginPath();
      gfx.moveTo(nbl.sx, nbl.sy); gfx.lineTo(nbr.sx, nbr.sy);
      gfx.lineTo(ntr.sx, ntr.sy); gfx.lineTo(ntl.sx, ntl.sy);
      gfx.closePath(); gfx.fillPath();
      // SIDE derecha.
      gfx.fillStyle(cDark2, 1);
      gfx.beginPath();
      gfx.moveTo(nbr.sx, nbr.sy); gfx.lineTo(fbr.sx, fbr.sy);
      gfx.lineTo(ftr.sx, ftr.sy); gfx.lineTo(ntr.sx, ntr.sy);
      gfx.closePath(); gfx.fillPath();
      // SIDE izquierda (S2.14 fix — antes faltaba esta cara y se veía hueco).
      // Necesitamos los vértices NBL/FBL/FTL ya proyectados. NBL ya existe;
      // FBL y FTL los proyectamos aquí.
      const fbl_ = project(b.x - hw, b.y, b.z + hd);
      const ftl_ = project(b.x - hw, b.y + hh, b.z + hd);
      gfx.fillStyle(cDark2, 1);
      gfx.beginPath();
      gfx.moveTo(nbl.sx, nbl.sy); gfx.lineTo(fbl_.sx, fbl_.sy);
      gfx.lineTo(ftl_.sx, ftl_.sy); gfx.lineTo(ntl.sx, ntl.sy);
      gfx.closePath(); gfx.fillPath();
      gfx.fillStyle(cBase, isMover ? 0.92 : 1);
      gfx.beginPath();
      gfx.moveTo(ntl.sx, ntl.sy); gfx.lineTo(ntr.sx, ntr.sy);
      gfx.lineTo(ftr.sx, ftr.sy); gfx.lineTo(ftl.sx, ftl.sy);
      gfx.closePath(); gfx.fillPath();
      gfx.lineStyle(1, cStroke, 1);
      gfx.beginPath();
      gfx.moveTo(ntl.sx, ntl.sy); gfx.lineTo(ntr.sx, ntr.sy);
      gfx.lineTo(ftr.sx, ftr.sy); gfx.lineTo(ftl.sx, ftl.sy);
      gfx.closePath(); gfx.strokePath();
    };

    const moverState: {
      axis: 'X' | 'Z'; pos: number; dir: number; speed: number;
      w: number; d: number; y: number; color: number;
    } = { axis: 'X', pos: 0, dir: 1, speed: 1.5, w: BASE_W, d: BASE_D, y: BLOCK_H, color: COLORS[0] };

    const spawnMover = () => {
      const lastTop = tower[tower.length - 1];
      moverState.y = lastTop.y + BLOCK_H;
      moverState.color = COLORS[tower.length % COLORS.length];
      moverState.w = lastTop.w;
      moverState.d = lastTop.d;
      moverState.axis = (tower.length % 2 === 1) ? 'X' : 'Z';
      const center = moverState.axis === 'X' ? lastTop.x : lastTop.z;
      moverState.pos = center - RANGE;
      moverState.dir = 1;
      axisText.setText(moverState.axis === 'X' ? '◀ ▶  eje izq-dcha' : '▲ ▼  eje fondo-cerca');
    };
    spawnMover();

    const state = { score: 0, perfectStreak: 0, best: useProgressStore.getState().stackGameBest || 0, gameOver: false };

    const VISIBLE_TOP_Y_LIMIT = 120;
    const updateCameraOffset = () => {
      const top = tower[tower.length - 1];
      const topProj = project(top.x, top.y + BLOCK_H, top.z);
      if (topProj.sy < VISIBLE_TOP_Y_LIMIT) {
        const targetOffset = cameraOffsetY + (VISIBLE_TOP_Y_LIMIT - topProj.sy);
        ctx.scene.tweens.add({
          targets: { v: cameraOffsetY },
          v: targetOffset, duration: 300, ease: 'Quad.easeOut',
          onUpdate: (tw) => { cameraOffsetY = (tw.targets[0] as { v: number }).v; },
        });
      }
    };

    const onUpdate = (_: number, delta: number) => {
      if (state.gameOver) return;
      const lastTop = tower[tower.length - 1];
      const dx = moverState.dir * moverState.speed * (delta / 16.67);
      moverState.pos += dx;
      const center = moverState.axis === 'X' ? lastTop.x : lastTop.z;
      if (moverState.pos > center + RANGE) { moverState.pos = center + RANGE; moverState.dir = -1; }
      else if (moverState.pos < center - RANGE) { moverState.pos = center - RANGE; moverState.dir = 1; }
      gfx.clear();
      for (const b of tower) drawBlock(b, false);
      const wx = moverState.axis === 'X' ? moverState.pos : lastTop.x;
      const wz = moverState.axis === 'Z' ? moverState.pos : lastTop.z;
      drawBlock({ x: wx, y: moverState.y, z: wz, w: moverState.w, d: moverState.d, color: moverState.color }, true);
    };
    ctx.scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);

    const finishGame = (winFlag: boolean) => {
      if (state.gameOver) return;
      state.gameOver = true;
      ctx.scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
      const bestPrev = useProgressStore.getState().stackGameBest || 0;
      if (state.score > bestPrev) useProgressStore.getState().setStackGameBest(state.score);
      if (winFlag) useProgressStore.getState().setArcadeGiftUnlocked(true);
      try { Sfx[winFlag ? 'win' : 'fail'](); } catch { /* ignore */ }
      els.push(
        ctx.scene.add.rectangle(cx, H / 2, W, H, 0x000000, 0.6).setScrollFactor(0).setDepth(D + 9),
        ctx.scene.add.text(cx, H / 2 - 14, winFlag ? '★ ¡50 BLOQUES! ★' : 'fin de partida', {
          fontFamily: FONT_STACK, fontSize: '14px', color: winFlag ? '#fbbf24' : '#ef4444', fontStyle: 'bold', align: 'center', lineSpacing: 4,
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 10),
        ctx.scene.add.text(cx, H / 2 + 14, winFlag ? '400 tickets · regalo arcade desbloqueado' : state.score + ' bloques apilados', {
          fontFamily: FONT_STACK, fontSize: '10px', color: '#fafaf5',
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 10),
        ctx.scene.add.text(cx, H / 2 + 34, 'mejor: ' + Math.max(state.best, state.score), {
          fontFamily: FONT_STACK, fontSize: '9px', color: '#9ca3af',
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 10),
        ctx.scene.add.text(cx, H / 2 + 52, 'SPACE / ESC cerrar', S.hint())
          .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 10),
      );
    };

    const showFlash = (text: string, color: string) => {
      flashText.setText(text).setColor(color).setAlpha(1).setScale(1);
      ctx.scene.tweens.add({
        targets: flashText, scale: { from: 1.3, to: 1.0 }, alpha: { from: 1, to: 0 },
        duration: 600, ease: 'Quad.easeOut',
      });
    };

    /** Cut piece como mini-cubo 3D que cae al lado de la torre. */
    const dropCutPiece = (worldX: number, worldZ: number, w: number, d: number, color: number) => {
      // Container con 3 rectángulos simulando un mini-bloque.
      const cont = ctx.scene.add.container(0, 0).setDepth(D + 6).setScrollFactor(0);
      const cBase = color;
      const cDark1 = Phaser.Display.Color.IntegerToColor(cBase).darken(30).color;
      const cDark2 = Phaser.Display.Color.IntegerToColor(cBase).darken(50).color;
      // Proyección de los 4 vértices del top de la pieza.
      const hw = w / 2, hh = BLOCK_H, hd = d / 2;
      const wy = moverState.y;
      const nbl = project(worldX - hw, wy, worldZ - hd);
      const nbr = project(worldX + hw, wy, worldZ - hd);
      const ntl = project(worldX - hw, wy + hh, worldZ - hd);
      const ntr = project(worldX + hw, wy + hh, worldZ - hd);
      const fbr = project(worldX + hw, wy, worldZ + hd);
      const ftl = project(worldX - hw, wy + hh, worldZ + hd);
      const ftr = project(worldX + hw, wy + hh, worldZ + hd);
      // Top.
      const topPoly = ctx.scene.add.polygon(0, 0,
        [ntl.sx, ntl.sy, ntr.sx, ntr.sy, ftr.sx, ftr.sy, ftl.sx, ftl.sy], cBase, 1)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(D + 7);
      // Front.
      const frontPoly = ctx.scene.add.polygon(0, 0,
        [nbl.sx, nbl.sy, nbr.sx, nbr.sy, ntr.sx, ntr.sy, ntl.sx, ntl.sy], cDark1, 1)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(D + 7);
      // Side dcha.
      const sidePoly = ctx.scene.add.polygon(0, 0,
        [nbr.sx, nbr.sy, fbr.sx, fbr.sy, ftr.sx, ftr.sy, ntr.sx, ntr.sy], cDark2, 1)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(D + 7);
      els.push(cont, topPoly, frontPoly, sidePoly);
      // Tween de caída.
      ctx.scene.tweens.add({
        targets: [topPoly, frontPoly, sidePoly], y: '+=180', alpha: 0,
        duration: 800, ease: 'Quad.easeIn',
        onComplete: () => {
          if ((topPoly as { scene?: unknown }).scene) topPoly.destroy();
          if ((frontPoly as { scene?: unknown }).scene) frontPoly.destroy();
          if ((sidePoly as { scene?: unknown }).scene) sidePoly.destroy();
          if ((cont as { scene?: unknown }).scene) cont.destroy();
        },
      });
    };

    const placeBlock = () => {
      if (state.gameOver) return;
      const top = tower[tower.length - 1];
      const isX = moverState.axis === 'X';
      const moverCenter = moverState.pos;
      const topCenter = isX ? top.x : top.z;
      const moverHalf = isX ? moverState.w / 2 : moverState.d / 2;
      const topHalf = isX ? top.w / 2 : top.d / 2;
      const overlapMin = Math.max(moverCenter - moverHalf, topCenter - topHalf);
      const overlapMax = Math.min(moverCenter + moverHalf, topCenter + topHalf);
      const overlap = overlapMax - overlapMin;

      if (overlap <= 0) {
        try { Sfx.fail(); } catch { /* ignore */ }
        finishGame(false);
        return;
      }

      const diff = Math.abs(moverCenter - topCenter);
      const perfect = diff <= getPerfectTol(state.score);
      let newW = moverState.w, newD = moverState.d;
      let newX = top.x, newZ = top.z;

      if (perfect) {
        newW = top.w; newD = top.d;
        state.perfectStreak += 1;
        try { Sfx.clack(true); } catch { /* ignore */ }
        showFlash('★ PERFECT ★ x' + state.perfectStreak, '#fbbf24');
        if (state.perfectStreak > 0 && state.perfectStreak % 5 === 0) {
          if (isX && moverState.w < BASE_W) {
            moverState.w = Math.min(BASE_W, moverState.w + 4);
            showFlash('+4 ancho', '#5eead4');
          } else if (!isX && moverState.d < BASE_D) {
            moverState.d = Math.min(BASE_D, moverState.d + 4);
            showFlash('+4 profundidad', '#5eead4');
          }
        }
      } else {
        state.perfectStreak = 0;
        try { Sfx.clack(false); } catch { /* ignore */ }
        const newCenter = (overlapMin + overlapMax) / 2;
        if (isX) { newW = overlap; newX = newCenter; newD = top.d; newZ = top.z; }
        else { newD = overlap; newZ = newCenter; newW = top.w; newX = top.x; }
        // Visual cut piece — pixel basket en screen coords del lado de fuera.
        // Calcular la región que sobresale (cut piece) con sus dimensiones reales.
        let cutCx: number, cutCz: number, cutW: number, cutD: number;
        if (isX) {
          // El cut piece ocupa el ancho que sobresale en X, profundidad full.
          cutW = Math.abs(moverHalf + topHalf - (Math.abs(moverCenter - topCenter)));
          // Simpler: cutW = mover.w - overlap.
          cutW = moverState.w - overlap;
          cutD = moverState.d;
          cutCx = moverCenter > topCenter
            ? (top.x + topHalf) + cutW / 2
            : (top.x - topHalf) - cutW / 2;
          cutCz = top.z;
        } else {
          cutW = moverState.w;
          cutD = moverState.d - overlap;
          cutCx = top.x;
          cutCz = moverCenter > topCenter
            ? (top.z + topHalf) + cutD / 2
            : (top.z - topHalf) - cutD / 2;
        }
        if (cutW > 1 && cutD > 1) dropCutPiece(cutCx, cutCz, cutW, cutD, moverState.color);
      }

      tower.push({ x: newX, y: moverState.y, z: newZ, w: newW, d: newD, color: moverState.color });
      state.score += 1;
      scoreText.setText(state.score + ' / ' + TARGET_SCORE);
      streakText.setText(state.perfectStreak >= 2 ? '🔥 streak x' + state.perfectStreak : '');

      moverState.w = newW;
      moverState.d = newD;
      if (state.score > 0 && state.score % 5 === 0) {
        moverState.speed = Math.min(4, moverState.speed + 0.18);
      }
      if (newW < 5 || newD < 5) { finishGame(false); return; }
      if (state.score >= TARGET_SCORE) { finishGame(true); return; }
      if (perfect) ctx.scene.cameras.main.shake(50, 0.002);
      updateCameraOffset();
      spawnMover();
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (state.gameOver) {
        if (k === ' ' || k === 'Enter' || k === 'Escape' || k === 'Esc') {
          e.preventDefault();
          window.removeEventListener('keydown', onKey);
          ctx.scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
          for (const o of els) if ((o as Phaser.GameObjects.GameObject & { scene?: unknown }).scene) o.destroy();
          ctx.scene.tweens.killAll();
          resolve();
        }
        return;
      }
      if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        e.preventDefault();
        placeBlock();
      } else if (k === 'Escape' || k === 'Esc') {
        e.preventDefault();
        finishGame(false);
      }
    };
    window.addEventListener('keydown', onKey);
  });
}

/**
 * Conecta 4 — COOP local (S2.6). 6 cols x 6 rows. P1 rosa, P2 cyan
 * alternan turno desde el mismo teclado. Sin IA.
 */
function runConnect4Game(ctx: MinigameContext): Promise<void> {
  return new Promise<void>((resolve) => {
    const cam = ctx.scene.cameras.main;
    const W = cam.width, H = cam.height;
    const cx = W / 2, cy = H / 2;
    const D = PANEL_DEPTH + 30;
    const COLS = 6, ROWS = 6;
    const CELL = 26;
    const boardW = COLS * CELL, boardH = ROWS * CELL;
    const boardX = cx - boardW / 2, boardY = cy - boardH / 2 + 16;
    const board: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const tokens: Phaser.GameObjects.GameObject[] = [];
    const els: Phaser.GameObjects.GameObject[] = [];
    let activeCol = 3, turn = 1, gameOver = false;

    els.push(
      ctx.scene.add.rectangle(cx, cy, W, H, 0x0a0e2a, 1).setScrollFactor(0).setDepth(D),
      ctx.scene.add.text(cx, 16, 'CONECTA 4', { fontFamily: FONT_STACK, fontSize: '14px', color: '#5eead4', fontStyle: 'bold' })
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 1),
      ctx.scene.add.rectangle(boardX + boardW / 2, boardY + boardH / 2, boardW + 4, boardH + 4, 0xfbbf24, 1).setScrollFactor(0).setDepth(D + 1),
      ctx.scene.add.rectangle(boardX + boardW / 2, boardY + boardH / 2, boardW, boardH, 0x1a3a5a, 1).setScrollFactor(0).setDepth(D + 2),
    );
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      els.push(
        ctx.scene.add.circle(boardX + c * CELL + CELL / 2, boardY + r * CELL + CELL / 2, CELL / 2 - 2, 0x0a1a2a, 1)
          .setScrollFactor(0).setDepth(D + 3),
      );
    }
    const cursorMark = ctx.scene.add.triangle(0, boardY - 10, 0, 6, -6, 0, 6, 0, 0xff2e9f, 1).setScrollFactor(0).setDepth(D + 4);
    els.push(cursorMark);
    const status = ctx.scene.add.text(cx, H - 28, 'P1 (rosa) - tu turno', { fontFamily: FONT_STACK, fontSize: '10px', color: '#ff2e9f', fontStyle: 'bold' })
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 4);
    els.push(status);
    els.push(
      ctx.scene.add.text(cx, H - 12, 'COOP local - left/right columna - ENTER soltar - ESC salir', S.hint())
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 4),
    );

    const updateCursor = () => cursorMark.setPosition(boardX + activeCol * CELL + CELL / 2, boardY - 10);
    updateCursor();

    const drop = (col: number, player: number): number => {
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) {
          board[r][col] = player;
          const color = player === 1 ? 0xff2e9f : 0x5eead4;
          const t = ctx.scene.add.circle(boardX + col * CELL + CELL / 2, boardY + r * CELL + CELL / 2, CELL / 2 - 2, color, 1).setScrollFactor(0).setDepth(D + 5);
          tokens.push(t);
          return r;
        }
      }
      return -1;
    };

    const checkWin = (r: number, c: number, player: number): boolean => {
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (const [dr, dc] of dirs) {
        let count = 1;
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== player) break;
          count++;
        }
        for (let i = 1; i < 4; i++) {
          const nr = r - dr * i, nc = c - dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== player) break;
          count++;
        }
        if (count >= 4) return true;
      }
      return false;
    };

    const updateTurnUI = () => {
      if (turn === 1) {
        cursorMark.setFillStyle(0xff2e9f, 1);
        status.setText('P1 (rosa) - tu turno').setColor('#ff2e9f');
      } else {
        cursorMark.setFillStyle(0x5eead4, 1);
        status.setText('P2 (cyan) - tu turno').setColor('#5eead4');
      }
    };

    const isBoardFull = () => {
      for (let c = 0; c < COLS; c++) if (board[0][c] === 0) return false;
      return true;
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (gameOver) {
        if (k === 'Escape' || k === 'Esc' || k === ' ' || k === 'Enter') {
          e.preventDefault();
          window.removeEventListener('keydown', onKey);
          for (const o of els) if ((o as any).scene) o.destroy();
          for (const o of tokens) if ((o as any).scene) o.destroy();
          resolve();
        }
        return;
      }
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        e.preventDefault();
        activeCol = (activeCol - 1 + COLS) % COLS;
        updateCursor();
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        e.preventDefault();
        activeCol = (activeCol + 1) % COLS;
        updateCursor();
      } else if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        if (board[0][activeCol] !== 0) return;
        const r = drop(activeCol, turn);
        if (r >= 0 && checkWin(r, activeCol, turn)) {
          gameOver = true;
          const w = turn === 1 ? 'P1 (rosa)' : 'P2 (cyan)';
          status.setText('¡GANA ' + w + '!').setColor(turn === 1 ? '#ff2e9f' : '#5eead4');
        } else if (isBoardFull()) {
          gameOver = true;
          status.setText('empate.').setColor('#9ca3af');
        } else {
          turn = turn === 1 ? 2 : 1;
          updateTurnUI();
        }
      } else if (k === 'Escape' || k === 'Esc') {
        e.preventDefault();
        gameOver = true;
        window.removeEventListener('keydown', onKey);
        for (const o of els) if ((o as any).scene) o.destroy();
        for (const o of tokens) if ((o as any).scene) o.destroy();
        resolve();
      }
    };
    window.addEventListener('keydown', onKey);
  });
}

/**
 * S2.7: Syndra Macro Trainer = embebido a https://www.mobatrainer.com/puzzle-of-the-day
 * (puzzles diarios de macro de LoL — María decide la mejor jugada en
 * vídeo). Iframe con permisos suficientes para click + pointer events.
 */
function runJinxShootout(ctx: MinigameContext): Promise<void> {
  return new Promise<void>((resolve) => {
    const cam = ctx.scene.cameras.main;
    const W = cam.width, H = cam.height;
    const cx = W / 2;
    const D = PANEL_DEPTH + 30;
    const els: Phaser.GameObjects.GameObject[] = [];

    els.push(
      ctx.scene.add.rectangle(cx, H / 2, W, H, 0x0a0a14, 1).setScrollFactor(0).setDepth(D),
      ctx.scene.add.rectangle(cx, 8, W, 16, 0x1a0a2a, 1).setStrokeStyle(1, 0xff2e9f, 1).setScrollFactor(0).setDepth(D + 1),
      ctx.scene.add.text(8, 8, '◆ Syndra Macro Trainer', { fontFamily: FONT_STACK, fontSize: '8px', color: '#ff2e9f', fontStyle: 'bold' })
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D + 2),
      ctx.scene.add.text(cx, 8, 'mobatrainer.com / puzzle-of-the-day', { fontFamily: FONT_STACK, fontSize: '7px', color: '#fbcfe8' })
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 2),
      ctx.scene.add.text(W - 8, 8, 'ESC cerrar', { fontFamily: FONT_STACK, fontSize: '7px', color: '#9ca3af' })
        .setOrigin(1, 0.5).setScrollFactor(0).setDepth(D + 2),
    );

    let iframe: HTMLIFrameElement | null = null;
    let positionFn: (() => void) | null = null;
    if (typeof document !== 'undefined') {
      iframe = document.createElement('iframe');
      iframe.src = 'https://www.mobatrainer.com/puzzle-of-the-day';
      // Sandbox amplio para que el juego pueda capturar clicks + forms.
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-presentation');
      iframe.setAttribute('allow', 'autoplay; fullscreen; pointer-lock');
      iframe.style.position = 'fixed';
      iframe.style.border = '2px solid #ff2e9f';
      iframe.style.background = '#000';
      iframe.style.zIndex = '9990';
      iframe.style.boxShadow = '0 0 24px rgba(255,46,159,0.5)';
      iframe.style.pointerEvents = 'auto';
      const positionIframe = () => {
        if (!iframe) return;
        const canvas = ctx.scene.game.canvas as HTMLCanvasElement;
        const r = canvas.getBoundingClientRect();
        const sx = r.width / W;
        const sy = r.height / H;
        iframe.style.left = r.left + 4 * sx + 'px';
        iframe.style.top = r.top + 20 * sy + 'px';
        iframe.style.width = (W - 8) * sx + 'px';
        iframe.style.height = (H - 24) * sy + 'px';
      };
      positionIframe();
      positionFn = positionIframe;
      window.addEventListener('resize', positionIframe);
      document.body.appendChild(iframe);
    }

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.removeEventListener('keydown', onKey);
      if (iframe) {
        if (positionFn) window.removeEventListener('resize', positionFn);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        iframe = null;
      }
      for (const o of els) if ((o as any).scene) o.destroy();
      resolve();
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'Escape' || k === 'Esc') { e.preventDefault(); cleanup(); }
    };
    window.addEventListener('keydown', onKey);
    ctx.scene.events.once('shutdown', () => cleanup());
    ctx.scene.events.once('destroy', () => cleanup());
  });
}
