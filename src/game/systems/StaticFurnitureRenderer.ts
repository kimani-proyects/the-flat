import * as Phaser from 'phaser';
import { TILE_SIZE } from '../data/floorplan';

/**
 * StaticFurnitureRenderer — pinta muebles ESTÁTICOS por habitación
 * (S2.4). Procedural por ahora (rectángulos + detalles) para llenar la
 * casa de vida sin esperar a la extracción de sprites de LimeZu.
 *
 * Cada item se pinta en una posición de tile concreta con un footprint
 * (ancho × alto en tiles) y un color base. La paleta es cozy (tonos
 * cálidos y rosados/marrones para María, azules/grises para Alex).
 *
 * Hitboxes opcionales — algunos muebles bloquean paso (sofá, mesa),
 * otros no (alfombra). El parámetro `solid` controla esto.
 */

interface StaticItem {
  /** Tile top-left donde se ancla el mueble. */
  x: number;
  y: number;
  /** Tamaño en tiles. */
  w: number;
  h: number;
  /** Color base (hex). */
  color: number;
  /** Color de detalle (sombra, borde). */
  detail?: number;
  /** Si true, añade hitbox sólido. */
  solid?: boolean;
  /** Tipo de detalle decorativo. */
  kind?:
    | 'counter'
    | 'sofa'
    | 'sofa-vertical'
    | 'table'
    | 'bed'
    | 'wardrobe'
    | 'bookshelf'
    | 'plant'
    | 'rug'
    | 'rug-jinx'
    | 'rug-ekko'
    | 'lamp'
    | 'pc-desk'
    | 'mat';
  /** Pintar el detalle? Default true. */
  decorate?: boolean;
}

/**
 * Lista de muebles del piso. Cuidadosamente colocados para que la
 * casa "respire" — no demasiados, cada uno con su sitio. El usuario
 * lo iterará si hay que mover algo.
 */
const STATIC_FURNITURE: StaticItem[] = [
  // S2.10: LIMPIO — los muebles "cuerpo" (camas, sofá, TV, PCs, mesa
  // salón, armario, bookshelf, plantas) los pinta ahora LimeZuRenderer
  // con sprites reales. Aquí sólo queda lo que LimeZu NO tiene todavía:
  //
  //   - Counter de cocina (la barra de madera continuada)
  //   - Mesa comedor (LimeZu no la cubre aún)
  //   - Alfombras (rug rosa salón, rug Jinx María, rug Ekko Alex)
  //   - Felpudo entrada
  //   - Mat baño
  //
  // El resto FUERA para no solapar visualmente con los sprites LimeZu.

  // ── COCINA: counter continuo bajo los electrodomésticos ───────────
  { x: 15, y: 2, w: 14, h: 1, color: 0x8b6f47, detail: 0x6b4425, kind: 'counter' },
  // Mesa de comedor (4 tiles, con asiento de madera).
  { x: 21, y: 6, w: 4, h: 2, color: 0x9b7a4f, detail: 0x6b4425, solid: true, kind: 'table' },

  // ── SALÓN: alfombra (sofá/TV/mesita/bookshelf van por LimeZu) ─────
  { x: 35, y: 8, w: 6, h: 2, color: 0xf4b8c8, detail: 0xd998a8, kind: 'rug' },

  // ── HABITACIÓN MARÍA: solo alfombra Jinx (resto LimeZu) ───────────
  { x: 33, y: 17, w: 8, h: 4, color: 0xff2e9f, detail: 0x00e5ff, kind: 'rug-jinx' },

  // ── HABITACIÓN ALEX: solo alfombra Ekko (cama LimeZu) ─────────────
  { x: 4, y: 23, w: 7, h: 4, color: 0x5e3aae, detail: 0x14b8a6, kind: 'rug-ekko' },

  // ── ENTRADA: felpudo en la puerta principal ───────────────────────
  { x: 18, y: 30, w: 2, h: 1, color: 0x6b4425, detail: 0x4a2818, kind: 'mat' },

  // ── BAÑO: alfombra delante del lavabo ─────────────────────────────
  { x: 4, y: 14, w: 2, h: 1, color: 0x8ab4d8, detail: 0x5e8aa5, kind: 'mat' },
];

export class StaticFurnitureRenderer {
  private scene: Phaser.Scene;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private staticGroup: Phaser.Physics.Arcade.StaticGroup | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  init(player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle): void {
    this.staticGroup = this.scene.physics.add.staticGroup();
    for (const item of STATIC_FURNITURE) {
      this.drawItem(item);
    }
    if (this.staticGroup && player) {
      this.scene.physics.add.collider(player, this.staticGroup);
    }
  }

  private drawItem(item: StaticItem): void {
    const px = item.x * TILE_SIZE;
    const py = item.y * TILE_SIZE;
    const pw = item.w * TILE_SIZE;
    const ph = item.h * TILE_SIZE;

    // Base del mueble.
    const base = this.scene.add
      .rectangle(px + pw / 2, py + ph / 2, pw, ph, item.color, 1)
      .setDepth(8);
    this.objects.push(base);

    // Borde inferior con tono más oscuro para sensación de "asiento".
    if (item.detail !== undefined) {
      const edge = this.scene.add
        .rectangle(px + pw / 2, py + ph - 2, pw, 2, item.detail, 1)
        .setDepth(9);
      this.objects.push(edge);
    }

    // Detalle según kind.
    if (item.decorate !== false) {
      this.drawKindDetails(item, px, py, pw, ph);
    }

    // Hitbox sólido (si aplica).
    if (item.solid) {
      const collider = this.scene.add.rectangle(px + pw / 2, py + ph / 2, pw, ph);
      this.scene.physics.add.existing(collider, true);
      this.staticGroup?.add(collider);
    }
  }

  private drawKindDetails(item: StaticItem, px: number, py: number, pw: number, ph: number): void {
    const detail = item.detail ?? 0x000000;
    switch (item.kind) {
      case 'counter': {
        // Líneas verticales para "puertas de armario" cada tile.
        for (let i = 1; i < item.w; i++) {
          const lx = px + i * TILE_SIZE;
          this.objects.push(
            this.scene.add
              .line(0, 0, lx, py + 2, lx, py + ph - 2, detail, 0.7)
              .setLineWidth(1)
              .setOrigin(0, 0)
              .setDepth(9),
          );
        }
        // Pomos pequeños — dot en el centro de cada "puerta".
        for (let i = 0; i < item.w; i++) {
          const dx = px + i * TILE_SIZE + TILE_SIZE / 2;
          this.objects.push(
            this.scene.add
              .circle(dx, py + ph / 2, 1.5, detail, 1)
              .setDepth(10),
          );
        }
        break;
      }
      case 'sofa': {
        // Cojines: 3 rectángulos sobre la base.
        const cushionH = ph * 0.5;
        for (let i = 0; i < 3; i++) {
          const cx = px + (i + 0.5) * (pw / 3);
          this.objects.push(
            this.scene.add
              .rectangle(cx, py + cushionH / 2 + 2, (pw / 3) - 4, cushionH - 4, item.color * 1.1 & 0xffffff, 1)
              .setStrokeStyle(1, detail, 1)
              .setDepth(10),
          );
        }
        // Respaldo (banda más oscura arriba).
        this.objects.push(
          this.scene.add
            .rectangle(px + pw / 2, py + 2, pw, 4, detail, 1)
            .setDepth(11),
        );
        break;
      }
      case 'table': {
        // Patas en las esquinas.
        const legW = 3;
        const legH = 4;
        const legCorners = [
          [px + 1, py + ph - legH],
          [px + pw - 1 - legW, py + ph - legH],
        ];
        for (const [lx, ly] of legCorners) {
          this.objects.push(
            this.scene.add
              .rectangle(lx + legW / 2, ly + legH / 2, legW, legH, detail, 1)
              .setDepth(7),
          );
        }
        break;
      }
      case 'bed': {
        // Almohada: rectángulo blanco arriba.
        const pillowH = ph * 0.35;
        this.objects.push(
          this.scene.add
            .rectangle(px + pw / 2, py + pillowH / 2 + 2, pw - 6, pillowH - 4, 0xfafaf5, 1)
            .setStrokeStyle(1, detail, 1)
            .setDepth(10),
        );
        // Manta: rectángulo más oscuro abajo.
        this.objects.push(
          this.scene.add
            .rectangle(px + pw / 2, py + ph - pillowH / 2 - 2, pw - 6, pillowH * 1.2, detail, 0.5)
            .setDepth(10),
        );
        break;
      }
      case 'wardrobe': {
        // 2 puertas verticales.
        const midX = px + pw / 2;
        this.objects.push(
          this.scene.add
            .line(0, 0, midX, py + 2, midX, py + ph - 2, detail, 1)
            .setLineWidth(1)
            .setOrigin(0, 0)
            .setDepth(10),
        );
        // 2 pomos.
        this.objects.push(
          this.scene.add.circle(midX - 4, py + ph / 2, 1.5, detail, 1).setDepth(11),
        );
        this.objects.push(
          this.scene.add.circle(midX + 4, py + ph / 2, 1.5, detail, 1).setDepth(11),
        );
        break;
      }
      case 'bookshelf': {
        // Líneas horizontales (estantes).
        for (let i = 1; i < 3; i++) {
          const ly = py + (i / 3) * ph;
          this.objects.push(
            this.scene.add
              .line(0, 0, px + 2, ly, px + pw - 2, ly, detail, 1)
              .setLineWidth(1)
              .setOrigin(0, 0)
              .setDepth(10),
          );
        }
        // "Libros" — barritas verticales de colores en cada estante.
        const colors = [0xb91c1c, 0x16a34a, 0x2563eb, 0xfbbf24, 0x9333ea];
        for (let i = 0; i < 8; i++) {
          const bx = px + 2 + i * 1.6;
          const bh = 4 + Math.random() * 4;
          const c = colors[i % colors.length];
          this.objects.push(
            this.scene.add
              .rectangle(bx, py + ph - bh / 2 - 2, 1.5, bh, c, 1)
              .setDepth(11),
          );
        }
        break;
      }
      case 'plant': {
        // Maceta marrón abajo.
        this.objects.push(
          this.scene.add
            .rectangle(px + pw / 2, py + ph - 4, pw - 4, 6, detail, 1)
            .setDepth(9),
        );
        // Hojas verdes (3 círculos solapados).
        const leafColor = item.color;
        const cx = px + pw / 2;
        const cy = py + 4;
        for (const off of [-3, 0, 3]) {
          this.objects.push(
            this.scene.add
              .circle(cx + off, cy + Math.abs(off) / 2, 4, leafColor, 1)
              .setDepth(11),
          );
        }
        break;
      }
      case 'rug': {
        // Alfombra: borde más oscuro + patrón de cruz central.
        this.objects.push(
          this.scene.add
            .rectangle(px + pw / 2, py + ph / 2, pw - 2, ph - 2, item.color, 1)
            .setStrokeStyle(1, detail, 1)
            .setDepth(7), // por DEBAJO de los muebles
        );
        // Cruz decorativa.
        this.objects.push(
          this.scene.add
            .line(0, 0, px + 4, py + ph / 2, px + pw - 4, py + ph / 2, detail, 0.5)
            .setLineWidth(1)
            .setOrigin(0, 0)
            .setDepth(7),
        );
        break;
      }
      case 'rug-jinx': {
        // Alfombra Jinx: rosa #ff2e9f con líneas cyan + texto "JiNx WaS HeRe".
        this.objects.push(
          this.scene.add
            .rectangle(px + pw / 2, py + ph / 2, pw - 2, ph - 2, item.color, 1)
            .setStrokeStyle(2, detail, 1)
            .setDepth(7),
        );
        // Líneas glitch en X.
        for (let i = 0; i < 4; i++) {
          const ly = py + 6 + i * (ph / 4);
          this.objects.push(
            this.scene.add
              .line(0, 0, px + 4, ly, px + pw - 4, ly + (i % 2 ? 2 : -2), detail, 0.45)
              .setLineWidth(1)
              .setOrigin(0, 0)
              .setDepth(7),
          );
        }
        // Texto en centro.
        this.objects.push(
          this.scene.add
            .text(px + pw / 2, py + ph / 2, 'JiNx WaS HeRe', {
              fontFamily: "'Silkscreen', monospace",
              fontSize: '9px',
              color: '#fafaf5',
              fontStyle: 'bold',
            })
            .setOrigin(0.5, 0.5)
            .setDepth(7),
        );
        break;
      }
      case 'rug-ekko': {
        // Alfombra Ekko: morado con teal, círculos de "tiempo" + texto.
        this.objects.push(
          this.scene.add
            .rectangle(px + pw / 2, py + ph / 2, pw - 2, ph - 2, item.color, 1)
            .setStrokeStyle(2, detail, 1)
            .setDepth(7),
        );
        // Círculos concéntricos (motor del tiempo).
        const ccx = px + pw / 2;
        const ccy = py + ph / 2;
        for (const r of [10, 16, 22]) {
          this.objects.push(
            this.scene.add
              .circle(ccx, ccy, r, 0x000000, 0)
              .setStrokeStyle(1, detail, 0.6)
              .setDepth(7),
          );
        }
        // Diamante central (chronobreak).
        this.objects.push(
          this.scene.add
            .triangle(ccx, ccy - 4, 0, -4, -3, 0, 3, 0, detail, 1)
            .setDepth(7),
        );
        this.objects.push(
          this.scene.add
            .triangle(ccx, ccy + 4, 0, 4, -3, 0, 3, 0, detail, 1)
            .setDepth(7),
        );
        // Texto "ekko".
        this.objects.push(
          this.scene.add
            .text(px + 6, py + ph - 8, 'ekko', {
              fontFamily: "'Silkscreen', monospace",
              fontSize: '7px',
              color: '#14b8a6',
              fontStyle: 'italic',
            })
            .setOrigin(0, 0.5)
            .setDepth(7),
        );
        break;
      }
      case 'lamp': {
        // Pantalla cremosa arriba + base oscura.
        this.objects.push(
          this.scene.add
            .ellipse(px + pw / 2, py + 4, pw - 2, 6, item.color, 1)
            .setDepth(11),
        );
        this.objects.push(
          this.scene.add
            .rectangle(px + pw / 2, py + ph - 2, 2, 6, detail, 1)
            .setDepth(10),
        );
        break;
      }
      case 'pc-desk': {
        // Monitor: rectángulo oscuro arriba con pantalla cyan.
        this.objects.push(
          this.scene.add
            .rectangle(px + pw / 2, py + 4, pw / 2, 6, 0x1a1a1a, 1)
            .setDepth(11),
        );
        this.objects.push(
          this.scene.add
            .rectangle(px + pw / 2, py + 4, pw / 2 - 2, 4, 0x5eead4, 1)
            .setDepth(12),
        );
        break;
      }
      case 'mat': {
        // Líneas decorativas tipo cuerda.
        for (let i = 0; i < 3; i++) {
          const ly = py + 2 + i * 4;
          this.objects.push(
            this.scene.add
              .line(0, 0, px + 1, ly, px + pw - 1, ly, detail, 0.7)
              .setLineWidth(1)
              .setOrigin(0, 0)
              .setDepth(7),
          );
        }
        break;
      }
    }
  }

  destroy(): void {
    for (const o of this.objects) {
      if ((o as Phaser.GameObjects.GameObject & { scene?: unknown }).scene) o.destroy();
    }
    this.objects = [];
    if (this.staticGroup) {
      this.staticGroup.destroy(true);
      this.staticGroup = null;
    }
  }
}
