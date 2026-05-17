import * as Phaser from 'phaser';
import { FLOORPLAN, TILE_SIZE } from '../data/floorplan';
import type { Interactable, InteractableType } from '../data/floorplan';
import { UI_FRAMES, hasUiFrame } from './UiAtlas';

/**
 * InteractionSystem — detección de proximidad + prompt + dispatch de handlers.
 *
 * Cómo funciona:
 *   1) Cada update, calculamos distancia Manhattan de la jugadora a todos
 *      los interactables del floorplan.
 *   2) El más cercano dentro de NEAR_RADIUS_TILES se marca como activo.
 *   3) Pintamos un prompt flotante encima del activo: tecla "E" + etiqueta.
 *   4) Si el usuario pulsa la tecla de interacción, se busca en el registry
 *      una función handler para el tipo del interactable y se ejecuta.
 *
 * El registry es extensible: nuevos tipos de interactable se añaden en
 * handlers.ts sin tocar este sistema. Ideal para ir sumando contenido
 * a lo largo del roadmap sin tocar infraestructura.
 */

export type InteractionContext = {
  scene: Phaser.Scene;
  player: Phaser.GameObjects.GameObject;
  interactable: Interactable;
  /**
   * Abre el DialogSystem con las páginas dadas y espera al cierre.
   * Pasado como función para mantener handlers.ts desacoplado del
   * DialogSystem concreto (más fácil de testear y de reemplazar).
   */
  showDialog: (
    pages: string | string[],
    opts?: { speaker?: string; portrait?: string },
  ) => Promise<void>;
};

export type InteractionHandler = (ctx: InteractionContext) => void | Promise<void>;

/** Shape de la función que la escena inyecta para abrir diálogos. */
export type ShowDialogFn = InteractionContext['showDialog'];

/**
 * Estado que expone el sistema para que la escena lo consulte (p.ej.
 * para pausar movimiento de la jugadora mientras hay interacción abierta).
 */
export type InteractionState = {
  active: Interactable | null;
  busy: boolean;
};

const NEAR_RADIUS_TILES = 1.75; // ~1.75 tiles de distancia Manhattan
const PROMPT_DEPTH = 990;

export class InteractionSystem {
  private scene: Phaser.Scene;
  private player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  private handlers: Map<string, InteractionHandler> = new Map();
  private state: InteractionState = { active: null, busy: false };
  private showDialogFn: ShowDialogFn;

  /**
   * Día 7.5 — Interactables AÑADIDOS en runtime, fuera del floorplan.json.
   * LockedWallSystem inyecta uno por muro bloqueado y los retira cuando se
   * desbloquean. La pasada de proximidad los recorre junto con los estáticos.
   * Indexados por id para permitir remove rápido.
   */
  private extras: Map<string, Interactable> = new Map();

  /**
   * Día 7.5 — Mapa opcional de etiquetas custom por id. Útil para que el
   * prompt no muestre "interactuar" sino p.ej. "muro habitación de María".
   * Se setea junto con addExtra(); cae a humanLabel(type) si no hay entrada.
   */
  private customLabels: Map<string, string> = new Map();

  // Objetos visuales del prompt flotante.
  private promptKeyImage?: Phaser.GameObjects.Image;
  private promptKeyRect?: Phaser.GameObjects.Rectangle; // fallback si no hay atlas
  private promptLabel?: Phaser.GameObjects.Text;
  private promptBg?: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle,
    showDialog: ShowDialogFn,
  ) {
    this.scene = scene;
    this.player = player;
    this.showDialogFn = showDialog;
    this.buildPrompt();
  }

  // ---------- registry ----------

  /**
   * Registra un handler para un tipo de interactable. Idempotente: si ya
   * existe, lo sobrescribe (útil en HMR).
   */
  register(type: InteractableType, handler: InteractionHandler): void {
    this.handlers.set(type, handler);
  }

  /** Registra handlers en bulk desde un mapa {type: handler}. */
  registerAll(map: Partial<Record<InteractableType, InteractionHandler>>): void {
    for (const [type, handler] of Object.entries(map)) {
      if (handler) this.register(type as InteractableType, handler);
    }
  }

  /**
   * Día 7.5 — Añade un interactable dinámico (no presente en floorplan.json).
   * Útil para muros bloqueantes generados a partir del estado de progreso.
   * `label` opcional sobrescribe humanLabel(type) en el prompt.
   */
  addExtra(it: Interactable, label?: string): void {
    this.extras.set(it.id, it);
    if (label) this.customLabels.set(it.id, label);
  }

  /** Día 7.5 — Retira un interactable dinámico por id. */
  removeExtra(id: string): void {
    this.extras.delete(id);
    this.customLabels.delete(id);
    if (this.state.active && this.state.active.id === id) {
      this.state.active = null;
      this.hidePrompt();
    }
  }

  /**
   * Día 8 — Mueve la posición (en tiles) de un interactable dinámico.
   * Útil para entidades que se desplazan, como los gatos: el prompt
   * de proximidad debe seguirlos en vez de quedarse fijo en el spawn.
   * No-op si el id no existe.
   */
  updateExtraPosition(id: string, tileX: number, tileY: number): void {
    const it = this.extras.get(id);
    if (!it) return;
    it.x = tileX;
    it.y = tileY;
  }

  // ---------- vida ----------

  /** Estado público para la escena. */
  getState(): Readonly<InteractionState> {
    return this.state;
  }

  /**
   * La escena marca busy=true cuando lanza un diálogo u otra UI modal,
   * y busy=false cuando la cierra. Mientras busy, no cambiamos el activo
   * ni mostramos el prompt (ya hay otra cosa en pantalla).
   */
  setBusy(busy: boolean): void {
    this.state.busy = busy;
    if (busy) this.hidePrompt();
  }

  /**
   * Llamar cada frame con la posición actual de la jugadora.
   * Actualiza el interactable activo y repinta el prompt si toca.
   */
  update(): void {
    if (this.state.busy) return;

    const px = this.player.x;
    const py = this.player.y;
    const ptx = px / TILE_SIZE;
    const pty = py / TILE_SIZE;

    let nearest: Interactable | null = null;
    let nearestDist = Infinity;

    const consider = (it: Interactable) => {
      const itx = it.x + 0.5;
      const ity = it.y + 0.5;
      const dx = Math.abs(itx - ptx);
      const dy = Math.abs(ity - pty);
      const dist = dx + dy; // Manhattan
      if (dist < nearestDist && dist <= NEAR_RADIUS_TILES) {
        nearestDist = dist;
        nearest = it;
      }
    };

    for (const it of FLOORPLAN.interactables) consider(it);
    for (const it of this.extras.values()) consider(it);

    if (nearest !== this.state.active) {
      this.state.active = nearest;
    }

    if (nearest) {
      this.showPromptAt(nearest);
    } else {
      this.hidePrompt();
    }
  }

  /**
   * Dispara el handler del activo. Se llama desde la escena al pulsar E.
   * Si no hay activo o ya hay algo ocupando UI (busy), no hace nada.
   */
  async trigger(): Promise<void> {
    if (this.state.busy) return;
    const it = this.state.active;
    if (!it) return;
    const handler = this.handlers.get(it.type);
    if (!handler) {
      // eslint-disable-next-line no-console
      console.warn(
        `[InteractionSystem] Sin handler para tipo '${it.type}' (id=${it.id}).`,
      );
      return;
    }
    try {
      this.setBusy(true);
      await handler({
        scene: this.scene,
        player: this.player,
        interactable: it,
        showDialog: this.showDialogFn,
      });
    } finally {
      this.setBusy(false);
    }
  }

  // ---------- prompt fijo en HUD ----------
  //
  // El prompt NO sigue al objeto en el mundo; se ancla a la parte inferior
  // del viewport (setScrollFactor(0)) para que sea estable mientras la
  // jugadora se mueve. Más legible y menos ruido visual que un label flotando
  // sobre cada mueble. La etiqueta ("nevera", "telescopio"...) identifica
  // cuál es el objetivo sin tener que mirar.

  private static readonly PROMPT_BOTTOM_OFFSET = 18; // px desde el borde inferior

  private buildPrompt(): void {
    // Fondo semi-transparente detrás del prompt (para legibilidad sobre
    // tilesets oscuros o claros indistintamente).
    this.promptBg = this.scene.add
      .rectangle(0, 0, 44, 18, 0x0b0c10, 0.8)
      .setStrokeStyle(1, 0xfbbf24, 0.9)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PROMPT_DEPTH)
      .setVisible(false);

    // Tecla E: preferimos el sprite del atlas. Fallback = rect con "E".
    if (hasUiFrame(this.scene, UI_FRAMES.keyE)) {
      this.promptKeyImage = this.scene.add
        .image(0, 0, 'ui', UI_FRAMES.keyE)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PROMPT_DEPTH + 1)
        .setVisible(false);
    } else {
      this.promptKeyRect = this.scene.add
        .rectangle(0, 0, 14, 14, 0xfbbf24, 1)
        .setStrokeStyle(1, 0x0b0c10, 1)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PROMPT_DEPTH + 1)
        .setVisible(false);
    }

    // Label: nombre del interactable ("nevera", "telescopio", etc.).
    this.promptLabel = this.scene.add
      .text(0, 0, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(PROMPT_DEPTH + 1)
      .setVisible(false);
  }

  private showPromptAt(it: Interactable): void {
    // Posición fija en pantalla: centro-horizontal, cerca del borde inferior.
    // Como todos los objetos del prompt tienen scrollFactor=0, las coords
    // que usemos aquí son coords de VIEWPORT (no de mundo).
    const cam = this.scene.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height - InteractionSystem.PROMPT_BOTTOM_OFFSET;

    const label = this.customLabels.get(it.id) ?? humanLabel(it.type);
    const labelWidth = label.length * 5; // 8px monospace ≈ 5px por char
    const bgW = 26 + labelWidth;
    const bgH = 18;

    if (this.promptBg) {
      this.promptBg.setPosition(cx, cy).setSize(bgW, bgH).setVisible(true);
    }
    // Tecla E a la izquierda del texto dentro del pill.
    const keyX = cx - bgW / 2 + 10;
    if (this.promptKeyImage) {
      this.promptKeyImage.setPosition(keyX, cy).setVisible(true);
    } else if (this.promptKeyRect) {
      this.promptKeyRect.setPosition(keyX, cy).setVisible(true);
      if (!this.promptKeyRect.getData('hasTextOverlay')) {
        // Dibujamos la letra E encima del rect una sola vez, vinculándola.
        const eText = this.scene.add
          .text(keyX, cy, 'E', {
            fontFamily: "'Silkscreen', monospace",
            fontSize: '10px',
            color: '#0b0c10',
            fontStyle: 'bold',
          })
          .setOrigin(0.5, 0.5)
          .setScrollFactor(0)
          .setDepth(PROMPT_DEPTH + 2);
        this.promptKeyRect.setData('hasTextOverlay', true);
        this.promptKeyRect.setData('textRef', eText);
      }
      const ref = this.promptKeyRect.getData('textRef') as Phaser.GameObjects.Text;
      ref?.setPosition(keyX, cy).setVisible(true);
    }
    if (this.promptLabel) {
      this.promptLabel.setPosition(keyX + 10, cy).setText(label).setVisible(true);
    }
  }

  private hidePrompt(): void {
    this.promptBg?.setVisible(false);
    this.promptKeyImage?.setVisible(false);
    this.promptKeyRect?.setVisible(false);
    if (this.promptKeyRect) {
      const ref = this.promptKeyRect.getData('textRef') as Phaser.GameObjects.Text | undefined;
      ref?.setVisible(false);
    }
    this.promptLabel?.setVisible(false);
  }
}

/**
 * Nombres legibles para el prompt. Cubre todos los types actuales del
 * floorplan; si se añade uno nuevo y no está aquí, cae a "interactuar".
 */
function humanLabel(type: InteractableType): string {
  const labels: Record<string, string> = {
    'front-door': 'puerta',
    'coat-rack': 'perchero',
    plant: 'planta',
    fridge: 'nevera',
    stove: 'fogones',
    sink: 'fregadero',
    'dining-table': 'mesa',
    tv: 'tele',
    'coffee-table': 'mesita',
    sofa: 'sofá',
    bookshelf: 'librería',
    telescope: 'telescopio',
    mirror: 'espejo',
    washbasin: 'lavabo',
    wc: 'wc',
    bathtub: 'bañera',
    bed: 'cama',
    wardrobe: 'armario',
    pc: 'ordenador',
    safe: 'caja fuerte',
    'escape-hatch': 'escotilla',
    'wall-locked': 'muro bloqueado',
    cat: 'gato',
  };
  return labels[type] ?? 'interactuar';
}
