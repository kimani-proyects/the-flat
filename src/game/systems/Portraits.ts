import * as Phaser from 'phaser';

/**
 * Portraits — sistema de retratos para los diálogos (Día 8.5).
 *
 * Cada speaker del juego (María, Alex, gatos, etc.) tiene un "portrait":
 * un crop pequeño y reconocible de su cabeza (16×16) que se muestra a la
 * izquierda del cuadro de diálogo. El portrait se extrae de la sprite
 * sheet del personaje correspondiente — no necesitamos PNGs nuevos.
 *
 * API:
 *   Portraits.register(scene)
 *     - Llamado UNA vez al boot (o en cada escena, idempotente). Recorta
 *       la cabeza de cada character disponible y la registra como un
 *       frame "portrait" dentro de la misma texture.
 *
 *   Portraits.has(scene, key)
 *     - True si hay portrait disponible para ese speaker.
 *
 *   Portraits.create(scene, x, y, key)
 *     - Devuelve un Phaser.GameObjects.Image listo para mostrar. El
 *       caller se encarga de añadirlo a containers, fijar depth, etc.
 *
 * Speaker keys soportados (it.8.5):
 *   - 'maria'   → cabeza de María (sprite 'maria', frame idle-down)
 *   - 'alex'    → cabeza de Alex (sprite 'alex', frame idle-down)
 *   - 'kero'    → cabeza del gato Kero  (Día 8 — sprite pendiente)
 *   - 'haku'    → cabeza del gato Haku  (Día 8 — sprite pendiente)
 *   - 'nala'    → cabeza de la gata Nala (Día 8 — sprite pendiente)
 *   - 'narrator' → símbolo genérico (placeholder, no usa sprite)
 *
 * Speaker keys no registrados → Portraits.has() devuelve false y el
 * DialogSystem hace fallback a "no mostrar portrait" (sólo nombre).
 */

const PORTRAIT_W = 16;
/**
 * It.8.5b: subido de 16 → 24. Con 16×16 sólo se veía el cráneo y no se
 * reconocía a quién hablaba. 24px coge cabeza + hombros, mucho más
 * legible. Para sprite chars 16×32, esto es la mitad superior + un
 * tercio adicional del cuerpo (frente, ojos, boca, hombros, parte alta
 * del torso).
 */
const PORTRAIT_H = 24;

type PortraitDef = {
  /** Clave de la texture del sprite (ej. 'maria'). */
  textureKey: string;
  /**
   * Coordenadas del crop dentro de la source image. Usamos la cabeza
   * (mitad superior del frame idle-down).
   *
   * Para LimeZu chars 16×32 con header offset 32:
   *   - Frame 0 idle-down empieza en (0, 32).
   *   - La cabeza ocupa los primeros 16px de altura → (0, 32, 16, 16).
   */
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
};

const DEFS: Record<string, PortraitDef> = {
  // Cabeza + hombros (16×24). Cabe en frame 36×52 escalado 2× (32×48).
  maria: { textureKey: 'maria', srcX: 0, srcY: 32, srcW: 16, srcH: 24 },
  alex: { textureKey: 'alex', srcX: 0, srcY: 32, srcW: 16, srcH: 24 },
  // Día 8: cuando se carguen los sprites en BootScene, descomentar.
  // Para gatos (16×16 sin head/body split) usaremos srcH=16 y el slot
  // del DialogSystem se queda con el frame 36×52 — el gato simplemente
  // queda más pequeño en el cuadro. Alternativa: extraer el frame del
  // gato a doble tamaño manualmente.
  // kero: { textureKey: 'kero', srcX: 0, srcY: 0, srcW: 16, srcH: 16 },
  // haku: { textureKey: 'haku', srcX: 0, srcY: 0, srcW: 16, srcH: 16 },
  // nala: { textureKey: 'nala', srcX: 0, srcY: 0, srcW: 16, srcH: 16 },
};

const PORTRAIT_FRAME_NAME = '__portrait';

export const Portraits = {
  /**
   * Registra los portraits disponibles. Idempotente: si el frame
   * `__portrait` ya existe en la texture, no hace nada.
   */
  register(scene: Phaser.Scene): void {
    for (const [, def] of Object.entries(DEFS)) {
      if (!scene.textures.exists(def.textureKey)) {
        // Sprite no cargado todavía (puede pasar con kero/haku/nala antes
        // de Día 8). Skip silencioso.
        continue;
      }
      const tex = scene.textures.get(def.textureKey);
      if (tex.has(PORTRAIT_FRAME_NAME)) continue; // ya registrado
      tex.add(PORTRAIT_FRAME_NAME, 0, def.srcX, def.srcY, def.srcW, def.srcH);
    }
  },

  /** ¿Hay portrait disponible para ese speaker key? */
  has(scene: Phaser.Scene, key: string): boolean {
    const def = DEFS[key.toLowerCase()];
    if (!def) return false;
    if (!scene.textures.exists(def.textureKey)) return false;
    return scene.textures.get(def.textureKey).has(PORTRAIT_FRAME_NAME);
  },

  /**
   * Crea un Phaser.Image con el portrait. El caller decide depth /
   * scrollFactor / origin / scale. Por defecto está fijo al viewport
   * (scrollFactor 0) y escalado 2× para que se vea bien sobre el panel
   * de diálogo (32×32 visuales sobre un viewport 480×270).
   */
  create(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image | null {
    const def = DEFS[key.toLowerCase()];
    if (!def) return null;
    if (!scene.textures.exists(def.textureKey)) return null;
    if (!scene.textures.get(def.textureKey).has(PORTRAIT_FRAME_NAME)) return null;
    const img = scene.add
      .image(x, y, def.textureKey, PORTRAIT_FRAME_NAME)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setScale(2);
    return img;
  },

  /** Constantes para el caller (DialogSystem). */
  PORTRAIT_W,
  PORTRAIT_H,
} as const;
