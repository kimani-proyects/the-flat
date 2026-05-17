import * as Phaser from 'phaser';
import { S, COLORS, FONT_STACK } from './TextStyle';
import { Portraits } from './Portraits';
import { Sfx } from './SfxBank';

/**
 * CatMenu — panel modal por gato (Día 8c).
 *
 * Cuando María pulsa E sobre un gato, se abre este panel con opciones:
 *   - Hablar / Acariciar  → diálogo (lo de siempre, con personalidad)
 *   - Jugar conmigo       → minijuego específico del gato (Día 13+)
 *   - Darle algo          → introducir regalo IRL (Día 13+)
 *   - Cerrar              → vuelve al juego
 *
 * Mientras el menú está abierto, CatSystem congela el gato (setFrozen).
 *
 * El menú devuelve via Promise una opción seleccionada:
 *   'talk' | 'play' | 'gift' | 'close'
 *
 * Las opciones disponibles las decide el caller (CatSystem) según el
 * gato (Haku puede tener "preguntar por los regalos" en lugar de "hablar"
 * normal, Nala puede tener "ignora a María si Alex conectado", etc.).
 */

export type CatMenuChoice = 'talk' | 'feed' | 'play' | 'gift' | 'close';

export interface CatMenuOptions {
  /** Nombre del gato mostrado como header. */
  catLabel: string;
  /** Speaker key para el portrait (Portraits.has). */
  portraitKey: string;
  /** Subtítulo opcional bajo el nombre (ej. "ronroneando", "durmiendo"). */
  subtitle?: string;
  /** Lista de opciones a mostrar. Permite ocultar las que no aplican. */
  choices?: Array<{
    id: CatMenuChoice;
    label: string;
    /** Si false, se muestra grisáceo y no se puede elegir. */
    enabled?: boolean;
    /** Pista pequeña debajo del label (ej. "Próximamente" para gift). */
    hint?: string;
  }>;
}

const PANEL_DEPTH = 2200; // por encima de DialogSystem (1900) pero debajo de IntroPanel (2500)

export function showCatMenu(
  scene: Phaser.Scene,
  opts: CatMenuOptions,
): Promise<CatMenuChoice> {
  return new Promise<CatMenuChoice>((resolve) => {
    const cam = scene.cameras.main;
    const PW = 240;
    const PH = 180;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    const dim = scene.add
      .rectangle(cx, cy, cam.width, cam.height, 0x000000, 0.55)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH);
    const border = scene.add
      .rectangle(cx, cy, PW + 4, PH + 4, COLORS.yellow as unknown as number, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    const bg = scene.add
      .rectangle(cx, cy, PW, PH, 0x1a0e08, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);

    // Portrait + título + subtítulo (header).
    const headerY = cy - PH / 2 + 16;
    const portrait = Portraits.has(scene, opts.portraitKey)
      ? Portraits.create(scene, cx - 80, headerY + 6, opts.portraitKey)
      : null;
    if (portrait) {
      portrait.setDepth(PANEL_DEPTH + 3);
    }
    const title = scene.add
      .text(cx + (portrait ? 10 : 0), headerY, opts.catLabel, S.header())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);
    let subtitleObj: Phaser.GameObjects.Text | null = null;
    if (opts.subtitle) {
      subtitleObj = scene.add
        .text(cx + (portrait ? 10 : 0), headerY + 14, opts.subtitle, S.hint({ italic: true }))
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 3);
    }

    // Separador.
    const sep = scene.add
      .rectangle(cx, headerY + 32, PW - 24, 1, 0x6b4425, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Choices defaults si no se pasan.
    const choices = opts.choices ?? [
      { id: 'talk' as CatMenuChoice, label: 'Hablar / acariciar', enabled: true },
      { id: 'play' as CatMenuChoice, label: 'Jugar conmigo', enabled: false, hint: 'Próximamente' },
      { id: 'gift' as CatMenuChoice, label: 'Darle algo', enabled: false, hint: 'Próximamente' },
      { id: 'close' as CatMenuChoice, label: 'Cerrar', enabled: true },
    ];

    // Cursor visual: marcador a la izquierda de la opción seleccionada.
    let cursor = 0;
    const enabledIdxs = choices
      .map((c, i) => (c.enabled === false ? -1 : i))
      .filter((i) => i >= 0);
    if (enabledIdxs.length === 0) {
      // No hay opciones habilitadas — abortamos con close.
      resolve('close');
      return;
    }
    cursor = enabledIdxs[0];

    const choiceY = (i: number) => sep.y + 16 + i * 18;
    const choiceTexts: Phaser.GameObjects.Text[] = [];
    const choiceHints: Array<Phaser.GameObjects.Text | null> = [];
    const cursorMark = scene.add
      .text(cx - PW / 2 + 14, choiceY(cursor), '▶', {
        fontFamily: FONT_STACK,
        fontSize: '11px',
        color: COLORS.yellow,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    for (let i = 0; i < choices.length; i++) {
      const c = choices[i];
      const enabled = c.enabled !== false;
      const txt = scene.add
        .text(cx - PW / 2 + 28, choiceY(i), c.label, {
          fontFamily: FONT_STACK,
          fontSize: '11px',
          color: enabled ? COLORS.textWhite : COLORS.grayDark,
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 3);
      choiceTexts.push(txt);
      if (c.hint) {
        const hint = scene.add
          .text(cx + PW / 2 - 10, choiceY(i), c.hint, S.hint({ italic: true }))
          .setOrigin(1, 0.5)
          .setScrollFactor(0)
          .setDepth(PANEL_DEPTH + 3);
        choiceHints.push(hint);
      } else {
        choiceHints.push(null);
      }
    }

    const help = scene.add
      .text(cx, cy + PH / 2 - 10, '↑/↓ moverse · SPACE/ENTER elegir · ESC cerrar', S.hint())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    let done = false;
    const moveCursor = (delta: number) => {
      const enabledArr = enabledIdxs;
      const curEnabledI = enabledArr.indexOf(cursor);
      const nextEnabledI = (curEnabledI + delta + enabledArr.length) % enabledArr.length;
      cursor = enabledArr[nextEnabledI];
      cursorMark.y = choiceY(cursor);
    };

    const close = (choice: CatMenuChoice) => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', keyHandler);
      [
        dim,
        border,
        bg,
        title,
        sep,
        cursorMark,
        help,
      ].forEach((o) => o.destroy());
      if (portrait) portrait.destroy();
      if (subtitleObj) subtitleObj.destroy();
      choiceTexts.forEach((t) => t.destroy());
      choiceHints.forEach((h) => h?.destroy());
      resolve(choice);
    };

    const keyHandler = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') {
        e.preventDefault();
        moveCursor(-1);
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        e.preventDefault();
        moveCursor(+1);
      } else if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        e.preventDefault();
        close(choices[cursor].id);
      } else if (k === 'Escape' || k === 'Esc') {
        e.preventDefault();
        close('close');
      }
    };
    window.addEventListener('keydown', keyHandler);

    scene.events.once('shutdown', () => close('close'));
    scene.events.once('destroy', () => close('close'));
  });
}
