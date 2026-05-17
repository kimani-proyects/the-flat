import * as Phaser from 'phaser';
import {
  APARTMENT_CODE,
  useProgressStore,
} from '../../lib/stores/gameStore';
import { setupMaria, type Direction } from '../systems/CharacterSetup';
import { ensureUiAtlas, UI_FRAMES, hasUiFrame } from '../systems/UiAtlas';

/**
 * HubScene — El Rellano del Bloque (top-down).
 *
 * Arquitectura multi-usuario pensada desde el minuto uno: aunque este juego
 * es el regalo para María, el rellano está diseñado para escalar. En el
 * futuro, cuando regale el juego a otras personas, cada una tendrá su
 * propia puerta numerada en este rellano (2A / 2B / 2C / 2D…). Un único
 * ejecutable, múltiples destinatarios. La sesión decide qué puerta es
 * "la suya" — por ahora hard-coded a 2B (María); cuando haya cuenta de
 * usuario, server-side se asociará player_id → door_id + apartment_code.
 *
 * Vista: TOP-DOWN. Mismas reglas que ApartmentScene — 480×270 viewport,
 * tile virtual de 16 px, María se mueve con WASD/flechas con sus 8
 * animaciones (idle/walk × 4 dirs) reaprovechando el sprite y las
 * animaciones del piso (CharacterSetup.ts).
 *
 * Layout (en tiles de 16 px sobre el canvas 30×17 = 480×270):
 *
 *   Filas  0..3    Pared norte (con 4 puertas insertadas como huecos
 *                  decorativos + plate de número arriba).
 *   Filas  4..13   Pasillo (suelo parquet/beige).
 *   Filas 14..16   Pared sur (zócalo + sombra).
 *
 *   Las puertas 2A/2B/2C/2D están en x ∈ {3, 11, 19, 27} (4 puertas
 *   espaciadas equitativamente). Sólo 2B (la 2ª desde la izquierda) es
 *   jugable; las otras quedan reservadas para futuros destinatarios.
 *
 * Filosofía visual:
 *   - Mismo "vibe" LimeZu Modern Interiors que el piso: paleta cálida
 *     (beige #d4a574, marrón #5a3a2a, sombras frías #2a1a1f), líneas
 *     pixeladas, perspectiva top-down pura.
 *   - Sin tilemap Tiled aún (overkill para un pasillo simple). Construido
 *     con primitivas + bandas de color que respetan la rejilla 16×16.
 *   - Keypad popup usa Modern UI (panel beige) cuando los frames están
 *     registrados; si no, fallback a rect con stroke dorado.
 */
export class HubScene extends Phaser.Scene {
  // -------------------------------------------------------------
  // Geometría del rellano (en tiles de 16 px)
  // -------------------------------------------------------------
  private static readonly TILE = 16;
  private static readonly COLS = 30; // 480 / 16
  private static readonly ROWS = 17; // 270 / 16 ≈ 16.875 — usamos 17

  /** Y central del pasillo (en tiles), donde camina María por defecto. */
  private static readonly CORRIDOR_CENTER_Y = 9;

  /** Definición de puertas: x en TILES, centro de la puerta. */
  private static readonly DOORS: Array<{
    id: string;
    label: string;
    owner: 'maria' | 'future' | 'vecino';
    tileX: number;
    playable: boolean;
  }> = [
    { id: '2A', label: '2 A', owner: 'vecino', tileX: 4, playable: false },
    { id: '2B', label: '2 B', owner: 'maria', tileX: 11, playable: true },
    { id: '2C', label: '2 C', owner: 'future', tileX: 18, playable: false },
    { id: '2D', label: '2 D', owner: 'future', tileX: 25, playable: false },
  ];

  /** Distancia (en px) a la puerta para que se considere "en rango" de E. */
  /** S2.7: rango APRETADO — antes 22px daba sensación de 'desde muy lejos'. */
  private static readonly DOOR_INTERACT_RANGE_PX = 12;

  /** Velocidad de María (px/s). Igual que ApartmentScene. */
  private static readonly PLAYER_SPEED = 80;

  // -------------------------------------------------------------
  // Runtime
  // -------------------------------------------------------------
  private maria!: Phaser.GameObjects.GameObject & { x: number; y: number };
  private mariaIsSprite = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private eKey!: Phaser.Input.Keyboard.Key;
  private lastDir: Direction = 'down';

  /** Container del prompt "Pulsa E" anclado al viewport. */
  private doorPrompt?: Phaser.GameObjects.Container;
  private nearbyDoorId: string | null = null;

  /** Estado del keypad. */
  private keypadOpen = false;
  private keypadLayer?: Phaser.GameObjects.Container;
  private keypadInput = '';
  private keypadDisplay?: Phaser.GameObjects.Text;
  private keypadMsg?: Phaser.GameObjects.Text;
  private keypadKeydownHandler?: (ev: KeyboardEvent) => void;

  /** Hint inicial de la carta. */
  private letterHint?: Phaser.GameObjects.Container;

  /** Capa de paredes (para colisión por tiles físicos). */
  private wallBodies: Phaser.Physics.Arcade.StaticGroup | null = null;

  constructor() {
    super({ key: 'HubScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1418');

    // --- Setup texturas y animaciones de María (idempotente) ---
    setupMaria(this);
    ensureUiAtlas(this);

    // --- Construcción visual ---
    this.buildFloor();
    this.buildSouthWall();
    this.buildNorthWallWithDoors();
    this.buildAmbientLighting();
    this.buildWallColliders();

    // --- Player ---
    this.spawnMaria();

    // --- HUD + hint ---
    this.buildHud();
    if (!useProgressStore.getState().apartmentEverEntered) {
      this.showLetterHint();
    }

    // --- Inputs ---
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.eKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Atajo DEV: Q resetea progreso y reinicia.
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q).on('down', () => {
      useProgressStore.getState().resetProgress();
      this.scene.restart();
    });

    // S1 (Día 10): primer arranque → tutorial overlay. Reemplaza la
    // IntroScene LoL. Si introPlayed=false mostramos un panel modal con
    // las instrucciones básicas y marcamos `introPlayed=true` al cerrar.
    if (!useProgressStore.getState().introPlayed) {
      // Diferimos al siguiente tick para que el Hub esté pintado debajo
      // (hace de telón de fondo).
      this.time.delayedCall(50, () => this.showFirstTimeTutorial());
    }
  }

  /**
   * Tutorial overlay primer arranque. 4 páginas SPACE/ENTER avanza,
   * ESC salta. Al cerrar, marca `introPlayed=true` en el store.
   */
  private showFirstTimeTutorial(): void {
    const cam = this.cameras.main;
    const PW = 320;
    const PH = 180;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const DEPTH = 3000;
    const PAGES: { title: string; body: string }[] = [
      {
        title: 'EL PISO',
        body:
          'Has llegado al rellano de tu bloque.\n' +
          'Tu piso es ese, el del código.\n' +
          'La carta lo dice: 11·05·26.',
      },
      {
        title: 'CÓMO MOVERTE',
        body:
          'Flechas o WASD para caminar.\n' +
          'E para interactuar (puerta, gato, mueble).\n' +
          'SPACE / ENTER para avanzar diálogos.',
      },
      {
        title: 'EL JUEGO',
        body:
          'Es tu casa. Vive en ella.\n' +
          'Hay 3 gatos: Kero, Haku y Nala.\n' +
          'Y muchas cosas escondidas.',
      },
      {
        title: 'BUEN VIAJE',
        body: '...empieza por el keypad.\nfeliz cumpleaños, María.',
      },
    ];
    let idx = 0;

    const dim = this.add
      .rectangle(cx, cy, cam.width, cam.height, 0x000000, 0.78)
      .setScrollFactor(0)
      .setDepth(DEPTH);
    const border = this.add
      .rectangle(cx, cy, PW + 4, PH + 4, 0xfbbf24, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    const bg = this.add
      .rectangle(cx, cy, PW, PH, 0x1a0e08, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH + 2);

    const title = this.add
      .text(cx, cy - PH / 2 + 16, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '14px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 3);
    const body = this.add
      .text(cx, cy - 10, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#e5d3b3',
        align: 'center',
        wordWrap: { width: PW - 30, useAdvancedWrap: true },
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 3);
    const pageLabel = this.add
      .text(cx, cy + PH / 2 - 24, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#6b4425',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 3);
    const hint = this.add
      .text(cx, cy + PH / 2 - 10, 'SPACE / ENTER continuar  ·  ESC saltar', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '9px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 3);

    const renderPage = () => {
      const p = PAGES[idx];
      title.setText(p.title);
      body.setText(p.body);
      pageLabel.setText(idx + 1 + ' / ' + PAGES.length);
    };
    renderPage();

    const close = () => {
      window.removeEventListener('keydown', onKey);
      [dim, border, bg, title, body, pageLabel, hint].forEach((o) => o.destroy());
      useProgressStore.getState().markIntroPlayed();
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        e.preventDefault();
        idx += 1;
        if (idx >= PAGES.length) close();
        else renderPage();
      } else if (k === 'Escape' || k === 'Esc') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
  }

  // =============================================================
  // BUILD — visuals al estilo LimeZu Modern Interiors
  // =============================================================

  private buildFloor(): void {
    const T = HubScene.TILE;
    const W = HubScene.COLS * T;

    // Fondo base del suelo (tono parquet beige cálido).
    this.add.rectangle(0, 4 * T, W, (HubScene.ROWS - 4 - 2) * T, 0xb88a5e).setOrigin(0, 0);

    // Patrón parquet horizontal: bandas alternas más oscuras cada 2 tiles.
    for (let r = 4; r < HubScene.ROWS - 2; r++) {
      const isDarker = r % 2 === 0;
      this.add
        .rectangle(0, r * T, W, T, isDarker ? 0xa07952 : 0xb88a5e)
        .setOrigin(0, 0)
        .setAlpha(isDarker ? 1 : 1);
    }

    // Líneas de junta entre tablones cada 4 tiles para dar textura.
    for (let x = 0; x < W; x += 4 * T) {
      this.add
        .rectangle(x, 4 * T, 1, (HubScene.ROWS - 4 - 2) * T, 0x7a5a3a, 0.5)
        .setOrigin(0, 0);
    }

    // Sombra suave bajo la pared norte (transición pared-suelo).
    this.add
      .rectangle(0, 4 * T, W, 3, 0x000000, 0.35)
      .setOrigin(0, 0);
  }

  private buildSouthWall(): void {
    const T = HubScene.TILE;
    const W = HubScene.COLS * T;
    const y = (HubScene.ROWS - 2) * T;

    // Zócalo: rodapié oscuro.
    this.add.rectangle(0, y, W, T, 0x3a2520).setOrigin(0, 0);
    this.add.rectangle(0, y, W, 2, 0x1a0e0c).setOrigin(0, 0);

    // Sombra al pie del rodapié hacia el suelo.
    this.add.rectangle(0, y - 3, W, 3, 0x000000, 0.25).setOrigin(0, 0);

    // Pared sur: oscura (apenas se ve, da profundidad).
    this.add.rectangle(0, y + T, W, T, 0x1a0e0c).setOrigin(0, 0);
  }

  private buildNorthWallWithDoors(): void {
    const T = HubScene.TILE;
    const W = HubScene.COLS * T;

    // Convención de profundidades en HubScene:
    //   0..5   pared y suelo
    //   10..15 puertas y felpudos (encima del fondo)
    //   18     cartel "BLOQUE CUTRE" (siempre por encima de puertas)
    //   22     María
    //   90+    HUD
    //   200    keypad

    // Banda de pared (4 tiles de alto = 64 px). Color principal: marrón
    // anaranjado tipo escalera de bloque viejo.
    this.add.rectangle(0, 0, W, 4 * T, 0x6e4030).setOrigin(0, 0).setDepth(2);

    // Friso superior: línea más oscura (techo).
    this.add.rectangle(0, 0, W, 4, 0x2a1410).setOrigin(0, 0).setDepth(3);

    // Banda inferior de la pared (rodapié superior, justo antes del suelo).
    this.add.rectangle(0, 4 * T - 4, W, 4, 0x3a1f18).setOrigin(0, 0).setDepth(3);

    // Puertas (incrustadas en la pared norte). Las dibujamos a depth 10..15
    // para que queden encima del fondo de pared pero por DEBAJO del cartel
    // (depth 18) y del HUD (90+). El plate de número de la puerta vive a
    // depth 12, dejando espacio para que el cartel a depth 18 quede claro
    // por encima cuando se solapan visualmente cerca del centro.
    for (const d of HubScene.DOORS) {
      const cx = d.tileX * T + T / 2;
      // Hueco del marco (oscuro): 2 tiles ancho × 3 tiles alto, ocupando
      // las filas 1..3 de la pared.
      this.add.rectangle(cx, 1 * T, 2 * T, 3 * T, 0x140805).setOrigin(0.5, 0).setDepth(10);
      // Puerta en sí (panel): un tile dentro del marco.
      const panelColor = d.playable ? 0x8a4a2e : 0x4a2820;
      this.add
        .rectangle(cx, 1 * T + 2, 2 * T - 4, 3 * T - 4, panelColor)
        .setOrigin(0.5, 0)
        .setDepth(11);
      // Paneles decorativos (2 rectángulos típicos de puerta vieja).
      this.add
        .rectangle(cx, 1 * T + 6, 2 * T - 10, T - 4, 0x6e3a22)
        .setOrigin(0.5, 0)
        .setDepth(12);
      this.add
        .rectangle(cx, 1 * T + T + 4, 2 * T - 10, T - 4, 0x6e3a22)
        .setOrigin(0.5, 0)
        .setDepth(12);
      // Pomo dorado.
      this.add.circle(cx + T - 6, 1 * T + 2 * T + 2, 1.6, 0xe6c870).setDepth(13);
      // Mirilla.
      this.add.circle(cx, 1 * T + 6, 1, 0xe6c870).setDepth(13);
      // Plate de número arriba.
      this.add.rectangle(cx, 4, 22, 12, 0xe6c870).setOrigin(0.5, 0).setDepth(12);
      this.add
        .text(cx, 4 + 6, d.label, {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '8px',
          color: '#1a0f12',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5)
        .setDepth(13);
      // Felpudo en el suelo, justo delante de la puerta.
      const matY = 4 * T + 1;
      this.add
        .rectangle(cx, matY, 2 * T + 4, 6, d.playable ? 0x7a4830 : 0x3a2820)
        .setOrigin(0.5, 0)
        .setDepth(11);
      // Etiqueta del propietario (pequeña pista, sólo en la jugable).
      if (d.playable) {
        this.add
          .text(cx, matY + 8, 'María', {
            fontFamily: "'Silkscreen', monospace",
            fontSize: '7px',
            color: '#f5dcae',
            stroke: '#0a0606',
            strokeThickness: 1,
          })
          .setOrigin(0.5, 0)
          .setAlpha(0.85)
          .setDepth(12);
      } else {
        this.add
          .text(cx, matY + 8, '?', {
            fontFamily: "'Silkscreen', monospace",
            fontSize: '7px',
            color: '#9a7878',
          })
          .setOrigin(0.5, 0)
          .setAlpha(0.6)
          .setDepth(12);
      }
    }

    // Cartel del bloque al final, con depth alto, para que quede SIEMPRE
    // visible encima de cualquier puerta o adorno superior. Antes vivía al
    // principio del método y las puertas dibujadas después lo tapaban.
    this.add
      .text(W / 2, 8, 'BLOQUE CUTRE  ·  PLANTA 2ª', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#f5dcae',
        stroke: '#0a0606',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0)
      .setDepth(18);
  }

  private buildAmbientLighting(): void {
    const T = HubScene.TILE;

    // Lámpara fluorescente sobre la 2B (parpadeo sutil).
    const playable = HubScene.DOORS.find((d) => d.playable);
    if (!playable) return;
    const cx = playable.tileX * T + T / 2;
    const halo = this.add.ellipse(cx, 4 * T + 2, 80, 24, 0xfff4c2, 0.12).setOrigin(0.5, 0);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.06, to: 0.16 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Colliders estáticos para que María no atraviese paredes ni se meta
   * en los huecos de las puertas no jugables (solo la 2B permite "entrar"
   * vía interacción E + keypad).
   */
  private buildWallColliders(): void {
    const T = HubScene.TILE;
    const W = HubScene.COLS * T;
    this.wallBodies = this.physics.add.staticGroup();

    // Pared norte (zonas opacas: todo excepto los pies de las puertas).
    // Cubrimos el rectángulo entero (0..4*T) — no queremos que María
    // se "meta" en la puerta; sólo se acerca y pulsa E.
    const north = this.add.rectangle(0, 0, W, 4 * T, 0x000000, 0).setOrigin(0, 0);
    this.physics.add.existing(north, true);
    this.wallBodies.add(north);

    // Pared sur.
    const southTop = (HubScene.ROWS - 2) * T;
    const south = this.add
      .rectangle(0, southTop, W, 2 * T, 0x000000, 0)
      .setOrigin(0, 0);
    this.physics.add.existing(south, true);
    this.wallBodies.add(south);

    // Bordes laterales (este/oeste) — el rellano no se extiende infinito.
    const left = this.add.rectangle(-T, 0, T, HubScene.ROWS * T, 0x000000, 0).setOrigin(0, 0);
    this.physics.add.existing(left, true);
    this.wallBodies.add(left);
    const right = this.add.rectangle(W, 0, T, HubScene.ROWS * T, 0x000000, 0).setOrigin(0, 0);
    this.physics.add.existing(right, true);
    this.wallBodies.add(right);
  }

  // =============================================================
  // PLAYER
  // =============================================================

  private spawnMaria(): void {
    const T = HubScene.TILE;
    // Spawn delante de la 2B, mirando hacia abajo (hacia el suelo del pasillo).
    const door2B = HubScene.DOORS.find((d) => d.playable)!;
    const sx = door2B.tileX * T + T / 2;
    const sy = HubScene.CORRIDOR_CENTER_Y * T + T / 2;

    const useSprite = this.textures.exists('maria');
    this.mariaIsSprite = useSprite;

    if (useSprite) {
      const sprite = this.add.sprite(sx, sy, 'maria', 0);
      sprite.setDepth(22);
      this.physics.add.existing(sprite);
      const body = (sprite.body as Phaser.Physics.Arcade.Body);
      // Misma hitbox que ApartmentScene (10×5 en pies del personaje).
      body.setSize(10, 5);
      body.setOffset(3, 26);
      body.setCollideWorldBounds(true);
      // Empieza en idle-down.
      sprite.play('maria-idle-down', true);
      this.maria = sprite;
    } else {
      const rect = this.add.rectangle(sx, sy, 10, 28, 0xff5c8a).setStrokeStyle(1, 0xffffff, 0.9);
      rect.setDepth(22);
      this.physics.add.existing(rect);
      const body = (rect as unknown as { body: Phaser.Physics.Arcade.Body }).body;
      body.setSize(10, 5);
      body.setOffset(0, 22);
      body.setCollideWorldBounds(true);
      this.maria = rect;
    }

    // Colisión contra paredes.
    if (this.wallBodies) {
      this.physics.add.collider(this.maria, this.wallBodies);
    }
  }

  // =============================================================
  // HUD / Letter hint
  // =============================================================

  private buildHud(): void {
    this.add
      .text(6, this.scale.height - 8, 'WASD/Flechas mover · E interactuar', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#f0d9b0',
        stroke: '#0a0606',
        strokeThickness: 2,
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(100);
  }

  private showLetterHint(): void {
    const cam = this.cameras.main;
    const container = this.add.container(cam.width / 2, 78).setScrollFactor(0).setDepth(95);
    const bg = this.add.rectangle(0, 0, 280, 60, 0x0f0b10, 0.92).setStrokeStyle(1, 0xe6c870);
    const title = this.add
      .text(0, -18, '✉  De la carta que te dejó A.', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '9px',
        color: '#f5dcae',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    const line1 = this.add
      .text(0, -2, '"Tu puerta es la 2B. El código es nuestro día."', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#dcd0c0',
      })
      .setOrigin(0.5, 0.5);
    const line2 = this.add
      .text(0, 14, 'Seis dígitos · DD·MM·AA · Felicidades, María. ♥', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#dcd0c0',
      })
      .setOrigin(0.5, 0.5);
    container.add([bg, title, line1, line2]);
    this.letterHint = container;

    this.time.delayedCall(11000, () => this.hideLetterHint());
  }

  private hideLetterHint(): void {
    if (!this.letterHint) return;
    const target = this.letterHint;
    this.tweens.add({
      targets: target,
      alpha: 0,
      duration: 400,
      onComplete: () => target.destroy(),
    });
    this.letterHint = undefined;
  }

  // =============================================================
  // UPDATE
  // =============================================================

  update(): void {
    if (this.keypadOpen) {
      this.freezeMaria();
      return;
    }
    this.handleMovement();
    this.handleDoorProximity();
  }

  private freezeMaria(): void {
    if (!('body' in this.maria) || !this.maria.body) return;
    const body = (this.maria as unknown as { body: Phaser.Physics.Arcade.Body }).body;
    body.setVelocity(0, 0);
    if (this.mariaIsSprite) {
      const sprite = this.maria as Phaser.GameObjects.Sprite;
      const idleKey = `maria-idle-${this.lastDir}`;
      if (sprite.anims.currentAnim?.key !== idleKey || !sprite.anims.isPlaying) {
        sprite.play(idleKey, true);
      }
    }
  }

  private handleMovement(): void {
    const body = (this.maria as unknown as { body: Phaser.Physics.Arcade.Body }).body;
    const speed = HubScene.PLAYER_SPEED;
    let vx = 0;
    let vy = 0;

    const left = this.cursors.left?.isDown || this.wasd.A.isDown;
    const right = this.cursors.right?.isDown || this.wasd.D.isDown;
    const up = this.cursors.up?.isDown || this.wasd.W.isDown;
    const down = this.cursors.down?.isDown || this.wasd.S.isDown;

    if (left) vx = -speed;
    else if (right) vx = speed;
    if (up) vy = -speed;
    else if (down) vy = speed;

    // Normaliza diagonal para no moverse más rápido en diagonal.
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    body.setVelocity(vx, vy);

    // Determinar dirección dominante para anim.
    let dir: Direction | null = null;
    if (Math.abs(vx) > Math.abs(vy)) {
      if (vx > 0) dir = 'right';
      else if (vx < 0) dir = 'left';
    } else {
      if (vy > 0) dir = 'down';
      else if (vy < 0) dir = 'up';
    }

    if (this.mariaIsSprite) {
      const sprite = this.maria as Phaser.GameObjects.Sprite;
      if (dir) {
        this.lastDir = dir;
        const key = `maria-walk-${dir}`;
        if (sprite.anims.currentAnim?.key !== key) sprite.play(key, true);
      } else {
        const key = `maria-idle-${this.lastDir}`;
        if (sprite.anims.currentAnim?.key !== key) sprite.play(key, true);
      }
    }
  }

  private handleDoorProximity(): void {
    const T = HubScene.TILE;
    const px = this.maria.x;
    const py = this.maria.y;

    let foundDoor: typeof HubScene.DOORS[number] | null = null;
    for (const d of HubScene.DOORS) {
      const dx = px - (d.tileX * T + T / 2);
      // La puerta está en la pared norte (y < 4*T). Consideramos rango si
      // María está cerca en X y dentro de un cono vertical superior.
      const inCone = py < HubScene.CORRIDOR_CENTER_Y * T + 4;
      if (Math.abs(dx) < HubScene.DOOR_INTERACT_RANGE_PX && inCone) {
        foundDoor = d;
        break;
      }
    }

    const newId = foundDoor?.id ?? null;
    if (newId !== this.nearbyDoorId) {
      this.nearbyDoorId = newId;
      this.renderDoorPrompt(foundDoor);
    }

    if (foundDoor && Phaser.Input.Keyboard.JustDown(this.eKey)) {
      if (foundDoor.playable) {
        this.hideLetterHint();
        // Bypass del keypad si ya entró alguna vez (token de sesión
        // implícito vía PROGRESS store). El GDD original ya contemplaba
        // esto: "first-time auth puzzle, subsequent visits use session
        // token". Aquí el "token" es el flag persistido apartmentEverEntered.
        const everEntered = useProgressStore.getState().apartmentEverEntered;
        if (everEntered) {
          this.enterApartmentDirectly();
        } else {
          this.openKeypad();
        }
      } else {
        this.showFloatingMessage('Esta puerta no es la tuya.');
      }
    }
  }

  /**
   * Entrada directa al piso sin keypad (re-entry tras salir por la puerta
   * principal). Misma transición de fade que `enterApartment`, pero sin el
   * markApartmentEntered (ya está marcado).
   */
  private enterApartmentDirectly(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('ApartmentScene');
    });
  }

  private renderDoorPrompt(door: typeof HubScene.DOORS[number] | null): void {
    this.doorPrompt?.destroy();
    this.doorPrompt = undefined;
    if (!door) return;

    const cam = this.cameras.main;
    const container = this.add.container(cam.width / 2, cam.height - 26).setScrollFactor(0).setDepth(90);

    // Si tenemos panel pequeño de Modern UI, lo usamos.
    if (hasUiFrame(this, UI_FRAMES.panelSmall)) {
      const panel = this.add.image(0, 0, 'ui', UI_FRAMES.panelSmall).setOrigin(0.5, 0.5);
      panel.setDisplaySize(220, 28);
      container.add(panel);
    } else {
      const bg = this.add.rectangle(0, 0, 220, 26, 0x2a1810, 0.95).setStrokeStyle(1, 0xe6c870);
      container.add(bg);
    }

    const txt = this.add
      .text(
        0,
        0,
        door.playable
          ? `Puerta ${door.label} · Pulsa  E  para entrar`
          : `Puerta ${door.label} · (cerrada)`,
        {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '8px',
          color: door.playable ? '#f5dcae' : '#9a7878',
          stroke: '#0a0606',
          strokeThickness: 2,
        },
      )
      .setOrigin(0.5, 0.5);
    container.add(txt);
    this.doorPrompt = container;
  }

  private showFloatingMessage(text: string, ms = 1600): void {
    const cam = this.cameras.main;
    const t = this.add
      .text(cam.width / 2, 100, text, {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '9px',
        color: '#f2b5a0',
        stroke: '#120a0d',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(95);
    this.tweens.add({
      targets: t,
      alpha: 0,
      y: 88,
      delay: ms - 400,
      duration: 400,
      onComplete: () => t.destroy(),
    });
  }

  // =============================================================
  // KEYPAD (popup, Modern UI panel + estilo cutre consciente)
  // =============================================================

  private openKeypad(): void {
    if (this.keypadOpen) return;
    this.keypadOpen = true;
    this.keypadInput = '';

    const cam = this.cameras.main;
    const layer = this.add.container(cam.width / 2, cam.height / 2).setScrollFactor(0).setDepth(200);

    // Overlay oscurecido.
    const overlay = this.add.rectangle(0, 0, cam.width, cam.height, 0x000000, 0.6).setOrigin(0.5, 0.5);

    // Panel keypad: si tenemos panelSmall ModernUI lo estiramos; sino fallback.
    let panel: Phaser.GameObjects.GameObject;
    if (hasUiFrame(this, UI_FRAMES.panelSmall)) {
      const img = this.add.image(0, 0, 'ui', UI_FRAMES.panelSmall).setOrigin(0.5, 0.5);
      img.setDisplaySize(180, 170);
      panel = img;
    } else {
      panel = this.add.rectangle(0, 0, 180, 170, 0x2a1810).setStrokeStyle(2, 0xe6c870);
    }

    const title = this.add
      .text(0, -68, 'CÓDIGO DE ACCESO', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#f5dcae',
        stroke: '#0a0606',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5);

    // Display del input (6 guiones intercalados con espacios).
    this.keypadDisplay = this.add
      .text(0, -48, '_  _  _  _  _  _', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '14px',
        color: '#ffffff',
        stroke: '#0a0606',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5);

    layer.add([overlay, panel, title, this.keypadDisplay]);

    // Grid 3×4 de botones: 1-9, ←, 0, OK
    const buttons: Array<{ label: string; value: string }> = [
      { label: '1', value: '1' },
      { label: '2', value: '2' },
      { label: '3', value: '3' },
      { label: '4', value: '4' },
      { label: '5', value: '5' },
      { label: '6', value: '6' },
      { label: '7', value: '7' },
      { label: '8', value: '8' },
      { label: '9', value: '9' },
      { label: '←', value: 'BACK' },
      { label: '0', value: '0' },
      { label: 'OK', value: 'OK' },
    ];

    const btnW = 32;
    const btnH = 20;
    const gapX = 6;
    const gapY = 4;
    const startX = -(btnW + gapX);
    const startY = -22;

    buttons.forEach((b, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = startX + col * (btnW + gapX);
      const y = startY + row * (btnH + gapY);
      const isOk = b.value === 'OK';
      const isBack = b.value === 'BACK';
      const fill = isOk ? 0x3a5a3a : isBack ? 0x5a3a3a : 0x40251a;
      const stroke = isOk ? 0x6adc7f : isBack ? 0xf2b5a0 : 0xe6c870;
      const rect = this.add
        .rectangle(x, y, btnW, btnH, fill)
        .setStrokeStyle(1, stroke)
        .setInteractive({ useHandCursor: true });
      const txt = this.add
        .text(x, y, b.label, {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '10px',
          color: '#f5dcae',
        })
        .setOrigin(0.5, 0.5);
      rect.on('pointerdown', () => this.onKeypadInput(b.value));
      rect.on('pointerover', () => rect.setFillStyle(isOk ? 0x4a7a4a : isBack ? 0x7a4a4a : 0x55321f));
      rect.on('pointerout', () => rect.setFillStyle(fill));
      layer.add([rect, txt]);
    });

    this.keypadMsg = this.add
      .text(0, 56, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#f2b5a0',
      })
      .setOrigin(0.5, 0.5);
    layer.add(this.keypadMsg);

    const closeHint = this.add
      .text(0, 70, 'ESC para cerrar', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#8a7072',
      })
      .setOrigin(0.5, 0.5);
    layer.add(closeHint);

    this.keypadLayer = layer;

    // Teclado físico.
    const keyHandler = (ev: KeyboardEvent) => {
      if (!this.keypadOpen) return;
      if (ev.key >= '0' && ev.key <= '9') this.onKeypadInput(ev.key);
      else if (ev.key === 'Backspace') this.onKeypadInput('BACK');
      else if (ev.key === 'Enter') this.onKeypadInput('OK');
      else if (ev.key === 'Escape') this.closeKeypad();
    };
    this.input.keyboard!.on('keydown', keyHandler);
    this.keypadKeydownHandler = keyHandler;
  }

  private onKeypadInput(value: string): void {
    if (value === 'BACK') {
      this.keypadInput = this.keypadInput.slice(0, -1);
    } else if (value === 'OK') {
      this.validateKeypad();
      return;
    } else if (/^[0-9]$/.test(value)) {
      if (this.keypadInput.length < 6) this.keypadInput += value;
    }
    this.refreshKeypadDisplay();
  }

  private refreshKeypadDisplay(): void {
    if (!this.keypadDisplay) return;
    const digits: string[] = [];
    for (let i = 0; i < 6; i++) {
      digits.push(i < this.keypadInput.length ? this.keypadInput[i] : '_');
    }
    this.keypadDisplay.setText(digits.join('  '));
    if (this.keypadMsg && this.keypadMsg.text.length > 0 && this.keypadInput.length < 6) {
      this.keypadMsg.setText('');
    }
  }

  private validateKeypad(): void {
    if (this.keypadInput.length < 6) {
      this.keypadMsg?.setColor('#f2b5a0');
      this.keypadMsg?.setText('Faltan dígitos…');
      return;
    }
    if (this.keypadInput === APARTMENT_CODE) {
      this.keypadMsg?.setColor('#9adc7f');
      this.keypadMsg?.setText('✓ Código correcto');
      this.time.delayedCall(700, () => this.enterApartment());
    } else {
      this.keypadMsg?.setColor('#f2b5a0');
      this.keypadMsg?.setText('✗ Código incorrecto');
      this.cameras.main.shake(180, 0.003);
      this.keypadInput = '';
      this.time.delayedCall(700, () => this.refreshKeypadDisplay());
    }
  }

  private closeKeypad(): void {
    if (!this.keypadOpen) return;
    if (this.keypadKeydownHandler) {
      this.input.keyboard?.off('keydown', this.keypadKeydownHandler);
      this.keypadKeydownHandler = undefined;
    }
    this.keypadLayer?.destroy();
    this.keypadLayer = undefined;
    this.keypadDisplay = undefined;
    this.keypadMsg = undefined;
    this.keypadInput = '';
    this.keypadOpen = false;
  }

  private enterApartment(): void {
    useProgressStore.getState().markApartmentEntered();
    if (this.keypadKeydownHandler) {
      this.input.keyboard?.off('keydown', this.keypadKeydownHandler);
      this.keypadKeydownHandler = undefined;
    }
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ApartmentScene');
    });
  }
}
