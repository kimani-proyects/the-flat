import * as Phaser from 'phaser';
import { useProgressStore } from '../../lib/stores/gameStore';
import { CATS_MANIFEST, CANONICAL_ANIMS } from '../data/catsManifest';
import { getAllImageLoads } from '../systems/LimeZuRenderer';

/**
 * BootScene — carga inicial global.
 *
 * Precarga tilesets LimeZu, tilemap, y sprites de personajes. Si algún asset
 * falla, loggeamos y seguimos; ApartmentScene tiene fallback a placeholders
 * procedurales para que siempre arranque algo.
 *
 * Claves de los tilesets (el NAME debe coincidir con el name del tileset
 * dentro de apartment.tmj para que Phaser encuentre la imagen):
 *   - 'Room_Builder_16x16'
 *   - 'Room_Builder_Floors_16x16'
 *   - 'Room_Builder_Walls_16x16'
 *   - 'Interiors_16x16'
 *
 * Sprites:
 *   - 'maria' : spritesheet 16x16 (LimeZu Character Generator, 16x16 folder).
 *               Las animaciones (idle/walk 4-dir, etc.) se definirán cuando
 *               /inspector devuelva los rangos reales de frames. Frame 0 es
 *               placeholder y NO se asume como idle-down aún.
 *   - 'alex'  : spritesheet 32x32 (LimeZu Character Generator 32x32).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      // eslint-disable-next-line no-console
      console.warn(
        `[BootScene] Asset no encontrado: ${file.key} (${file.url}). ` +
          `Seguimos con placeholders.`,
      );
    });

    // --- Tilesets (cargados con el MISMO name que aparece en el .tmj) ---
    this.load.image(
      'Room_Builder_16x16',
      '/assets/tilesets/limezu/Room_Builder_16x16.png',
    );
    this.load.image(
      'Room_Builder_Floors_16x16',
      '/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png',
    );
    this.load.image(
      'Room_Builder_Walls_16x16',
      '/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Walls_16x16.png',
    );
    this.load.image(
      'Interiors_16x16',
      '/assets/tilesets/limezu/Interiors_16x16.png',
    );

    // --- Mapa ---
    this.load.tilemapTiledJSON('apartment-map', '/assets/maps/apartment.tmj');

    // --- Personajes ---
    // IMPORTANTE: los sheets de LimeZu Character Generator tienen un
    // "header row" de 16 px arriba (3 mini-avatares para UI) y luego
    // filas de personajes de 16×32 cada uno (cabeza+cuerpo). Si lo
    // cargamos como spritesheet directo, frame 0 sale cortado.
    // Solución: lo cargamos como IMAGE y registramos los frames a mano
    // en ApartmentScene.registerCharacterFrames() con el offset correcto.
    this.load.image('maria', '/assets/sprites/characters/maria.png');
    this.load.image('alex', '/assets/sprites/characters/alex.png');

    // Día 9-pre v3 — gatos. Carga como IMAGE (no spritesheet con frame
    // size fijo). CatAnimations leerá dimensiones reales + frame size
    // del manifest (override por anim si aplica) y generará frames
    // manualmente con tex.add. Esto soporta:
    //   - Frame sizes distintos por anim del mismo gato (kero-idle 16
    //     vs kero-walk 32).
    //   - PNGs sin spritesheet zero-frame issues.
    //   - Carga robusta sin crashes si dimensión nominal != real.
    for (const catId of Object.keys(CATS_MANIFEST)) {
      for (const anim of CANONICAL_ANIMS) {
        const key = `${catId}-${anim}`;
        this.load.image(key, `/assets/sprites/cats/${key}.png`);
      }
    }

    // S2 — Animated furniture (LimeZu 3_Animated_objects, 16x16).
    // 16x16 alinea con TILE_SIZE del juego. Sprites de 1 tile = 16x16,
    // 1×2 (alto, fridge) = 16×32 → FurnitureRenderer detecta dims reales.
    // Modelo nuevo: STATIC por defecto. Anim sólo cuando el handler
    // llama playOneShot. Excepción: TV (loop mientras está ON).
    //
    // Si los PNGs no están, los warnings en preload no rompen — la escena
    // recurre a placeholders procedurales.
    const FURNI_BASE = '/assets/tilesets/limezu/3_Animated_objects/16x16/spritesheets/';

    // Salón.
    this.load.image('tv-16', FURNI_BASE + 'animated_TV_reportage.png');

    // Cocina.
    this.load.image('fridge-16', FURNI_BASE + 'animated_fridge.png');
    this.load.image('oven-16', FURNI_BASE + 'animated_kitchen_oven_4cookers.png');
    this.load.image('kitchen-sink-16', FURNI_BASE + 'animated_kitchen_sink_2.png');

    // Baño.
    this.load.image(
      'mirror-approach-16',
      FURNI_BASE + 'animated_mirror_person_approaching_3.png',
    );
    this.load.image('bathtub-16', FURNI_BASE + 'animated_bathtub.png');
    this.load.image(
      'bathroom-sink-16',
      FURNI_BASE + 'animated_bathroom_sink_new_3-10 loop.png',
    );
    this.load.image(
      'bathroom-cabinet-16',
      FURNI_BASE + 'animated_bathroom_cabinet_white_full.png',
    );

    // Decoración (no usados todavía, listo para S2.2).
    this.load.image('candle-16', FURNI_BASE + 'animated_candle.png');
    this.load.image('cuckoo-16', FURNI_BASE + 'animated_cuckoo_clock.png');

    // S2.2 — Altavoces (amplifier) para hab Alex, sustituyendo wardrobe.
    this.load.image('amplifier-16', FURNI_BASE + 'animated_amplifier.png');

    // S2.4 — Theme Sorter sheets para mobiliario estático.
    // Cada sheet tiene ~16x16 tiles de 16px. Extraemos regiones por
    // coordenada en StaticFurnitureRenderer.
    const THEME_BASE = '/assets/tilesets/limezu/1_Interiors/16x16/Theme_Sorter/';
    this.load.image('theme-livingroom', THEME_BASE + '2_LivingRoom_16x16.png');
    this.load.image('theme-bedroom', THEME_BASE + '4_Bedroom_16x16.png');
    this.load.image('theme-kitchen', THEME_BASE + '12_Kitchen_16x16.png');
    this.load.image('theme-bathroom', THEME_BASE + '3_Bathroom_16x16.png');
    this.load.image('theme-generic', THEME_BASE + '1_Generic_16x16.png');

    // --- UI: ModernUI Style 1 ---
    // Sheet genérica con todos los frames de UI (paneles, teclas, iconos,
    // barras, botones). Al cargar como IMAGE podemos pedir sub-rectángulos
    // concretos con this.textures.get('ui').add(name, 0, x, y, w, h) desde
    // UiAtlas (ver src/game/systems/UiAtlas.ts) sin tener que conocer la
    // rejilla global del sheet — algunos frames son 16×16 pero otros son
    // 32×16 (teclas anchas) o incluso paneles 48×48.
    this.load.image('ui', '/assets/ui/16x16/Modern_UI_Style_1.png');

    // S2.9: assets LimeZu Theme_Sorter_Black_Shadow_Singles (sprites individuales).
    for (const it of getAllImageLoads()) {
      this.load.image(it.key, it.path);
    }
  }

  create(): void {
    // Día 8.5: esperamos a que Silkscreen (cargada por next/font/google
    // en layout.tsx) esté lista en el documento ANTES de pasar a
    // IntroScene/HubScene. Si no, el primer texto que dibuja Phaser usa
    // monospace y luego "salta" a Silkscreen — visualmente feo.
    //
    // It.8.5b: `document.fonts.ready` puede resolver ANTES de que la
    // fuente real (.woff2) termine de descargarse — en navegadores
    // Chromium, ready se cumple cuando el CSS @font-face se parsea, no
    // cuando el fetch del binario acaba. Para forzar la carga real,
    // usamos `document.fonts.load('14px Silkscreen')` que devuelve una
    // promise resuelta cuando la fuente está realmente disponible para
    // pintar. Sin esto, alex reportó "no veo cambio en las fonts".
    // S1 (Día 10): fuera la IntroScene LoL. Siempre arrancamos en Hub.
    // El primer arranque mostrará un tutorial-overlay encima del Hub
    // (ver HubScene → introPlayed flag). Esto da continuidad visual y
    // ahorra una escena innecesaria.
    const start = () => {
      this.scene.start('HubScene');
    };
    // Silenciamos linter: useProgressStore ya no se usa aquí.
    void useProgressStore;
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      let started = false;
      const guarded = (reason: string) => {
        if (started) return;
        started = true;
        // eslint-disable-next-line no-console
        console.log(
          `[BootScene] fonts ready (${reason}). Silkscreen check:`,
          document.fonts.check('14px Silkscreen'),
        );
        start();
      };
      Promise.all([
        document.fonts.load('14px Silkscreen'),
        document.fonts.load('bold 14px Silkscreen'),
      ])
        .then((loaded) => {
          // eslint-disable-next-line no-console
          console.log('[BootScene] Silkscreen.load resolved with', loaded.length, 'faces');
          guarded('load-resolved');
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[BootScene] Silkscreen.load failed:', err);
          guarded('load-error');
        });
      this.time.delayedCall(3000, () => guarded('timeout'));
    } else {
      start();
    }
  }
}
