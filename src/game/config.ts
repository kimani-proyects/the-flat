import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HelloScene } from './scenes/HelloScene';
import { IntroScene } from './scenes/IntroScene';
import { HubScene } from './scenes/HubScene';
import { ApartmentScene } from './scenes/ApartmentScene';
import { DebugPaletteScene } from './scenes/DebugPaletteScene';

/**
 * Configuración base del motor.
 * Resolución interna: 480x270 (16:9 pixel-perfect, ampliable a 1920x1080 con scale FIT).
 * Ideal para tilemaps a 16px y animaciones retro.
 */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

export const buildGameConfig = (parent: HTMLElement): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0c10',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  // Orden del array = orden en que Phaser registra las escenas. La primera
  // se autoinicia si no se especifica otra cosa, pero BootScene decide el
  // routing (ver BootScene.create()). IntroScene y HubScene viven antes de
  // ApartmentScene en el flujo narrativo.
  scene: [
    BootScene,
    HelloScene,
    IntroScene,
    HubScene,
    ApartmentScene,
    DebugPaletteScene,
  ],
});
