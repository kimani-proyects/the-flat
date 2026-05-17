import * as Phaser from 'phaser';
import {
  FLOORPLAN,
  TILE_SIZE,
  MAP_WIDTH_PX,
  MAP_HEIGHT_PX,
  isWallTile,
  roomAt,
} from '../data/floorplan';
import { ensureUiAtlas } from '../systems/UiAtlas';
import { InteractionSystem } from '../systems/InteractionSystem';
import { DialogSystem } from '../systems/DialogSystem';
import { INTERACTION_HANDLERS } from '../interactions/handlers';
import { LockedWallSystem } from '../systems/LockedWallSystem';
import { LOCKED_WALLS } from '../minigames';
import { useProgressStore } from '@/lib/stores/gameStore';
import { Portraits } from '../systems/Portraits';
import { CatSystem } from '../systems/CatSystem';
import { CatAnimations } from '../systems/CatAnimations';
import { FurnitureRenderer } from '../systems/FurnitureRenderer';
import { StaticFurnitureRenderer } from '../systems/StaticFurnitureRenderer';
import { installMiniPlayer, destroyMiniPlayer } from '../systems/MiniPlayer';
import { isFridayThe13th } from '../systems/CatPersonalities';
import { installHakuMemorial } from '../systems/HakuMemorial';
import { paintLimeZu, installGifOverlay } from '../systems/LimeZuRenderer';

type Direction = 'down' | 'up' | 'left' | 'right';

/**
 * ApartmentScene — Día 4 (iteración 3, cerrando scope).
 *
 * Cambios clave vs iteración 2:
 *   - COLISIÓN DESACOPLADA: los colliders se generan SIEMPRE desde
 *     floorplan.isWallTile(), independientemente de que el tilemap
 *     renderice o no la capa Walls. Antes dependíamos de
 *     setCollisionByExclusion sobre la capa del tilemap y se escapaba
 *     por los agujeros del skin. Ahora el físico es fuente única:
 *     data/floorplan.ts. El tilemap sólo dibuja. Si la capa Walls del
 *     .tmj no se carga, igual chocas contra las paredes correctas.
 *   - Merge de tiles contiguos en tiras horizontales + verticales
 *     residuales para reducir el número de bodies (48x32 = ~1.5K tiles,
 *     bajamos a unos 80-120 rects).
 *   - Fuera el picker M/N (inusable con 1000+ frames). Para ver frames
 *     ahora hay una página hermana /inspector con selector de celdas.
 *   - Tecla I abre /inspector en otra pestaña.
 *   - Tecla G (debug) pinta los colliders reales en pantalla para QA.
 *   - Puertas y marcadores: sin cambios de scope (Día 4).
 */
export class ApartmentScene extends Phaser.Scene {
  private maria!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  private mariaIsSprite = false;
  private mariaBody!: Phaser.Physics.Arcade.Body;

  // Fuente única de colisión: invisibles rect bodies desde floorplan.
  private wallStaticGroup!: Phaser.Physics.Arcade.StaticGroup;
  private wallDebugGraphics?: Phaser.GameObjects.Graphics;
  private wallDebugVisible = false;

  // Capa del tilemap (solo visual; la colisión no depende de ella).
  private collisionsLayer?: Phaser.Tilemaps.TilemapLayer;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    P: Phaser.Input.Keyboard.Key;
    G: Phaser.Input.Keyboard.Key;
    I: Phaser.Input.Keyboard.Key;
    C: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
    BRACKET_LEFT: Phaser.Input.Keyboard.Key;
    BRACKET_RIGHT: Phaser.Input.Keyboard.Key;
  };

  // Sistema de interacción (Día 5). Detecta proximity y dispara handlers.
  private hakuMemorial?: { destroy: () => void };
  private limeZuHandle?: { destroy: () => void };
  private pcAlexGif?: { destroy: () => void };
  private pcMariaGif?: { destroy: () => void };
  private interactionSystem!: InteractionSystem;
  // Sistema de diálogos (Día 6). Panel anclado + typewriter.
  private dialogSystem!: DialogSystem;
  // S1.1: muebles animados (TV, nevera, espejo encantado).
  private furnitureRenderer: FurnitureRenderer | null = null;
  // S2.4: muebles estáticos procedurales (sofás, camas, mesas, plantas).
  private staticFurnitureRenderer: StaticFurnitureRenderer | null = null;
  // Sistema de muros bloqueantes + minijuegos (Día 7.5). Construye los
  // muros físicos de las habitaciones aún no desbloqueadas y registra el
  // handler 'wall-locked' que dispara el minijuego correspondiente.
  private lockedWallSystem!: LockedWallSystem;
  // Sistema de gatos AI (Día 8). Spawnea los 3 gatos cuando los 5 muros
  // están KO y maneja wander + interact. Cinemática única la primera vez.
  private catSystem!: CatSystem;
  // True mientras la cinemática de gatos está activa — congela al player.
  private catCinematicLock = false;
  // True si hay pending: dispara cinemática de gatos cuando dialog cierre.
  // Lo seteamos en wall:unlocked y lo procesamos en update() cuando ya no
  // hay diálogo abierto, para que el cuadro "Baño desbloqueada" no se
  // solape con el fade-out de la cinemática.
  private pendingCatSpawn = false;

  // Flag dev: si está activo, se muestran HUD de frames + [ ] cycler +
  // marcadores rosas sobre interactuables. Desactivado por defecto para
  // que el juego se vea limpio; poner a true durante desarrollo visual.
  // Tipado como `boolean` (no literal) para que ambas ramas compilen.
  private readonly DEV_HUD: boolean = false;
  private roomLabel!: Phaser.GameObjects.Text;
  private frameLabel!: Phaser.GameObjects.Text;
  private currentRoomId: string | null = null;
  private usingTilemap = false;

  // Ciclador manual de frames (dev). Modo "picker in-game": con [ y ]
  // se recorren los frames numéricos registrados en la textura maria.
  // No hay animación automática: lo que veas es el frame concreto que
  // luego irá al Inspector. Arranca en 0 (primera celda post-header).
  private currentFrameIdx = 0;
  private maxFrameIdx = 0;

  private readonly MOVE_SPEED = 110;

  /**
   * Layout ASUMIDO del sheet maria.png (896×640, 56 cols × 39 filas post-header).
   *
   * Fila 0 = idle, fila 1 = walk. Cada fila tiene 4 direcciones de 6 frames
   * cada una, colocadas consecutivas a partir de la columna 0.
   *
   * Orden de direcciones por defecto: down, right, up, left (convención
   * LimeZu estándar). Si al probar alguna dirección sale cruzada (p.ej.
   * pulsando arriba el personaje anda hacia la izquierda), intercambiar
   * los offsets aquí — 1 línea de código, sin tocar el resto.
   */
  private static readonly CHAR_COLS = 56;
  private static readonly CHAR_FPD = 6; // frames por dirección
  // Orden real confirmado tras smoke test: dentro de cada fila de animación,
  // los 24 frames (4 dirs × 6) van en orden RIGHT → UP → LEFT → DOWN.
  // Con el orden nominal LimeZu "down/right/up/left" se veía todo rotado
  // 90° CCW (pulsar D → animación UP, etc.). Este mapping corrige eso.
  private static readonly CHAR_DIR_OFFSET: Record<Direction, number> = {
    right: 0,
    up: 6,
    left: 12,
    down: 18,
  };

  private lastDir: Direction = 'down';

  constructor() {
    super({ key: 'ApartmentScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0c10');

    this.logAssetStatus();

    // 1) Dibujo: tilemap si está; si falla, procedural.
    const ok = this.tryRenderTilemap();
    this.usingTilemap = ok;
    if (!ok) {
      this.drawFloorsProcedural();
      this.drawWallsProcedural();
    }

    // 2) Colisión desacoplada del render. SIEMPRE desde floorplan.
    this.buildWallColliders();

    // 3) Marcadores (puertas + interactuables) — solo visual.
    // Puertas: se mantienen (son referencia útil para orientarse).
    // Interactuables (system anchors): pulso dorado sutil para ubicarlos
    // mientras apartment.tmj no tenga los tiles reales de LimeZu pintados
    // en Furniture_* layers. Cuando pintemos los muebles, este marcador
    // se elimina (o se gatea con DEV_HUD). La etiqueta de type aún se
    // muestra solo si DEV_HUD=true (ver drawInteractableMarkers).
    this.drawDoorMarkers();
    this.drawInteractableMarkers();

    // S1.1: pinta muebles animados (TV, nevera, espejo encantado)
    // encima del tilemap. Hitboxes vendrán al spawn de María.
    this.furnitureRenderer = new FurnitureRenderer(this);

    // 4) Registra frames correctos de los sheets de LimeZu (skip header row)
    //    y luego spawnea a María.
    //
    // IMPORTANTE: los personajes LimeZu son 16×16 (chibi, head+tiny body
    // dentro de una celda única). NO son 16×32. Si usamos 32 de alto, cada
    // frame engulle 2 filas y vemos idle + walk stacked (el famoso "cráneo
    // debajo del personaje").
    // Cuentas: maria.png 896×640. 19 animaciones visibles en la guía.
    //   640 - 19 × 32 = 32 → el header son 32 px (NO 16 como creía).
    //   Las celdas son 16×32 (cabeza arriba + cuerpo abajo dentro de la
    //   misma celda). Por eso antes con cellH=16 siempre faltaba la cabeza.
    // Layout correcto:
    //   cols = 896/16 = 56
    //   rows = (640-32)/32 = 19  (coincide con las 19 animaciones)
    this.registerCharacterFrames('maria', 16, 32, 32);

    // Atlas UI (paneles, teclas, iconos) — idempotente, HMR-safe.
    ensureUiAtlas(this);

    // Animaciones cableadas con el mapping oficial LimeZu confirmado tras
    // leer Spritesheet_animations_GUIDE.png:
    //   Fila 0 = idle, Fila 1 = walk
    //   Por fila, 4 dirs × 6 frames: down(0-5) right(6-11) up(12-17) left(18-23)
    // Si al probar una dirección sale cruzada, retocar CHAR_DIR_OFFSET.
    this.createMariaAnimations();

    this.spawnMaria();

    // S1.1: tras spawnMaria, init FurnitureRenderer con player para colliders.
    if (this.furnitureRenderer && this.maria) {
      this.furnitureRenderer.init(
        this.maria as Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle,
      );
    }

    // S2.4: muebles estáticos procedurales (sofás, mesas, camas, etc.)
    // Se pintan en depth 7-12 — por debajo del player y de los animados.
    this.staticFurnitureRenderer = new StaticFurnitureRenderer(this);
    if (this.maria) {
      this.staticFurnitureRenderer.init(
        this.maria as Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle,
      );
    }

    // S2.6: Mini player de música — esquina top-left, screen-fixed.
    // Se oculta solo cuando no hay nada sonando.
    installMiniPlayer(this);
    // S2.7: memorial Haku (fantasma de bienvenida + ronroneos + spot favorito).
    this.hakuMemorial = installHakuMemorial(this);
    // S2.9: pinta sprites individuales LimeZu (camas, lámparas, plantas, etc.)
    this.limeZuHandle = paintLimeZu(this);
    // S2.9: GIFs animados — control room screens sobre el PC de Alex
    // y facebook scrolling sobre el PC de María.
    // S2.10: PCs ahora son sprites Jail individuales (LimeZu), no GIFs.
    // (Los GIFs salían encima de los diálogos por estar en HTML overlay.)

    // Día 6: DialogSystem se monta antes del InteractionSystem para poder
    // inyectar showDialog como dependencia. El panel usa el atlas UI y
    // vive fijo abajo del viewport con typewriter.
    // Día 8.5: registra portraits ANTES del DialogSystem (idempotente).
    Portraits.register(this);
    // Día 8b: registra animaciones de gatos (Kero idle/walk/sprint).
    // Idempotente, fast-fail si los spritesheets no están cargados.
    CatAnimations.register(this);
    this.dialogSystem = new DialogSystem(this);

    // Día 5: sistema de interacción. Se monta DESPUÉS de spawnMaria para
    // tener la sprite lista. registerAll carga todos los handlers definidos
    // en src/game/interactions/handlers.ts (Día 6: ya usan dialogSystem).
    // Para añadir un interactable nuevo: 1 entrada en handlers.LINES + 1
    // en floorplan.interactables y listo.
    this.interactionSystem = new InteractionSystem(
      this,
      this.maria as Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle,
      (pages, opts) => this.dialogSystem.show(pages, opts),
    );
    this.interactionSystem.registerAll(INTERACTION_HANDLERS);

    // Día 7.5: muros bloqueantes. DESPUÉS de InteractionSystem porque
    // LockedWallSystem registra el handler 'wall-locked' y añade
    // interactables virtuales con addExtra(). Lee unlockedRooms del
    // gameStore para saber qué muros NO montar (ya desbloqueados).
    this.lockedWallSystem = new LockedWallSystem(
      this,
      this.interactionSystem,
      this.maria as Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle,
      LOCKED_WALLS,
    );
    this.lockedWallSystem.build();

    // Día 8b — easter egg viernes 13. Si la fecha del cliente es viernes
    // y día 13, aplicamos un tinte oscuro a la cámara y un overlay
    // rojizo sutil. Visualmente: día tenebroso. La detección se hace una
    // vez en create() — si el día cambia mid-session, hay que salir y
    // volver a entrar (aceptable para un easter egg).
    if (isFridayThe13th()) {
      // Tinte oscuro frío en la cámara principal.
      this.cameras.main.setBackgroundColor('#020005');
      // Overlay sangre tenue sobre toda la escena, fixed al viewport.
      this.add
        .rectangle(
          this.cameras.main.width / 2,
          this.cameras.main.height / 2,
          this.cameras.main.width,
          this.cameras.main.height,
          0x4b0b0b,
          0.18,
        )
        .setScrollFactor(0)
        .setDepth(950); // por debajo del HUD/dialog (1000+) pero encima del mundo
      // Vignette sutil (rectángulo negro radial fake con alpha extra
      // en los bordes — Phaser sin filtros, lo dejamos como un
      // gradient hack: 4 rectángulos finos en cada borde).
      const camW = this.cameras.main.width;
      const camH = this.cameras.main.height;
      const vEdgeAlpha = 0.4;
      this.add.rectangle(camW / 2, 8, camW, 16, 0x000000, vEdgeAlpha).setScrollFactor(0).setDepth(951);
      this.add.rectangle(camW / 2, camH - 8, camW, 16, 0x000000, vEdgeAlpha).setScrollFactor(0).setDepth(951);
      this.add.rectangle(8, camH / 2, 16, camH, 0x000000, vEdgeAlpha).setScrollFactor(0).setDepth(951);
      this.add.rectangle(camW - 8, camH / 2, 16, camH, 0x000000, vEdgeAlpha).setScrollFactor(0).setDepth(951);
      // eslint-disable-next-line no-console
      console.log('[easter-egg] Viernes 13 detectado — modo tenebre activado.');
    }

    // Día 8: gatos. Se monta el sistema, y SPAWN sólo si los 5 muros
    // están KO. Si ya se vio la cinemática (catsSpawned=true), spawn
    // directo silencioso. Si no, dispara la cinemática + marca el flag.
    this.catSystem = new CatSystem(
      this,
      this.interactionSystem,
      this.maria as Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle,
    );
    this.catSystem.onCinematicStart = () => {
      this.catCinematicLock = true;
    };
    this.catSystem.onCinematicEnd = () => {
      this.catCinematicLock = false;
    };
    // Listener para el evento "lines" de la cinemática — la escena tiene
    // el DialogSystem y CatSystem no lo conoce, así que va vía evento.
    this.events.on('cats:cinematic-line', (payload: { lines: string[] }) => {
      void this.dialogSystem.show(payload.lines, {
        speaker: 'María',
        portrait: 'maria',
      });
    });
    // Día 8: cuando un muro se desbloquea, marcamos pending si fue el
    // 5º. La cinemática se dispara en update() cuando el diálogo "muro
    // desbloqueado" se cierre, para que no se solapen visualmente.
    this.events.on('wall:unlocked', () => {
      const p = useProgressStore.getState();
      if (CatSystem.allRoomsUnlocked(p.unlockedRooms) && !this.catSystem.hasSpawned()) {
        this.pendingCatSpawn = true;
      }
    });
    const progress = useProgressStore.getState();
    if (CatSystem.allRoomsUnlocked(progress.unlockedRooms)) {
      this.catSystem.spawnIfReady(progress.catsSpawned, () => {
        if (!progress.catsSpawned) {
          useProgressStore.getState().markCatsSpawned();
        }
      });
    }

    this.setupInput();
    this.setupCamera();
    this.setupHud();

    // Tip en consola.
    // eslint-disable-next-line no-console
    console.log(
      '%c[The Flat] tecla I para inspector — REMOVIDO en S2.13.',
      'color:#5eead4',
    );
  }

  // ---------- debug log ----------

  private logAssetStatus(): void {
    const report: Record<string, string> = {};
    const keys = [
      'Room_Builder_16x16',
      'Room_Builder_Floors_16x16',
      'Room_Builder_Walls_16x16',
      'Interiors_16x16',
      'maria',
      'alex',
    ];
    for (const k of keys) {
      if (this.textures.exists(k)) {
        const src = this.textures.get(k).getSourceImage() as HTMLImageElement;
        report[k] = `${src.width}x${src.height}`;
      } else {
        report[k] = 'MISSING';
      }
    }
    report['apartment-map'] = this.cache.tilemap.exists('apartment-map') ? 'OK' : 'MISSING';
    // eslint-disable-next-line no-console
    console.table(report);
  }

  // ---------- ruta tilemap (solo visual) ----------

  private tryRenderTilemap(): boolean {
    if (!this.cache.tilemap.exists('apartment-map')) return false;

    try {
      const map = this.make.tilemap({ key: 'apartment-map' });

      const rbMaster = map.addTilesetImage('Room_Builder_16x16', 'Room_Builder_16x16');
      const rbFloors = map.addTilesetImage('Room_Builder_Floors_16x16', 'Room_Builder_Floors_16x16');
      const rbWalls = map.addTilesetImage('Room_Builder_Walls_16x16', 'Room_Builder_Walls_16x16');
      const interiors = map.addTilesetImage('Interiors_16x16', 'Interiors_16x16');

      if (!rbMaster || !rbFloors || !rbWalls || !interiors) {
        // eslint-disable-next-line no-console
        console.warn('[ApartmentScene] Tileset(s) no resueltos, usando fallback.');
        return false;
      }

      const allTilesets = [rbMaster, rbFloors, rbWalls, interiors];

      const floor = map.createLayer('Floor', allTilesets, 0, 0);
      const detail = map.createLayer('Detail', allTilesets, 0, 0);
      const walls = map.createLayer('Walls', allTilesets, 0, 0);
      const furnBack = map.createLayer('Furniture_Back', allTilesets, 0, 0);
      const furnFront = map.createLayer('Furniture_Front', allTilesets, 0, 0);
      const doors = map.createLayer('Doors', allTilesets, 0, 0);
      const collisions = map.createLayer('Collisions', allTilesets, 0, 0);

      if (!floor) {
        // eslint-disable-next-line no-console
        console.warn('[ApartmentScene] Capa Floor ausente, fallback.');
        return false;
      }

      floor.setDepth(0);
      detail?.setDepth(1);
      furnBack?.setDepth(5);
      walls?.setDepth(10);
      doors?.setDepth(11);
      furnFront?.setDepth(20);
      collisions?.setDepth(25).setVisible(false).setAlpha(0.4);

      this.collisionsLayer = collisions ?? undefined;

      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[ApartmentScene] Error montando tilemap:', err);
      return false;
    }
  }

  // ---------- fallback procedural ----------

  private drawFloorsProcedural(): void {
    const g = this.add.graphics();
    for (const room of FLOORPLAN.rooms) {
      const px = room.x * TILE_SIZE;
      const py = room.y * TILE_SIZE;
      const pw = room.w * TILE_SIZE;
      const ph = room.h * TILE_SIZE;
      g.fillStyle(Phaser.Display.Color.HexStringToColor(room.color).color, 1);
      g.fillRect(px, py, pw, ph);

      if (!room.secret) {
        this.add
          .text(px + pw / 2, py + 6, room.name.toUpperCase(), {
            fontFamily: "'Silkscreen', monospace",
            fontSize: '8px',
            color: '#ffffff',
          })
          .setOrigin(0.5, 0)
          .setAlpha(0.35);
      }
    }
  }

  private drawWallsProcedural(): void {
    // Pinta un rect sólido oscuro encima de los tiles de pared para que la
    // versión procedural (sin tilemap) muestre dónde están las paredes.
    // No carga físico — eso lo hace buildWallColliders.
    const g = this.add.graphics({ fillStyle: { color: 0x3a3a3a, alpha: 1 } });
    for (let ty = 0; ty < FLOORPLAN.mapHeight; ty++) {
      for (let tx = 0; tx < FLOORPLAN.mapWidth; tx++) {
        if (!isWallTile(tx, ty)) continue;
        g.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    g.setDepth(10);
  }

  // ---------- colisión DESACOPLADA ----------

  /**
   * Genera colliders estáticos (invisibles) desde floorplan.isWallTile().
   * Merge horizontal primero; las celdas restantes se agrupan en tiras
   * verticales. Resultado típico: ~80-120 rects para 1.5K tiles de mapa.
   */
  private buildWallColliders(): void {
    const W = FLOORPLAN.mapWidth;
    const H = FLOORPLAN.mapHeight;

    // Mapa visitado para no duplicar bodies.
    const visited: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
    const strips: { x: number; y: number; w: number; h: number }[] = [];

    // 1) Horizontales: barro fila por fila agrupando runs consecutivos.
    for (let ty = 0; ty < H; ty++) {
      let runStart = -1;
      for (let tx = 0; tx <= W; tx++) {
        const isWall = tx < W && isWallTile(tx, ty);
        if (isWall && !visited[ty][tx]) {
          if (runStart === -1) runStart = tx;
        } else {
          if (runStart !== -1) {
            const runEnd = tx - 1;
            const runLen = runEnd - runStart + 1;
            // Sólo mergeamos si la tira es al menos 2 tiles; si no, dejamos
            // la celda para la pasada vertical por si forma columna.
            if (runLen >= 2) {
              strips.push({ x: runStart, y: ty, w: runLen, h: 1 });
              for (let k = runStart; k <= runEnd; k++) visited[ty][k] = true;
            }
            runStart = -1;
          }
        }
      }
    }

    // 2) Verticales de las celdas no visitadas.
    for (let tx = 0; tx < W; tx++) {
      let runStart = -1;
      for (let ty = 0; ty <= H; ty++) {
        const isWall = ty < H && isWallTile(tx, ty) && !visited[ty][tx];
        if (isWall) {
          if (runStart === -1) runStart = ty;
        } else {
          if (runStart !== -1) {
            const runEnd = ty - 1;
            const runLen = runEnd - runStart + 1;
            strips.push({ x: tx, y: runStart, w: 1, h: runLen });
            for (let k = runStart; k <= runEnd; k++) visited[k][tx] = true;
            runStart = -1;
          }
        }
      }
    }

    // 3) Materializa un StaticGroup de rects invisibles.
    this.wallStaticGroup = this.physics.add.staticGroup();
    for (const s of strips) {
      const px = s.x * TILE_SIZE;
      const py = s.y * TILE_SIZE;
      const pw = s.w * TILE_SIZE;
      const ph = s.h * TILE_SIZE;
      const rect = this.add.rectangle(px + pw / 2, py + ph / 2, pw, ph, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.wallStaticGroup.add(rect);
    }

    // 4) Graphics de debug (oculto por defecto, tecla G lo togglea).
    this.wallDebugGraphics = this.add.graphics();
    this.wallDebugGraphics.setDepth(900);
    this.redrawWallDebug(strips);
    this.wallDebugGraphics.setVisible(false);

    // eslint-disable-next-line no-console
    console.log(
      `[ApartmentScene] walls: ${strips.length} colliders generados desde floorplan.`,
    );
  }

  private redrawWallDebug(strips: { x: number; y: number; w: number; h: number }[]): void {
    if (!this.wallDebugGraphics) return;
    const g = this.wallDebugGraphics;
    g.clear();
    g.lineStyle(1, 0xff5c8a, 0.95);
    g.fillStyle(0xff5c8a, 0.25);
    for (const s of strips) {
      const px = s.x * TILE_SIZE;
      const py = s.y * TILE_SIZE;
      const pw = s.w * TILE_SIZE;
      const ph = s.h * TILE_SIZE;
      g.fillRect(px, py, pw, ph);
      g.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    }
  }

  // ---------- marcadores ----------

  private drawDoorMarkers(): void {
    // S2.9: marcadores SÓLO en DEV_HUD. En producción las puertas se
    // dibujan desde el tilemap (capa Doors), no necesitamos pintar
    // rectángulos rosa/dorados encima.
    if (!this.DEV_HUD) return;
    const colorMap: Record<string, number> = {
      door: 0xff5c8a,
      sliding: 0x8fd3f4,
      arch: 0x5eead4,
      main: 0xffd700,
      secret: 0xfbbf24,
    };

    for (const door of FLOORPLAN.doors) {
      const isH = door.dir === 'h';
      const pw = isH ? door.length * TILE_SIZE : TILE_SIZE;
      const ph = isH ? TILE_SIZE : door.length * TILE_SIZE;
      const px = door.x * TILE_SIZE;
      const py = door.y * TILE_SIZE;

      this.add
        .rectangle(px, py, pw, ph, colorMap[door.type] ?? 0xff5c8a, 0.55)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0xffffff, 0.9)
        .setDepth(12);

      this.add
        .text(px + pw / 2, py + ph / 2, door.type, {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '6px',
          color: '#ffffff',
        })
        .setOrigin(0.5, 0.5)
        .setAlpha(0.9)
        .setDepth(30);

      if (door.type === 'main') {
        this.add
          .text(px + pw / 2, py - 4, '\u2605 ENTRADA', {
            fontFamily: "'Silkscreen', monospace",
            fontSize: '8px',
            color: '#ffd700',
          })
          .setOrigin(0.5, 1)
          .setDepth(30);
      }
    }
  }

  /**
   * Marcadores visuales para los SYSTEM ANCHORS (interactables fijos).
   *
   * Estos objetos (TV+consola, frigo, telescopio, PC, cama, espejo, ...)
   * son posiciones fijas del piso que hospedarán minijuegos o sistemas
   * persistentes (Overcooked cocina, constelaciones telescopio, arcade TV,
   * shop PC, change-look espejo, etc.). NO son muebles customizables —
   * esos van por separado (Día 13-14: drag&drop desde shop sobre rooms).
   *
   * Solución visual provisional: un pulso dorado pequeño al centro del
   * anchor (6px, alpha pulsante). Es una pista visible sin chocar con
   * el arte. Se ELIMINA cuando apartment.tmj tenga pintados los tiles
   * reales de LimeZu Interiors en los Furniture_* layers — entonces
   * el mueble real es la señal visual y este marcador sobra.
   *
   * Dos modos:
   *   - Default (producción-friendly): pulso tenue (0.3-0.7 alpha), sin texto.
   *   - DEV_HUD on: se añade la etiqueta "type" encima para debugging.
   */
  private drawInteractableMarkers(): void {
    // S2.7: dejamos los marcadores SÓLO en DEV_HUD. En producción, la
    // proximity prompt (FloatingPrompt) ya da feedback suficiente sin
    // ensuciar el suelo con círculos dorados al lado de cada mueble.
    if (!this.DEV_HUD) return;
    for (const i of FLOORPLAN.interactables) {
      const x = i.x * TILE_SIZE + TILE_SIZE / 2;
      const y = i.y * TILE_SIZE + TILE_SIZE / 2;
      const marker = this.add
        .circle(x, y, 3, 0xfbbf24, 0.25)
        .setStrokeStyle(1, 0xfbbf24, 0.9)
        .setDepth(6);
      this.tweens.add({
        targets: marker,
        scale: { from: 0.85, to: 1.15 },
        alpha: { from: 0.35, to: 0.75 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
      });
      this.add
        .text(x, y - 10, i.type, {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '6px',
          color: '#ffffff',
        })
        .setOrigin(0.5, 1)
        .setAlpha(0.8)
        .setDepth(30);
    }
  }

  // ---------- player ----------

  /**
   * Registra frames manualmente en una texture cargada como IMAGE.
   *
   * Los sheets de LimeZu Character Generator tienen un "header row" decorativo
   * de 16 px arriba (3 mini-avatares para UI) y después filas de personajes de
   * `cellH` de alto (16×32 para los 16×16 sheets). Si lo cargásemos como
   * spritesheet directo, frame 0 saldría cortado: mitad header + mitad cuerpo.
   *
   * Solución: cargar como image y registrar frames programáticamente a partir
   * de y = topOffsetPx con celdas cellW × cellH. El frame 0 pasa a ser la
   * primera celda del primer personaje real — no el header.
   */
  private registerCharacterFrames(
    key: string,
    cellW: number,
    cellH: number,
    topOffsetPx: number,
  ): void {
    if (!this.textures.exists(key)) {
      // eslint-disable-next-line no-console
      console.warn(`[registerCharacterFrames] texture '${key}' ausente`);
      return;
    }
    const tex = this.textures.get(key);
    const src = tex.getSourceImage() as HTMLImageElement;
    const cols = Math.floor(src.width / cellW);
    const rows = Math.floor((src.height - topOffsetPx) / cellH);

    // Idempotencia REAL: si la texture ya tiene los frames numéricos con
    // las dimensiones correctas, no hacemos nada. Crítico al venir desde
    // HubScene (donde ya se invocó `setupMaria` de CharacterSetup): si
    // borrásemos y re-añadiésemos los frames, las animaciones globales
    // creadas por la otra escena quedarían apuntando a Frames null →
    // crash en sprite.play() con "Cannot read properties of null
    // (reading 'sourceSize')".
    const existing = tex.has('0') ? tex.get('0') : null;
    if (
      existing &&
      existing.cutWidth === cellW &&
      existing.cutHeight === cellH &&
      existing.cutY === topOffsetPx
    ) {
      // Aún así actualizamos maxFrameIdx contando frames existentes para
      // que el cycler del inspector no se quede a 0.
      if (key === 'maria') {
        const total = cols * rows;
        this.maxFrameIdx = total - 1;
      }
      return;
    }

    // Limpia frames numéricos preexistentes (si alguien re-invoca este método
    // con otra celda, no queremos frames stale con el tamaño anterior).
    // tex.getFrameNames(false) excluye __BASE. Si la API no está disponible
    // cae a un fallback que itera Object.keys(tex.frames).
    const allNames = typeof (tex as unknown as { getFrameNames?: (b?: boolean) => string[] })
      .getFrameNames === 'function'
      ? (tex as unknown as { getFrameNames: (b?: boolean) => string[] }).getFrameNames(false)
      : Object.keys((tex as unknown as { frames: Record<string, unknown> }).frames).filter(
          (n) => n !== '__BASE',
        );
    for (const fname of allNames) {
      if (/^\d+$/.test(fname)) {
        tex.remove(fname);
      }
    }

    let added = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        tex.add(idx.toString(), 0, c * cellW, topOffsetPx + r * cellH, cellW, cellH);
        added++;
      }
    }
    // Guarda el tope del índice para el ciclador [ ] (sólo maria).
    if (key === 'maria') {
      this.maxFrameIdx = added - 1;
    }
    // eslint-disable-next-line no-console
    console.log(
      `[registerCharacterFrames] ${key}: ${src.width}×${src.height} px, ` +
        `${cols}×${rows} celdas de ${cellW}×${cellH}, offset=${topOffsetPx}, ` +
        `+${added} frames registrados.`,
    );
  }

  /**
   * Crea las 8 animaciones (idle × 4 dirs + walk × 4 dirs) a partir del
   * layout asumido. Idempotente: no recrea si ya existen.
   */
  private createMariaAnimations(): void {
    if (!this.textures.exists('maria')) return;
    if (this.anims.exists('maria-idle-down')) return;

    const COLS = ApartmentScene.CHAR_COLS;
    const FPD = ApartmentScene.CHAR_FPD;
    const DIR = ApartmentScene.CHAR_DIR_OFFSET;

    const make = (key: string, rowIdx: number, dirOffset: number, frameRate: number) => {
      const start = rowIdx * COLS + dirOffset;
      const end = start + FPD - 1;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers('maria', { start, end }),
        frameRate,
        repeat: -1,
      });
    };

    // Fila 0 = idle (6 fps, respiración suave).
    make('maria-idle-down', 0, DIR.down, 6);
    make('maria-idle-right', 0, DIR.right, 6);
    make('maria-idle-up', 0, DIR.up, 6);
    make('maria-idle-left', 0, DIR.left, 6);

    // Fila 1 = walk (10 fps).
    make('maria-walk-down', 1, DIR.down, 10);
    make('maria-walk-right', 1, DIR.right, 10);
    make('maria-walk-up', 1, DIR.up, 10);
    make('maria-walk-left', 1, DIR.left, 10);

    // eslint-disable-next-line no-console
    console.log(
      '[anims] maria: 8 animaciones creadas (idle/walk × down/right/up/left).',
    );
  }

  private spawnMaria(): void {
    const sx = FLOORPLAN.spawn.x * TILE_SIZE + TILE_SIZE / 2;
    const sy = FLOORPLAN.spawn.y * TILE_SIZE + TILE_SIZE / 2;

    const useSprite = this.textures.exists('maria');
    this.mariaIsSprite = useSprite;

    // Con registerCharacterFrames ya llamado, frame 0 = primera celda de la
    // fila 1 (primer personaje real). No hay que saltarse nada manualmente.
    // Típicamente la fila 0 de la rejilla post-offset es idle-down.
    const initialFrame = 0;

    const sprite = useSprite
      ? this.add.sprite(sx, sy, 'maria', initialFrame)
      : this.add.rectangle(sx, sy, 10, 28, 0xff5c8a).setStrokeStyle(1, 0xffffff, 0.9);

    sprite.setDepth(22); // por encima de furniture_front (20).
    this.physics.add.existing(sprite);

    const body = (sprite as unknown as { body: Phaser.Physics.Arcade.Body }).body;
    body.setCollideWorldBounds(true);
    if (useSprite) {
      // Sprite 16×32 (cabeza arriba + cuerpo abajo).
      // Hitbox 10×5 en rows 26..30 (pies, abajo del todo).
      body.setSize(10, 5);
      body.setOffset(3, 26);
    } else {
      // Placeholder rect 10×28: hitbox en la parte baja.
      body.setSize(10, 5);
      body.setOffset(0, 22);
    }

    this.mariaBody = body;
    this.maria = sprite;

    // ANCLAJE siempre visible. Una sombra elipse bajo los pies + un
    // marcador pequeño tipo flechita encima. Si por lo que sea el frame
    // del sprite queda vacío, María sigue siendo localizable.
    //
    // Sprite 16×32 con origin center: feet ≈ y+14, head ≈ y-16.
    const shadow = this.add.ellipse(sx, sy + 14, 10, 3, 0x000000, 0.35);
    shadow.setDepth(21);
    const pin = this.add.triangle(sx, sy - 20, 0, -4, -3, 2, 3, 2, 0xff5c8a, 0.9);
    pin.setStrokeStyle(1, 0xffffff, 1).setDepth(23);
    // Seguimiento: shadow y pin anclados a la sprite cada frame.
    this.events.on('update', () => {
      shadow.x = this.maria.x;
      shadow.y = this.maria.y + 14;
      pin.x = this.maria.x;
      pin.y = this.maria.y - 20;
    });

    // Fuente única de colisión.
    this.physics.add.collider(sprite, this.wallStaticGroup);
  }

  private setupInput(): void {
    if (!this.input.keyboard) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      W: this.input.keyboard.addKey(K.W),
      A: this.input.keyboard.addKey(K.A),
      S: this.input.keyboard.addKey(K.S),
      D: this.input.keyboard.addKey(K.D),
      P: this.input.keyboard.addKey(K.P),
      G: this.input.keyboard.addKey(K.G),
      I: this.input.keyboard.addKey(K.I),
      C: this.input.keyboard.addKey(K.C),
      E: this.input.keyboard.addKey(K.E),
      SPACE: this.input.keyboard.addKey(K.SPACE),
      BRACKET_LEFT: this.input.keyboard.addKey(K.OPEN_BRACKET),
      BRACKET_RIGHT: this.input.keyboard.addKey(K.CLOSED_BRACKET),
    };

    // S2.14: dev keys retiradas para producción (P palette, G walls debug,
    // C collisions, [ ] frame cycler, F9 reset, F10 unlock-all). Gated
    // detrás de DEV_HUD por si necesitamos volver a habilitarlas.
    if (this.DEV_HUD) {
      this.keys.P.on('down', () => {
        this.scene.launch('DebugPaletteScene');
        this.scene.pause();
      });
      this.keys.G.on('down', () => {
        this.wallDebugVisible = !this.wallDebugVisible;
        this.wallDebugGraphics?.setVisible(this.wallDebugVisible);
      });
      this.keys.C.on('down', () => {
        if (this.collisionsLayer) {
          this.collisionsLayer.setVisible(!this.collisionsLayer.visible);
        }
      });
      this.keys.BRACKET_LEFT.on('down', () => this.cycleFrame(-1));
      this.keys.BRACKET_RIGHT.on('down', () => this.cycleFrame(+1));
    }

    // E → dispara interacción con el objeto más cercano (única tecla activa).
    this.keys.E.on('down', () => {
      void this.interactionSystem?.trigger();
    });

    // S2.14: F9/F10 también gated por DEV_HUD. En producción quedan fuera.
    const devKeyHandler = (e: KeyboardEvent) => {
      if (!this.DEV_HUD) return;
      if (e.key === 'F9') {
        e.preventDefault();
        useProgressStore.getState().resetProgress();
        this.scene.restart();
      } else if (e.key === 'F10') {
        e.preventDefault();
        const st = useProgressStore.getState();
        st.markIntroPlayed();
        st.markApartmentEntered();
        st.markCatsSpawned();
        st.unlockAllRooms();
        st.unlockGift('cena');
        st.unlockGift('misterioso');
        st.unlockGift('escapada');
        st.setHatchUnlocked(true);
        st.setSafeUnlocked(true);
        st.setArcadeGiftUnlocked(true);
        this.scene.restart();
      }
    };
    window.addEventListener('keydown', devKeyHandler);
    // Limpia al salir de la escena (Hub/Apartment toggle).
    this.events.once('shutdown', () => window.removeEventListener('keydown', devKeyHandler));
    this.events.once('destroy', () => window.removeEventListener('keydown', devKeyHandler));

    // S1.2: destroy del FurnitureRenderer en shutdown evita listener-leak
    // del onTvStateChange (era la causa del crash al toggle TV tras restart).
    this.events.once('shutdown', () => {
      this.furnitureRenderer?.destroy();
      this.furnitureRenderer = null;
      this.staticFurnitureRenderer?.destroy();
      this.staticFurnitureRenderer = null;
      destroyMiniPlayer();
      this.hakuMemorial?.destroy();
      this.hakuMemorial = undefined;
      this.limeZuHandle?.destroy();
      this.limeZuHandle = undefined;
      this.pcAlexGif?.destroy();
      this.pcAlexGif = undefined;
      this.pcMariaGif?.destroy();
      this.pcMariaGif = undefined;
    });
    this.events.once('destroy', () => {
      this.furnitureRenderer?.destroy();
      this.furnitureRenderer = null;
      this.staticFurnitureRenderer?.destroy();
      this.staticFurnitureRenderer = null;
      destroyMiniPlayer();
      this.hakuMemorial?.destroy();
      this.hakuMemorial = undefined;
      this.limeZuHandle?.destroy();
      this.limeZuHandle = undefined;
      this.pcAlexGif?.destroy();
      this.pcAlexGif = undefined;
      this.pcMariaGif?.destroy();
      this.pcMariaGif = undefined;
    });
  }

  /**
   * Avanza/retrocede el frame mostrado en la sprite de María. Solo activo
   * si el sprite existe (no el placeholder rectángulo). Actualiza también
   * el HUD para que el valor sea visible en pantalla.
   */
  private cycleFrame(delta: number): void {
    if (!this.mariaIsSprite || this.maxFrameIdx <= 0) return;
    this.currentFrameIdx = Phaser.Math.Clamp(
      this.currentFrameIdx + delta,
      0,
      this.maxFrameIdx,
    );
    const sprite = this.maria as Phaser.GameObjects.Sprite;
    // Parar cualquier animación activa antes de forzar frame estático.
    sprite.anims.stop();
    sprite.setFrame(this.currentFrameIdx.toString());
    if (this.frameLabel) {
      this.frameLabel.setText(
        `frame ${this.currentFrameIdx} / ${this.maxFrameIdx}   (fila ${Math.floor(
          this.currentFrameIdx / ApartmentScene.CHAR_COLS,
        )}, col ${this.currentFrameIdx % ApartmentScene.CHAR_COLS})`,
      );
    }
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_WIDTH_PX, MAP_HEIGHT_PX);
    this.physics.world.setBounds(0, 0, MAP_WIDTH_PX, MAP_HEIGHT_PX);
    cam.startFollow(this.maria as unknown as Phaser.GameObjects.GameObject, true, 0.2, 0.2);
    cam.setDeadzone(40, 30);
  }

  private setupHud(): void {
    // HUD de producción: SOLO el nombre de la habitación actual (pequeño,
    // esquina sup-izq). Ambiental, no-invasivo.
    this.roomLabel = this.add
      .text(6, 6, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#5eead4',
      })
      .setScrollFactor(0)
      .setDepth(1000);

    // A partir de aquí, todo es dev-only. Se compila igual pero no se pinta
    // si DEV_HUD está desactivado. Cambia el flag en la clase para ver los
    // indicadores durante debug (asset status, ciclador de frames, atajos).
    if (!this.DEV_HUD) return;

    this.add
      .text(6, 18, this.usingTilemap ? '\u25a0 tiles: LimeZu' : '\u25a0 tiles: placeholder', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: this.usingTilemap ? '#5eead4' : '#ff5c8a',
      })
      .setScrollFactor(0)
      .setAlpha(0.7)
      .setDepth(1000);

    // HUD del ciclador de frames (dev). Arranca mostrando frame 0.
    this.frameLabel = this.add
      .text(
        6,
        30,
        `frame 0 / ${this.maxFrameIdx}   (fila 0, col 0)`,
        {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '7px',
          color: '#fbbf24',
        },
      )
      .setScrollFactor(0)
      .setAlpha(0.85)
      .setDepth(1000);

    this.add
      .text(6, 240, '[ / ] cycle frame (dev override)', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#fbbf24',
      })
      .setScrollFactor(0)
      .setAlpha(0.7)
      .setDepth(1000);

    this.add
      .text(6, 248, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#ff5c8a',
      })
      .setScrollFactor(0)
      .setAlpha(0.6)
      .setDepth(1000);
  }

  update(): void {
    if (!this.mariaBody) return;

    // Día 8: tickear gatos siempre (también durante busy/cinematic) para
    // que la AI se mueva mientras hay diálogo abierto. El nameTag se
    // sigue actualizando.
    this.catSystem?.update();

    // Día 8: dispara la cinemática de gatos si está pending y NO hay
    // diálogo abierto encima (busy=false). Así el cuadro "muro
    // desbloqueado" tiene tiempo de leerse y cerrarse antes del fade-out
    // de la cinemática.
    if (this.pendingCatSpawn) {
      const stillBusy = this.interactionSystem?.getState().busy === true;
      if (!stillBusy) {
        this.pendingCatSpawn = false;
        const p = useProgressStore.getState();
        this.catSystem.spawnIfReady(p.catsSpawned, () => {
          if (!p.catsSpawned) useProgressStore.getState().markCatsSpawned();
        });
      }
    }

    // Día 6: si hay diálogo u otra UI modal abierta (interactionSystem.busy),
    // congelamos a María. El sprite se queda en la animación idle de la
    // última dirección. Día 8: la cinemática de gatos también congela
    // (catCinematicLock). Día 8c: el menú de gato (showCatMenu)
    // bloquea via catSystem.isMenuOpen().
    const busy =
      this.interactionSystem?.getState().busy === true ||
      this.catCinematicLock ||
      this.catSystem?.isMenuOpen() === true;
    if (busy) {
      this.mariaBody.setVelocity(0, 0);
      if (this.mariaIsSprite) {
        const sprite = this.maria as Phaser.GameObjects.Sprite;
        const idleKey = `maria-idle-${this.lastDir}`;
        if (sprite.anims.currentAnim?.key !== idleKey || !sprite.anims.isPlaying) {
          sprite.play(idleKey, true);
        }
      }
      // Aun en busy, seguimos llamando a interactionSystem.update() para
      // que mantenga el prompt oculto (él mismo early-returns en busy).
      this.interactionSystem?.update();
      return;
    }

    let vx = 0;
    let vy = 0;

    if (this.cursors.left?.isDown || this.keys.A.isDown) vx -= 1;
    if (this.cursors.right?.isDown || this.keys.D.isDown) vx += 1;
    if (this.cursors.up?.isDown || this.keys.W.isDown) vy -= 1;
    if (this.cursors.down?.isDown || this.keys.S.isDown) vy += 1;

    if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.SQRT2;
      vx *= inv;
      vy *= inv;
    }

    this.mariaBody.setVelocity(vx * this.MOVE_SPEED, vy * this.MOVE_SPEED);

    // Animación según input. Sólo si es sprite (no el placeholder rect).
    // El ciclador [ ] sigue funcionando como override puntual: stop() + setFrame,
    // y en cuanto vuelvas a moverte o a estar quieto, play() re-arranca la anim.
    if (this.mariaIsSprite) {
      const sprite = this.maria as Phaser.GameObjects.Sprite;
      const moving = vx !== 0 || vy !== 0;

      if (moving) {
        // Priorizar dirección dominante cuando se combinan diagonales.
        let dir: Direction;
        if (Math.abs(vy) > Math.abs(vx)) {
          dir = vy < 0 ? 'up' : 'down';
        } else {
          dir = vx < 0 ? 'left' : 'right';
        }
        this.lastDir = dir;
        const key = `maria-walk-${dir}`;
        if (sprite.anims.currentAnim?.key !== key || !sprite.anims.isPlaying) {
          sprite.play(key, true);
        }
      } else {
        const key = `maria-idle-${this.lastDir}`;
        if (sprite.anims.currentAnim?.key !== key || !sprite.anims.isPlaying) {
          sprite.play(key, true);
        }
      }
    }

    const tx = Math.floor(this.maria.x / TILE_SIZE);
    const ty = Math.floor(this.maria.y / TILE_SIZE);
    const room = roomAt(tx, ty);
    const id = room?.id ?? null;
    if (id !== this.currentRoomId) {
      this.currentRoomId = id;
      this.roomLabel.setText(room ? `> ${room.name}` : '> pasillo');
    }

    // Día 5: actualiza proximidad + prompt flotante. Si hay un diálogo u
    // otra UI modal encima, el propio sistema se pone busy y no repinta.
    this.interactionSystem?.update();
  }
}
