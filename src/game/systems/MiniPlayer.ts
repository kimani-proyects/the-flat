import * as Phaser from 'phaser';
import { AudioBus, MUSIC_TRACKS } from './AudioBus';
import { FONT_STACK } from './TextStyle';

/**
 * MiniPlayer — HUD compacto que aparece en la esquina superior izquierda
 * cuando hay música sonando. Muestra la carátula (jimmy.gif), título y
 * artista, y botones para play/pause, loop y siguiente.
 *
 * Phaser no soporta gifs animados nativamente — usamos un <img> HTML
 * absoluto encima del canvas, posicionado con CSS para que parezca
 * parte de la HUD. El resto (texto, botones) sí es Phaser para que se
 * integre con el resto del juego.
 *
 * Reacciona a `AudioBus.subscribe(...)` para refrescarse cuando cambia
 * el track o el estado de play/pause.
 */

const PLAYER_DEPTH = 1900;

export class MiniPlayer {
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private artistText!: Phaser.GameObjects.Text;
  private playPauseText!: Phaser.GameObjects.Text;
  private loopText!: Phaser.GameObjects.Text;
  private nextText!: Phaser.GameObjects.Text;
  private coverImg: HTMLImageElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private installed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  install(): void {
    if (this.installed) return;
    this.installed = true;
    const cam = this.scene.cameras.main;
    // Esquina superior izquierda del viewport (screen-fixed).
    const W = 92;
    const H = 28;
    const x = 4;
    const y = 4;

    // Fondo + borde.
    const bg = this.scene.add
      .rectangle(x + W / 2, y + H / 2, W, H, 0x0a0a0e, 0.85)
      .setStrokeStyle(1, 0xff2e9f, 1)
      .setScrollFactor(0)
      .setDepth(PLAYER_DEPTH);
    this.layer.push(bg);

    // Carátula: <img> HTML absoluto encima del canvas (jimmy.gif animado).
    if (typeof document !== 'undefined') {
      this.coverImg = document.createElement('img');
      this.coverImg.src = '/assets/audio/music/jimmy.gif';
      this.coverImg.alt = '';
      this.coverImg.style.position = 'fixed';
      this.coverImg.style.left = '0px';
      this.coverImg.style.top = '0px';
      this.coverImg.style.width = '24px';
      this.coverImg.style.height = '24px';
      this.coverImg.style.imageRendering = 'pixelated';
      this.coverImg.style.zIndex = '9999';
      this.coverImg.style.pointerEvents = 'none';
      this.coverImg.style.display = 'none';
      this.positionCover();
      document.body.appendChild(this.coverImg);
      // Reposiciona si la ventana cambia tamaño.
      window.addEventListener('resize', this.positionCover);
    }

    // Texto del track (título + artista). Empieza vacío.
    this.titleText = this.scene.add
      .text(x + 28, y + 6, '', {
        fontFamily: FONT_STACK,
        fontSize: '7px',
        color: '#fafaf5',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(PLAYER_DEPTH + 1);
    this.artistText = this.scene.add
      .text(x + 28, y + 14, '', {
        fontFamily: FONT_STACK,
        fontSize: '6px',
        color: '#9ca3af',
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(PLAYER_DEPTH + 1);

    // Botones (texto interactivo). ▶ pausa, ↻ loop, ▶▶ next.
    this.playPauseText = this.scene.add
      .text(x + 28, y + 22, '▶', {
        fontFamily: FONT_STACK,
        fontSize: '7px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(PLAYER_DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    this.playPauseText.on('pointerdown', () => AudioBus.togglePlayPause());

    this.loopText = this.scene.add
      .text(x + 50, y + 22, '↻', {
        fontFamily: FONT_STACK,
        fontSize: '7px',
        color: '#6b7280',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(PLAYER_DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    this.loopText.on('pointerdown', () => AudioBus.toggleLoop());

    this.nextText = this.scene.add
      .text(x + 72, y + 22, '▶▶', {
        fontFamily: FONT_STACK,
        fontSize: '7px',
        color: '#5eead4',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(PLAYER_DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    this.nextText.on('pointerdown', () => AudioBus.next());

    this.layer.push(this.titleText, this.artistText, this.playPauseText, this.loopText, this.nextText);

    this.unsubscribe = AudioBus.subscribe(() => this.refresh());
    this.refresh();
  }

  private positionCover = (): void => {
    if (!this.coverImg) return;
    const canvas = (this.scene.game.canvas as HTMLCanvasElement) ?? null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Esquina top-left del canvas + offset interno (escalado del viewport).
    const scaleX = rect.width / this.scene.cameras.main.width;
    this.coverImg.style.left = rect.left + 8 * scaleX + 'px';
    this.coverImg.style.top = rect.top + 8 * scaleX + 'px';
    this.coverImg.style.width = 20 * scaleX + 'px';
    this.coverImg.style.height = 20 * scaleX + 'px';
  };

  private refresh(): void {
    const track = AudioBus.getCurrent();
    const visible = !!track;
    // Texto.
    if (this.titleText.scene) this.titleText.setText(track ? truncate(track.title, 12) : '');
    if (this.artistText.scene) this.artistText.setText(track ? truncate(track.artist ?? '', 14) : '');
    // Botones — color según estado.
    if (this.playPauseText.scene) {
      this.playPauseText.setText(AudioBus.isPlaying() ? '⏸' : '▶');
    }
    if (this.loopText.scene) {
      this.loopText.setColor(AudioBus.isLoop() ? '#fbbf24' : '#6b7280');
    }
    // Visibilidad global.
    for (const o of this.layer) {
      (o as Phaser.GameObjects.GameObject & { setVisible?: (v: boolean) => void }).setVisible?.(visible);
    }
    if (this.coverImg) {
      this.coverImg.style.display = visible ? 'block' : 'none';
      if (visible) this.positionCover();
    }
  }

  destroy(): void {
    this.installed = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const o of this.layer) {
      if ((o as Phaser.GameObjects.GameObject & { scene?: unknown }).scene) o.destroy();
    }
    this.layer = [];
    if (this.coverImg && this.coverImg.parentNode) {
      this.coverImg.parentNode.removeChild(this.coverImg);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.positionCover);
    }
    this.coverImg = null;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ── Singleton de la sesión actual ────────────────────────────────────
// El piso (ApartmentScene) lo monta al init y lo destruye al shutdown.
// Persiste a través de minijuegos porque AudioBus es el que mantiene
// el estado real del audio.
let ACTIVE: MiniPlayer | null = null;

export function installMiniPlayer(scene: Phaser.Scene): MiniPlayer {
  if (ACTIVE) ACTIVE.destroy();
  ACTIVE = new MiniPlayer(scene);
  ACTIVE.install();
  return ACTIVE;
}

export function destroyMiniPlayer(): void {
  if (ACTIVE) {
    ACTIVE.destroy();
    ACTIVE = null;
  }
}
