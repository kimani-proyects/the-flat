import * as Phaser from 'phaser';

/**
 * DebugPaletteScene — debug overlay.
 *
 * Se lanza desde ApartmentScene con tecla 'P'. Muestra los 4 tilesets
 * LimeZu a escala cómoda con una grilla ligera y hover-tooltip que
 * indica el globalId del tile bajo el ratón. Con eso puedes identificar
 * qué número meter en scripts/tile-ids.json.
 *
 * Controles:
 *   ← → Tab ESC  — cambiar de tileset / cerrar
 *   Mouse wheel  — scroll vertical del tileset (muchos son más altos que pantalla)
 *   Hover        — muestra globalId del tile
 */

interface TilesetInfo {
  key: string;
  firstgid: number;
}

const TILESETS: TilesetInfo[] = [
  { key: 'Room_Builder_16x16', firstgid: 1 },
  { key: 'Room_Builder_Floors_16x16', firstgid: 8589 },
  { key: 'Room_Builder_Walls_16x16', firstgid: 9189 },
  { key: 'Interiors_16x16', firstgid: 10469 },
];

const TILE = 16;
const SCALE = 2; // render x2 para verlo mejor

export class DebugPaletteScene extends Phaser.Scene {
  private idx = 0;
  private image?: Phaser.GameObjects.Image;
  private grid?: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  private infoText?: Phaser.GameObjects.Text;
  private hoverText?: Phaser.GameObjects.Text;
  private hoverBox?: Phaser.GameObjects.Rectangle;
  private offsetY = 0;

  constructor() {
    super({ key: 'DebugPaletteScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');

    // Overlay oscuro.
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.92)
      .setOrigin(0, 0)
      .setDepth(0);

    this.titleText = this.add.text(6, 4, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#5eead4',
    }).setDepth(100);

    this.infoText = this.add.text(6, this.scale.height - 14, '← → cambiar · ESC cerrar · rueda scroll', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#ff5c8a',
    }).setDepth(100);

    this.hoverBox = this.add.rectangle(0, 0, TILE * SCALE, TILE * SCALE)
      .setStrokeStyle(1, 0xffd700, 1)
      .setFillStyle(0xffd700, 0.15)
      .setOrigin(0, 0)
      .setDepth(90)
      .setVisible(false);

    this.hoverText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#ffd700',
      backgroundColor: '#000000cc',
      padding: { x: 3, y: 1 },
    }).setDepth(101).setVisible(false);

    this.renderTileset();

    // Input.
    if (this.input.keyboard) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.input.keyboard.on('keydown-LEFT', () => this.cycle(-1));
      this.input.keyboard.on('keydown-RIGHT', () => this.cycle(+1));
      this.input.keyboard.on('keydown-TAB', () => this.cycle(+1));
      this.input.keyboard.on('keydown-ESC', () => this.close());
      this.input.keyboard.on('keydown-P', () => this.close());
      this.input.keyboard.addKey(K.LEFT);
      this.input.keyboard.addKey(K.RIGHT);
    }

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.offsetY = Phaser.Math.Clamp(this.offsetY - dy, this.minOffsetY(), 0);
      this.repositionImage();
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onHover(p));
  }

  private current(): TilesetInfo {
    return TILESETS[this.idx];
  }

  private cycle(delta: number): void {
    this.idx = (this.idx + delta + TILESETS.length) % TILESETS.length;
    this.offsetY = 0;
    this.renderTileset();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('ApartmentScene');
  }

  private renderTileset(): void {
    const ts = this.current();
    this.image?.destroy();
    this.grid?.destroy();

    if (!this.textures.exists(ts.key)) {
      this.titleText?.setText(`[${this.idx + 1}/${TILESETS.length}] ${ts.key} — TEXTURA NO CARGADA`);
      return;
    }

    const src = this.textures.get(ts.key).getSourceImage() as HTMLImageElement;
    const w = src.width * SCALE;
    const h = src.height * SCALE;
    const cols = Math.floor(src.width / TILE);
    const rows = Math.floor(src.height / TILE);

    this.image = this.add.image(6, 20 + this.offsetY, ts.key)
      .setOrigin(0, 0)
      .setScale(SCALE)
      .setDepth(10);

    const g = this.add.graphics({
      lineStyle: { width: 1, color: 0xffffff, alpha: 0.15 },
    }).setDepth(11);
    for (let c = 0; c <= cols; c++) {
      g.lineBetween(6 + c * TILE * SCALE, 20 + this.offsetY,
                    6 + c * TILE * SCALE, 20 + this.offsetY + h);
    }
    for (let r = 0; r <= rows; r++) {
      g.lineBetween(6, 20 + this.offsetY + r * TILE * SCALE,
                    6 + w, 20 + this.offsetY + r * TILE * SCALE);
    }
    this.grid = g;

    this.titleText?.setText(
      `[${this.idx + 1}/${TILESETS.length}] ${ts.key}  ` +
      `${cols}x${rows} = ${cols * rows} tiles  ` +
      `firstgid=${ts.firstgid}  rango ${ts.firstgid}..${ts.firstgid + cols * rows - 1}`,
    );
  }

  private repositionImage(): void {
    if (this.image) this.image.setY(20 + this.offsetY);
    if (this.grid) {
      this.grid.destroy();
      // Redibujar grid con nuevo offset.
      this.renderTileset();
    }
  }

  private minOffsetY(): number {
    const ts = this.current();
    if (!this.textures.exists(ts.key)) return 0;
    const src = this.textures.get(ts.key).getSourceImage() as HTMLImageElement;
    const h = src.height * SCALE;
    return Math.min(0, this.scale.height - 30 - h);
  }

  private onHover(p: Phaser.Input.Pointer): void {
    const ts = this.current();
    if (!this.textures.exists(ts.key)) {
      this.hoverBox?.setVisible(false);
      this.hoverText?.setVisible(false);
      return;
    }
    const src = this.textures.get(ts.key).getSourceImage() as HTMLImageElement;
    const cols = Math.floor(src.width / TILE);
    const rows = Math.floor(src.height / TILE);

    const localX = p.x - 6;
    const localY = p.y - 20 - this.offsetY;
    if (localX < 0 || localY < 0 || localX >= cols * TILE * SCALE || localY >= rows * TILE * SCALE) {
      this.hoverBox?.setVisible(false);
      this.hoverText?.setVisible(false);
      return;
    }

    const tileCol = Math.floor(localX / (TILE * SCALE));
    const tileRow = Math.floor(localY / (TILE * SCALE));
    const localId = tileRow * cols + tileCol;
    const globalId = ts.firstgid + localId;

    this.hoverBox
      ?.setPosition(6 + tileCol * TILE * SCALE, 20 + this.offsetY + tileRow * TILE * SCALE)
      .setVisible(true);

    this.hoverText
      ?.setPosition(p.x + 10, p.y + 10)
      .setText(`id=${globalId}  local=${localId}  col=${tileCol} row=${tileRow}`)
      .setVisible(true);
  }
}
