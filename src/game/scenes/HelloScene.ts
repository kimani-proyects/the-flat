import * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * HelloScene — smoke test del Día 1.
 * Demuestra que Phaser está vivo dentro de Next.js.
 * Se reemplazará por la secuencia intro (partida de LoL) en el Día 7-8.
 */
export class HelloScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HelloScene' });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add
      .text(cx, cy - 30, 'THE FLAT', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ff5c8a',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 4, 'Keep it Cutre', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#5eead4',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 24, 'Hola, María.', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#e8e6df',
      })
      .setOrigin(0.5);

    // Parpadeo suave como señal de "motor vivo"
    const heartbeat = this.add
      .text(cx, GAME_HEIGHT - 18, 'phaser ok ✦', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#5eead4',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: heartbeat,
      alpha: { from: 1, to: 0.3 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });
  }
}
