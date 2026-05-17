import * as Phaser from 'phaser';
import type { MinigameContext, MinigameResult, MinigameRunner } from '../types';
import { showMinigameIntro } from '../_shared/MinigameIntroPanel';
import { S, COLORS, FONT_STACK } from '../../systems/TextStyle';
import {
  buildTinderRound,
  generateDestinos,
  nalaHintLine,
  type TinderCatProfile,
  type TinderChatLine,
} from '../../data/tinderCats';
import { useProgressStore } from '@/lib/stores/gameStore';
import { Sfx } from '../../systems/SfxBank';

/**
 * TINDER CAT v2 — minijuego del menú de Nala (Día 9d).
 *
 * Cambios respecto a v1:
 *   - Pool ampliado a 50 perfiles (antes 25).
 *   - Mecánica nueva: 10 cartas por sesión, sólo 1-2 reciprocan
 *     dinámicamente (no es estático del perfil — Nala lo decide cada
 *     vez). Esto fuerza que María no vea siempre los mismos matches.
 *   - Persistencia: matches se guardan en `tinderMatchedIds` y se
 *     EXCLUYEN del pool en sesiones futuras (no ves dos veces a Lola).
 *   - Win condition: cuando totalMatches >= 15 → unlock 'escapada'.
 *   - Cooldown 3h entre sesiones.
 *   - Sin "destino del día" — ahora la mecánica es acumulativa.
 *
 * Flujo:
 *   1) Caller verifica cooldown 3h vía canPlayTinder()
 *   2) IntroPanel
 *   3) Build round excluyendo matched ids previos
 *   4) Swipe 10 cartas. Likes a cats que reciprocan → match → chat scripted
 *   5) Final screen: matches esta sesión / total / progreso 0/15
 *   6) Si total >= 15 y no estaba unlocked → success + unlock
 *
 * El minijuego SIEMPRE devuelve success=true cuando alcanza el goal.
 * Si la sesión termina sin alcanzar 15, devuelve success=false (pero
 * NO penaliza — sólo el caller checa si fue 'aborted' para no aplicar
 * cooldown).
 */

const PANEL_DEPTH = 2000;
const ROUND_CARDS = 10;
const MATCHES_TO_WIN = 15;
const LIKES_PER_SESSION = 3;

type Phase = 'idle' | 'card' | 'matching' | 'chat' | 'final';

/** Cooldown 3h entre sesiones. */
export const TINDER_COOLDOWN_MS = 3 * 60 * 60 * 1000;

/** ¿Se puede jugar Tinder ahora mismo? (3h desde última sesión.) */
export function canPlayTinder(): boolean {
  const last = useProgressStore.getState().tinderLastSessionAtMs;
  if (last === 0) return true;
  return Date.now() - last >= TINDER_COOLDOWN_MS;
}

/** Label "vuelve en Xh Ym" o null si ya está disponible. */
export function tinderCooldownLabel(): string | null {
  const last = useProgressStore.getState().tinderLastSessionAtMs;
  if (last === 0) return null;
  const remaining = TINDER_COOLDOWN_MS - (Date.now() - last);
  if (remaining <= 0) return null;
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `vuelve en ${hours}h ${mins}m`;
  return `vuelve en ${mins}m`;
}

export const runTinderCatMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>(async (resolve) => {
    const totalMatched = useProgressStore.getState().tinderMatchedIds.length;
    const ok = await showMinigameIntro(ctx.scene, {
      title: 'TINDER CAT',
      description:
        `Pretendientes: ${totalMatched}/${MATCHES_TO_WIN}.\n\n` +
        `${ROUND_CARDS} cartas por sesión. Nala te da pistas.\n` +
        'Tienes 3 likes — úsalos sabiamente.\n' +
        'Si NO gastas ninguno, no hay cooldown.',
      controls: '← PASA  ·  → LIKE  ·  ESC salir',
    });
    if (!ok) return resolve({ success: false, reason: 'aborted' });
    new TinderCatGame(ctx, resolve).start();
  });
};

class TinderCatGame {
  private ctx: MinigameContext;
  private resolveOuter: (r: MinigameResult) => void;

  // Estado.
  private phase: Phase = 'idle';
  private finished = false;
  private cards: TinderCatProfile[] = [];
  private reciprocatingIds: Set<string> = new Set();
  private nalaHints: Record<string, 'good' | 'bad' | 'unsure'> = {};
  private currentIdx = 0;
  /** Likes restantes esta sesión (3 max). */
  private likesRemaining = LIKES_PER_SESSION;
  /** ¿Se gastó al menos un like? Para decidir si aplicar cooldown 3h. */
  private likesUsedAny = false;
  /** Matches conseguidos en ESTA sesión (para mostrar al final). */
  private sessionMatches: TinderCatProfile[] = [];
  /** Resultado win/lose para el final. */
  private lastResultWin = false;

  // Visuales — shell.
  private dim!: Phaser.GameObjects.Rectangle;
  private panelBorder!: Phaser.GameObjects.Rectangle;
  private panelBg!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private hudCounter!: Phaser.GameObjects.Text;
  private hudMatches!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  // Card components (recreados por carta).
  private cardLayer: Phaser.GameObjects.GameObject[] = [];
  private matchLayer: Phaser.GameObjects.GameObject[] = [];
  private chatLayer: Phaser.GameObjects.GameObject[] = [];
  private chatBubbleResolve: (() => void) | null = null;

  // Centro.
  private cx = 0;
  private cy = 0;
  private readonly PW = 280;
  private readonly PH = 240;

  private keyDownHandler!: (e: KeyboardEvent) => void;

  constructor(ctx: MinigameContext, resolve: (r: MinigameResult) => void) {
    this.ctx = ctx;
    this.resolveOuter = resolve;
  }

  start(): void {
    // Día 9e: el cooldown YA NO se marca al empezar — sólo si gastaste
    // algún like. El finish() se encarga.
    const store = useProgressStore.getState();
    // Inicializa los 15 destinos preasignados la primera vez.
    if (store.tinderDestinoIds.length === 0) {
      store.setTinderDestinos(generateDestinos());
    }
    const destinos = useProgressStore.getState().tinderDestinoIds;
    const matched = useProgressStore.getState().tinderMatchedIds;
    const round = buildTinderRound(ROUND_CARDS, matched, destinos);
    this.cards = round.cards;
    this.reciprocatingIds = round.reciprocatingIds;
    this.nalaHints = round.nalaHints;

    this.buildShell();
    this.bindInput();
    this.showCard(0);
  }

  // ──────────────────────────────────────────────────────────────────
  // SHELL UI
  // ──────────────────────────────────────────────────────────────────

  private buildShell(): void {
    const cam = this.ctx.scene.cameras.main;
    this.cx = cam.width / 2;
    this.cy = cam.height / 2;

    this.dim = this.ctx.scene.add
      .rectangle(this.cx, this.cy, cam.width, cam.height, 0x000000, 0.78)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH);
    this.panelBorder = this.ctx.scene.add
      .rectangle(this.cx, this.cy, this.PW + 4, this.PH + 4, 0xff8ab8, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.panelBg = this.ctx.scene.add
      .rectangle(this.cx, this.cy, this.PW, this.PH, 0x1a0e08, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);

    this.titleText = this.ctx.scene.add
      .text(this.cx, this.cy - this.PH / 2 + 11, 'TINDER CAT', S.header({ color: '#ff8ab8' }))
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.hudCounter = this.ctx.scene.add
      .text(this.cx - this.PW / 2 + 10, this.cy - this.PH / 2 + 24, '', {
        fontFamily: FONT_STACK,
        fontSize: '7px',
        color: COLORS.gray,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.hudMatches = this.ctx.scene.add
      .text(this.cx + this.PW / 2 - 10, this.cy - this.PH / 2 + 24, '', {
        fontFamily: FONT_STACK,
        fontSize: '7px',
        color: '#ff8ab8',
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.hintText = this.ctx.scene.add
      .text(this.cx, this.cy + this.PH / 2 - 10, '← PASA  ·  → LIKE  ·  ESC salir', S.hint())
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
      if (this.phase === 'card') {
        if (k === 'ARROWLEFT' || k === 'A' || k === 'Q') {
          e.preventDefault();
          this.swipe(false);
        } else if (k === 'ARROWRIGHT' || k === 'D' || k === 'E') {
          e.preventDefault();
          this.swipe(true);
        }
      }
    };
    window.addEventListener('keydown', this.keyDownHandler);
    this.ctx.scene.events.once('shutdown', () => this.abort());
    this.ctx.scene.events.once('destroy', () => this.abort());
  }

  // ──────────────────────────────────────────────────────────────────
  // CARD RENDERING
  // ──────────────────────────────────────────────────────────────────

  private clearCardLayer(): void {
    for (const o of this.cardLayer) (o as Phaser.GameObjects.GameObject).destroy();
    this.cardLayer = [];
  }

  private showCard(idx: number): void {
    if (this.finished) return;
    if (idx >= this.cards.length) {
      this.beginFinal();
      return;
    }
    this.currentIdx = idx;
    this.phase = 'card';
    this.refreshHud();
    this.clearCardLayer();
    const profile = this.cards[idx];
    this.renderCard(profile);
  }

  private renderCard(profile: TinderCatProfile): void {
    const cardW = this.PW - 30;
    const cardH = 150;
    const cardX = this.cx;
    const cardY = this.cy - 4;

    const border = this.ctx.scene.add
      .rectangle(cardX, cardY, cardW + 2, cardH + 2, 0xfbbf24, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);
    const bg = this.ctx.scene.add
      .rectangle(cardX, cardY, cardW, cardH, 0x2c1f15, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 5);
    this.cardLayer.push(border, bg);

    // Día 9e: pista de Nala arriba de la carta — no garantizada, mentirosa
    // a veces. Color según kind: green/red/gray.
    const hintKind = this.nalaHints[profile.id] ?? 'unsure';
    const hintColor =
      hintKind === 'good' ? COLORS.success : hintKind === 'bad' ? COLORS.error : COLORS.gray;
    const hintLine = nalaHintLine(hintKind);
    const hintText = this.ctx.scene.add
      .text(cardX, cardY - cardH / 2 - 10, '· Nala: ' + hintLine + ' ·', {
        fontFamily: FONT_STACK,
        fontSize: '7px',
        color: hintColor,
        fontStyle: 'italic',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);
    this.cardLayer.push(hintText);

    const photoY = cardY - cardH / 2 + 38;
    const photoBg = this.ctx.scene.add
      .rectangle(cardX, photoY, cardW - 8, 60, profile.faceTint, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);
    this.cardLayer.push(photoBg);

    // Cara procedural.
    const faceY = photoY + 4;
    const eyeOffsetX = 12;
    const eyeY = faceY - 2;
    const eyeL = this.ctx.scene.add
      .circle(cardX - eyeOffsetX, eyeY, 3, 0x1a0e08, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 7);
    const eyeR = this.ctx.scene.add
      .circle(cardX + eyeOffsetX, eyeY, 3, 0x1a0e08, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 7);
    const eyeShineL = this.ctx.scene.add
      .circle(cardX - eyeOffsetX + 1, eyeY - 1, 1, 0xffffff, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 8);
    const eyeShineR = this.ctx.scene.add
      .circle(cardX + eyeOffsetX + 1, eyeY - 1, 1, 0xffffff, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 8);
    const nose = this.ctx.scene.add
      .triangle(cardX, faceY + 4, 0, -2, -3, 2, 3, 2, 0xff8ab8, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 7);
    const mouth = this.ctx.scene.add
      .text(cardX, faceY + 9, 'w', {
        fontFamily: FONT_STACK,
        fontSize: '7px',
        color: '#3a2618',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 7);
    const whiskerStrokes: Phaser.GameObjects.Line[] = [
      this.ctx.scene.add.line(0, 0, cardX - 8, faceY + 5, cardX - 22, faceY + 3, 0x3a2618, 1),
      this.ctx.scene.add.line(0, 0, cardX - 8, faceY + 7, cardX - 22, faceY + 8, 0x3a2618, 1),
      this.ctx.scene.add.line(0, 0, cardX + 8, faceY + 5, cardX + 22, faceY + 3, 0x3a2618, 1),
      this.ctx.scene.add.line(0, 0, cardX + 8, faceY + 7, cardX + 22, faceY + 8, 0x3a2618, 1),
    ];
    for (const w of whiskerStrokes) {
      w.setLineWidth(1);
      w.setScrollFactor(0).setDepth(PANEL_DEPTH + 7);
    }
    const earL = this.ctx.scene.add
      .triangle(cardX - 18, faceY - 14, 0, -8, -6, 4, 6, 4, profile.faceTint, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 7);
    const earR = this.ctx.scene.add
      .triangle(cardX + 18, faceY - 14, 0, -8, -6, 4, 6, 4, profile.faceTint, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 7);
    const earInL = this.ctx.scene.add
      .triangle(cardX - 18, faceY - 12, 0, -4, -3, 2, 3, 2, 0xff8ab8, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 8);
    const earInR = this.ctx.scene.add
      .triangle(cardX + 18, faceY - 12, 0, -4, -3, 2, 3, 2, 0xff8ab8, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 8);

    this.cardLayer.push(
      eyeL, eyeR, eyeShineL, eyeShineR, nose, mouth,
      ...whiskerStrokes, earL, earR, earInL, earInR,
    );

    const infoY = cardY - cardH / 2 + 78;
    const nameText = this.ctx.scene.add
      .text(cardX, infoY, profile.name + ', ' + profile.age, {
        fontFamily: FONT_STACK,
        fontSize: '11px',
        color: COLORS.textWhite,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);
    this.cardLayer.push(nameText);

    const tagText = this.ctx.scene.add
      .text(cardX, infoY + 14, profile.tag, {
        fontFamily: FONT_STACK,
        fontSize: '8px',
        color: profile.tagColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);
    this.cardLayer.push(tagText);

    const bioText = this.ctx.scene.add
      .text(cardX, cardY + cardH / 2 - 22, profile.bio, {
        fontFamily: FONT_STACK,
        fontSize: '8px',
        color: COLORS.textBeige,
        align: 'center',
        wordWrap: { width: cardW - 20, useAdvancedWrap: true },
        lineSpacing: 2,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);
    this.cardLayer.push(bioText);

    const actionsY = this.cy + this.PH / 2 - 26;
    const passBg = this.ctx.scene.add
      .circle(this.cx - 50, actionsY, 11, 0x4b5563, 1)
      .setStrokeStyle(2, 0x9ca3af, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);
    const passLabel = this.ctx.scene.add
      .text(this.cx - 50, actionsY, '✗', {
        fontFamily: FONT_STACK,
        fontSize: '12px',
        color: COLORS.textWhite,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 5);
    const likeEnabled = this.likesRemaining > 0;
    const likeBg = this.ctx.scene.add
      .circle(this.cx + 50, actionsY, 11, likeEnabled ? 0xff8ab8 : 0x4b5563, 1)
      .setStrokeStyle(2, likeEnabled ? 0xfbcfe8 : 0x9ca3af, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);
    const likeLabel = this.ctx.scene.add
      .text(this.cx + 50, actionsY, '♥', {
        fontFamily: FONT_STACK,
        fontSize: '12px',
        color: likeEnabled ? COLORS.textWhite : '#1a0e08',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 5);
    this.cardLayer.push(passBg, passLabel, likeBg, likeLabel);

    passBg.setInteractive({ useHandCursor: true });
    passBg.on('pointerdown', () => this.swipe(false));
    if (likeEnabled) {
      likeBg.setInteractive({ useHandCursor: true });
      likeBg.on('pointerdown', () => this.swipe(true));
    }
  }

  private refreshHud(): void {
    this.hudCounter.setText('carta ' + (this.currentIdx + 1) + '/' + this.cards.length);
    // Día 9e: HUD lado dcho ahora muestra likes restantes (no matches).
    this.hudMatches.setText('♥ ' + this.likesRemaining + '/' + LIKES_PER_SESSION);
  }

  // ──────────────────────────────────────────────────────────────────
  // SWIPE FLOW
  // ──────────────────────────────────────────────────────────────────

  private async swipe(liked: boolean): Promise<void> {
    if (this.phase !== 'card' || this.finished) return;
    // Día 9e: bloquea like cuando se agotaron los 3.
    if (liked && this.likesRemaining <= 0) return;
    const profile = this.cards[this.currentIdx];

    if (liked) {
      this.likesRemaining -= 1;
      this.likesUsedAny = true;
      this.refreshHud();
    }

    const dir = liked ? 1 : -1;
    this.phase = 'matching';
    const targets = [...this.cardLayer];
    this.ctx.scene.tweens.add({
      targets,
      x: '+=' + dir * 280,
      alpha: 0,
      duration: 280,
      ease: 'Cubic.easeIn',
      onComplete: async () => {
        if (this.finished) return;
        this.clearCardLayer();
        const isMatch = liked && this.reciprocatingIds.has(profile.id);
        if (isMatch) {
          this.sessionMatches.push(profile);
          useProgressStore.getState().addTinderMatch(profile.id);
          await this.showMatchOverlay(profile);
          if (this.finished) return;
          if (profile.chat && profile.chat.length > 0) {
            await this.runMatchChat(profile);
          }
        } else if (liked && !isMatch) {
          await this.showRejectFlash(profile);
        }
        if (this.finished) return;
        this.showCard(this.currentIdx + 1);
      },
    });
  }

  private showMatchOverlay(profile: TinderCatProfile): Promise<void> {
    return new Promise<void>((resolve) => {
      this.phase = 'matching';
      const cam = this.ctx.scene.cameras.main;
      const dimm = this.ctx.scene.add
        .rectangle(this.cx, this.cy, cam.width, cam.height, 0xff8ab8, 0.18)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 9);
      const matchText = this.ctx.scene.add
        .text(this.cx, this.cy - 12, "It's a MATCH!", {
          fontFamily: FONT_STACK,
          fontSize: '18px',
          color: '#ff8ab8',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 10)
        .setScale(0.4)
        .setAlpha(0);
      const subText = this.ctx.scene.add
        .text(this.cx, this.cy + 8, profile.name, {
          fontFamily: FONT_STACK,
          fontSize: '11px',
          color: COLORS.textWhite,
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 10)
        .setAlpha(0);

      this.matchLayer.push(dimm, matchText, subText);

      this.ctx.scene.tweens.add({
        targets: matchText,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: 380,
        ease: 'Back.easeOut',
      });
      this.ctx.scene.tweens.add({
        targets: subText,
        alpha: 1,
        duration: 380,
        delay: 250,
      });

      this.ctx.scene.time.delayedCall(1500, () => {
        if (this.finished) return resolve();
        for (const o of this.matchLayer) {
          if ((o as Phaser.GameObjects.GameObject & { scene?: unknown }).scene) {
            o.destroy();
          }
        }
        this.matchLayer = [];
        resolve();
      });
    });
  }

  private showRejectFlash(_profile: TinderCatProfile): Promise<void> {
    return new Promise<void>((resolve) => {
      const txt = this.ctx.scene.add
        .text(this.cx, this.cy, 'no match.', {
          fontFamily: FONT_STACK,
          fontSize: '11px',
          color: COLORS.gray,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 10)
        .setAlpha(0);
      this.ctx.scene.tweens.add({
        targets: txt,
        alpha: 1,
        duration: 200,
        yoyo: true,
        hold: 350,
        onComplete: () => {
          txt.destroy();
          resolve();
        },
      });
    });
  }

  private async runMatchChat(profile: TinderCatProfile): Promise<void> {
    if (!profile.chat) return;
    this.phase = 'chat';
    for (const line of profile.chat) {
      if (this.finished) return;
      await this.showChatBubble(profile, line);
    }
  }

  private showChatBubble(
    profile: TinderCatProfile,
    line: TinderChatLine,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = this.ctx.scene.cameras.main;
      const isMaria = line.sender === 'maria';
      const bubbleW = this.PW - 60;
      const bubbleH = 50;
      const bubbleY = this.cy + (isMaria ? 30 : -30);
      const bubbleX = this.cx + (isMaria ? 30 : -30);

      const dimm = this.ctx.scene.add
        .rectangle(this.cx, this.cy, cam.width, cam.height, 0x000000, 0.45)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 9);
      const speakerLabel = this.ctx.scene.add
        .text(
          bubbleX,
          bubbleY - bubbleH / 2 - 8,
          isMaria ? 'María' : profile.name,
          {
            fontFamily: FONT_STACK,
            fontSize: '8px',
            color: isMaria ? '#ff8ab8' : profile.tagColor,
            fontStyle: 'bold',
          },
        )
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 11);
      const bubbleBg = this.ctx.scene.add
        .rectangle(
          bubbleX,
          bubbleY,
          bubbleW,
          bubbleH,
          isMaria ? 0xff8ab8 : 0x3a2618,
          1,
        )
        .setStrokeStyle(2, isMaria ? 0xfbcfe8 : 0x6b4425, 1)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 10);
      const bubbleText = this.ctx.scene.add
        .text(bubbleX, bubbleY, line.text, {
          fontFamily: FONT_STACK,
          fontSize: '9px',
          color: isMaria ? '#1a0e08' : COLORS.textWhite,
          align: 'center',
          wordWrap: { width: bubbleW - 14, useAdvancedWrap: true },
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 11);
      const continueHint = this.ctx.scene.add
        .text(this.cx, this.cy + this.PH / 2 - 10, 'SPACE / ENTER continuar', {
          fontFamily: FONT_STACK,
          fontSize: '7px',
          color: COLORS.yellow,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 11);

      this.chatLayer.push(dimm, speakerLabel, bubbleBg, bubbleText, continueHint);

      const close = () => {
        window.removeEventListener('keydown', onKey);
        for (const o of [dimm, speakerLabel, bubbleBg, bubbleText, continueHint]) {
          if ((o as Phaser.GameObjects.GameObject & { scene?: unknown }).scene) {
            o.destroy();
          }
        }
        this.chatLayer = this.chatLayer.filter(
          (o) =>
            o !== dimm &&
            o !== speakerLabel &&
            o !== bubbleBg &&
            o !== bubbleText &&
            o !== continueHint,
        );
        this.chatBubbleResolve = null;
        resolve();
      };
      this.chatBubbleResolve = close;
      const onKey = (e: KeyboardEvent) => {
        if (this.finished) {
          close();
          return;
        }
        const k = (e.key || '').toUpperCase();
        if (k === ' ' || k === 'SPACEBAR' || k === 'ENTER') {
          e.preventDefault();
          close();
        } else if (k === 'ESCAPE' || k === 'ESC') {
          e.preventDefault();
          close();
        }
      };
      window.addEventListener('keydown', onKey);
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // FINAL
  // ──────────────────────────────────────────────────────────────────

  private beginFinal(): void {
    this.phase = 'final';
    this.refreshHud();
    this.clearCardLayer();

    const total = useProgressStore.getState().tinderMatchedIds.length;
    const goalReached = total >= MATCHES_TO_WIN;
    this.lastResultWin = goalReached;

    const cardW = this.PW - 30;
    const cardH = 150;
    const cardX = this.cx;
    const cardY = this.cy - 4;

    const accentColor = goalReached ? 0x4ade80 : 0xff8ab8;
    const border = this.ctx.scene.add
      .rectangle(cardX, cardY, cardW + 2, cardH + 2, accentColor, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4);
    const bg = this.ctx.scene.add
      .rectangle(cardX, cardY, cardW, cardH, 0x2c1f15, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 5);

    const titleResult = this.ctx.scene.add
      .text(
        cardX,
        cardY - cardH / 2 + 14,
        goalReached ? '¡15 PRETENDIENTES!' : 'sesión cerrada',
        {
          fontFamily: FONT_STACK,
          fontSize: goalReached ? '12px' : '12px',
          color: goalReached ? COLORS.success : '#ff8ab8',
          fontStyle: 'bold',
        },
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);

    // Lista de matches conseguidos en esta sesión.
    let yCursor = cardY - cardH / 2 + 32;
    const hits = this.sessionMatches.length;
    const hitsLabel = this.ctx.scene.add
      .text(cardX, yCursor, hits === 0 ? 'sin matches esta sesión' : `+${hits} match${hits > 1 ? 'es' : ''} esta sesión:`, {
        fontFamily: FONT_STACK,
        fontSize: '8px',
        color: COLORS.gray,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);
    yCursor += 12;

    this.cardLayer.push(border, bg, titleResult, hitsLabel);

    for (const m of this.sessionMatches) {
      const matchName = this.ctx.scene.add
        .text(cardX, yCursor, '· ' + m.name + '  (' + m.tag + ')', {
          fontFamily: FONT_STACK,
          fontSize: '9px',
          color: m.tagColor,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 6);
      this.cardLayer.push(matchName);
      yCursor += 10;
    }

    // Progreso 0/15.
    const progressY = cardY + cardH / 2 - 28;
    const progressBarBg = this.ctx.scene.add
      .rectangle(cardX, progressY, cardW - 24, 8, 0x3a2618, 1)
      .setStrokeStyle(1, 0x6b4425, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);
    const fillRatio = Math.min(1, total / MATCHES_TO_WIN);
    const fillW = (cardW - 26) * fillRatio;
    const progressBarFg = this.ctx.scene.add
      .rectangle(cardX - (cardW - 26) / 2, progressY, fillW, 6, accentColor, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 7);
    const progressLabel = this.ctx.scene.add
      .text(cardX, progressY + 12, total + '/' + MATCHES_TO_WIN + '  pretendientes', {
        fontFamily: FONT_STACK,
        fontSize: '9px',
        color: COLORS.textBeige,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);
    this.cardLayer.push(progressBarBg, progressBarFg, progressLabel);

    const closeHint = this.ctx.scene.add
      .text(this.cx, this.cy + this.PH / 2 - 26, goalReached ? 'SPACE/ENTER cobrar regalo' : 'SPACE/ENTER cerrar  ·  vuelve en 3h', {
        fontFamily: FONT_STACK,
        fontSize: '8px',
        color: COLORS.yellow,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 6);
    this.cardLayer.push(closeHint);
  }

  private finishFromFinal(): void {
    this.finish(this.lastResultWin, this.lastResultWin ? 'completed' : 'failed');
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
    // Día 9e: cooldown 3h SÓLO si gastaste algún like. Si solo miraste
    // perfiles sin dar like, la sesión es gratis.
    if (this.likesUsedAny) {
      useProgressStore.getState().markTinderSession();
    }
    this.cleanup();
    this.resolveOuter({ success, reason });
  }

  private cleanup(): void {
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
    if (this.chatBubbleResolve) {
      this.chatBubbleResolve();
      this.chatBubbleResolve = null;
    }
    for (const o of this.chatLayer) {
      if ((o as Phaser.GameObjects.GameObject & { scene?: unknown }).scene) {
        o.destroy();
      }
    }
    this.chatLayer = [];
    this.clearCardLayer();
    for (const o of this.matchLayer) {
      if ((o as Phaser.GameObjects.GameObject & { scene?: unknown }).scene) {
        o.destroy();
      }
    }
    this.matchLayer = [];
    [
      this.dim,
      this.panelBorder,
      this.panelBg,
      this.titleText,
      this.hudCounter,
      this.hudMatches,
      this.hintText,
    ].forEach((o) => o?.destroy());
  }
}
