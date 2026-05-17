import * as Phaser from 'phaser';
import { setLimeZuTexture } from './LimeZuRenderer';

/**
 * MusicSession — flujo común para "tocar/dar cuerda" a instrumentos/juguetes:
 *
 *   1. Diálogo Y/N opcional.
 *   2. Fade out → arranca audio → fade in.
 *   3. Mientras suena:
 *      - lockMovement=true: María no se mueve, notas musicales sobre ella.
 *        Pulsa ESC para salir antes de tiempo.
 *      - lockMovement=false: María se puede mover, pero el SPRITE del
 *        objeto hace shake + alterna entre 2 texturas si shakeAlt está.
 *   4. Cuando termina (o se cancela): fade out → fade in → desbloquea.
 */

export interface MusicSessionOpts {
  scene: Phaser.Scene;
  track: string;                 // path al .mp3 (e.g. '/assets/audio/music/kirk.mp3')
  promptTitle?: string;          // título del modal Y/N (omite para skip)
  spriteKey?: string;            // key LimeZu del sprite que toca/se mueve
  shakeAlt?: string;             // segundo key para alternar (giro juguete)
  lockMovement: boolean;         // true=María quieta + notas; false=libre + shake
  volume?: number;               // 0-1, default 0.7
}

const NOTE_CHARS = ['♪', '♫', '♩', '♬'];
const NOTE_COLORS = ['#fde047', '#5eead4', '#ff8ab8', '#a78bfa'];

export async function playMusicSession(opts: MusicSessionOpts): Promise<void> {
  const { scene, track, lockMovement } = opts;
  const cam = scene.cameras.main;
  const W = cam.width, H = cam.height;
  const D = 2500;

  // 1. Diálogo Y/N opcional.
  if (opts.promptTitle) {
    const els: Phaser.GameObjects.GameObject[] = [];
    els.push(
      scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setScrollFactor(0).setDepth(D),
      scene.add.rectangle(W / 2, H / 2, 220, 90, 0x1a0e2a, 1)
        .setStrokeStyle(2, 0xfde047, 1).setScrollFactor(0).setDepth(D + 1),
      scene.add.text(W / 2, H / 2 - 22, opts.promptTitle, {
        fontFamily: 'monospace', fontSize: '11px', color: '#fde047', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 2),
    );
    const choices = ['SÍ', 'NO'];
    let cursor = 0;
    const texts = choices.map((c, i) =>
      scene.add.text(W / 2, H / 2 + i * 14, '  ' + c, {
        fontFamily: 'monospace', fontSize: '11px', color: '#fafaf5',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 2),
    );
    els.push(...texts);
    const render = () => {
      for (let i = 0; i < choices.length; i++) {
        texts[i].setText((i === cursor ? '▸ ' : '  ') + choices[i]);
        texts[i].setColor(i === cursor ? '#fde047' : '#fafaf5');
      }
    };
    render();
    const choice = await new Promise<number>((resolve) => {
      const onKey = (e: KeyboardEvent) => {
        const k = e.key;
        if (k === 'ArrowUp' || k === 'w' || k === 'ArrowDown' || k === 's') {
          e.preventDefault(); cursor = (cursor + 1) % choices.length; render();
        } else if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          window.removeEventListener('keydown', onKey);
          resolve(cursor);
        } else if (k === 'Escape' || k === 'Esc') {
          e.preventDefault();
          window.removeEventListener('keydown', onKey);
          resolve(1);
        }
      };
      window.addEventListener('keydown', onKey);
    });
    for (const o of els) if ((o as { scene?: unknown }).scene) o.destroy();
    if (choice !== 0) return;
  }

  // 2. Fade out → arranca audio → fade in.
  cam.fadeOut(700, 0, 0, 0);
  await new Promise<void>((r) => cam.once('camerafadeoutcomplete', () => r()));
  cam.fadeIn(700, 0, 0, 0);

  const audio = new Audio(track);
  audio.volume = opts.volume ?? 0.7;
  audio.play().catch(() => {});

  // 3a. Hint ESC SIEMPRE visible (locked o no — siempre puedes cortar).
  const escHintBg = scene.add.rectangle(W / 2, H - 14, 200, 18, 0x000000, 0.85)
    .setStrokeStyle(1, 0xfde047, 1)
    .setScrollFactor(0).setDepth(D + 10);
  const escHint = scene.add.text(W / 2, H - 14, 'Pulsa ESC para salir', {
    fontFamily: 'monospace', fontSize: '9px', color: '#fde047', fontStyle: 'bold',
  }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 11);
  // 3b. Si lockMovement: notas musicales encima de María.
  const notes: Phaser.GameObjects.Text[] = [];
  let noteTimer: Phaser.Time.TimerEvent | null = null;
  if (lockMovement) {
    const sceneAny = scene as { maria?: { x: number; y: number } };
    const mariaRef = sceneAny.maria;
    if (mariaRef) {
      noteTimer = scene.time.addEvent({
        delay: 350, loop: true,
        callback: () => {
          const n = scene.add.text(
            mariaRef.x + (Math.random() * 16 - 8), mariaRef.y - 24,
            NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)],
            {
              fontFamily: 'monospace', fontSize: '12px',
              color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
              fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
            },
          ).setOrigin(0.5, 0.5).setDepth(50);
          notes.push(n);
          scene.tweens.add({
            targets: n, y: n.y - 36, alpha: 0,
            duration: 1400, ease: 'Quad.easeOut',
            onComplete: () => { if ((n as { scene?: unknown }).scene) n.destroy(); },
          });
        },
      });
    }
  }

  // 3b. Si !lockMovement: shake + alterna texturas del sprite (juguete cuerda).
  let shakeTimer: Phaser.Time.TimerEvent | null = null;
  let altToggle = false;
  if (!lockMovement && opts.spriteKey) {
    shakeTimer = scene.time.addEvent({
      delay: 180, loop: true,
      callback: () => {
        // Shake: pequeño temblor de la imagen.
        const children = scene.children.list as Phaser.GameObjects.GameObject[];
        for (const obj of children) {
          const img = obj as Phaser.GameObjects.Image;
          if (img.type === 'Image' && (img.texture?.key === opts.spriteKey || img.texture?.key === opts.shakeAlt)) {
            img.x += (Math.random() - 0.5) * 1.5;
            img.y += (Math.random() - 0.5) * 1.5;
          }
        }
        // Alterna textura cada 360ms (cada 2 ticks).
        if (opts.shakeAlt && altToggle) {
          const fromKey = altToggle ? opts.spriteKey! : opts.shakeAlt;
          const toKey = altToggle ? opts.shakeAlt : opts.spriteKey!;
          setLimeZuTexture(scene, fromKey, toKey);
        }
        altToggle = !altToggle;
      },
    });
  }

  // 4. Esperar a que acabe el audio o ESC (si lockMovement).
  const cleanup = () => {
    try { audio.pause(); } catch { /* ignore */ }
    if (noteTimer) noteTimer.remove();
    if (shakeTimer) shakeTimer.remove();
    for (const n of notes) if ((n as { scene?: unknown }).scene) n.destroy();
    if (escHint && (escHint as { scene?: unknown }).scene) escHint.destroy();
    if (escHintBg && (escHintBg as { scene?: unknown }).scene) escHintBg.destroy();
    // Si alterna, volver al sprite base.
    if (opts.spriteKey && opts.shakeAlt) {
      setLimeZuTexture(scene, opts.shakeAlt, opts.spriteKey);
    }
  };

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      window.removeEventListener('keydown', onKey);
      resolve();
    };
    audio.addEventListener('ended', finish, { once: true });
    // Si el archivo NO carga (404), audio.error dispara — evita loop infinito.
    audio.addEventListener('error', finish, { once: true });
    audio.play().catch(() => finish());
    // Safety: si dura > 10min, salimos igual.
    setTimeout(finish, 600_000);
    // ESC para salir SIEMPRE (lockMovement o no).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
  });

  // 5. Fade out → fade in para reanudar.
  cam.fadeOut(500, 0, 0, 0);
  await new Promise<void>((r) => cam.once('camerafadeoutcomplete', () => r()));
  cam.fadeIn(500, 0, 0, 0);
}
