import * as Phaser from 'phaser';
import { S, COLORS, FONT_STACK } from '../../systems/TextStyle';

/**
 * MinigameIntroPanel — pop-up tutorial pre-minijuego (Día 7.5 it.4).
 *
 * Antes de arrancar la mecánica del minijuego, mostramos un panel con:
 *   - Título grande
 *   - Descripción breve (NO desvela mecánicas avanzadas — sólo lo
 *     necesario para entender la propuesta)
 *   - Línea de controles
 *   - "SPACE / ENTER para empezar  ·  ESC para salir"
 *
 * Resuelve a:
 *   - true  → la jugadora confirmó (SPACE o ENTER)
 *   - false → la jugadora abortó (ESC)
 *
 * Uso desde un minijuego runner:
 *
 *   const ok = await showMinigameIntro(ctx.scene, {
 *     title: 'PIEDRA · PAPEL · TIJERA',
 *     description: 'Es un piedra papel o tijeras. Vence a Alex para abrir.',
 *     controls: '1=piedra · 2=papel · 3=tijera',
 *   });
 *   if (!ok) return resolve({ success: false, reason: 'aborted' });
 *
 * Como cualquier diálogo modal del juego, NO debe usar removeKey() en su
 * cleanup — Phaser reusa la Key con la apartment scene y romperíamos el
 * input WASD del player. Sólo removeAllListeners en las Keys que añadió.
 */

export interface MinigameIntroOpts {
  title: string;
  description: string;
  controls: string;
  /**
   * Color del marco (en hex). Por defecto amarillo de la UI Modern Style 1
   * (#fbbf24). Para minijuegos con tinte propio (TOC-TOC turquesa, etc.)
   * se puede personalizar.
   */
  borderColor?: number;
}

const PANEL_DEPTH = 2500; // por encima de cualquier panel de minijuego (que vive en 1700-2000)

export function showMinigameIntro(
  scene: Phaser.Scene,
  opts: MinigameIntroOpts,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const cam = scene.cameras.main;
    const PW = 320; // it.6: subido de 280 → 320 para acomodar texto +grande.
    const PH = 200; // it.6: subido de 170 → 200 (texto desc 8→10px, controls/hint 7→9px).
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const border = opts.borderColor ?? 0xfbbf24;

    const dim = scene.add
      .rectangle(cx, cy, cam.width, cam.height, 0x000000, 0.78)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH);

    const panelBorder = scene.add
      .rectangle(cx, cy, PW + 4, PH + 4, border, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    const panelBg = scene.add
      .rectangle(cx, cy, PW, PH, 0x1a0e08, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);

    const titleText = scene.add
      .text(cx, cy - PH / 2 + 14, opts.title, S.header())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Línea separadora bajo el título.
    const sep = scene.add
      .rectangle(cx, cy - PH / 2 + 26, PW - 24, 1, 0x6b4425, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    const descText = scene.add
      .text(
        cx,
        cy - 12,
        opts.description,
        S.body({ align: 'center', wordWrap: PW - 28, lineSpacing: 3 }),
      )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    const controlsText = scene.add
      .text(cx, cy + PH / 2 - 30, opts.controls, S.hint())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Hint de inicio. Le hacemos un pulse suave para que llame la atención.
    const hintText = scene.add
      .text(cx, cy + PH / 2 - 14, 'SPACE / ENTER para empezar  ·  ESC para salir', {
        fontFamily: FONT_STACK,
        fontSize: '9px',
        color: COLORS.yellow,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);
    const hintTween = scene.tweens.add({
      targets: hintText,
      alpha: { from: 1, to: 0.45 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    const kb = scene.input.keyboard;
    let done = false;
    let keyDownHandler: ((e: KeyboardEvent) => void) | null = null;

    const cleanup = (result: boolean) => {
      if (done) return;
      done = true;
      hintTween.stop();
      [dim, panelBorder, panelBg, titleText, sep, descText, controlsText, hintText].forEach((o) =>
        o?.destroy(),
      );
      if (keyDownHandler) {
        window.removeEventListener('keydown', keyDownHandler);
      }
      resolve(result);
    };

    // Listener nativo del navegador para SPACE / ENTER / ESC. Más limpio
    // que enganchar tres Keys de Phaser que requieren cleanup específico.
    keyDownHandler = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        e.preventDefault();
        cleanup(true);
      } else if (k === 'Escape' || k === 'Esc') {
        e.preventDefault();
        cleanup(false);
      }
    };
    window.addEventListener('keydown', keyDownHandler);

    // Defensive: por si Phaser se desmonta, también escucha al evento de
    // shutdown de la escena para no dejar listeners vivos.
    scene.events.once('shutdown', () => cleanup(false));
    scene.events.once('destroy', () => cleanup(false));
  });
}
