import * as Phaser from 'phaser';

/**
 * CharacterSetup — utilidades compartidas para cargar y animar a María.
 *
 * Originalmente vivía como dos métodos privados dentro de ApartmentScene.
 * Al añadir HubScene (rellano top-down con María visible) hizo falta
 * reusar la misma lógica desde dos sitios; lo extraemos aquí.
 *
 * Las texturas 'maria' / 'alex' se cargan desde BootScene como IMAGE
 * (no spritesheet). El motivo: los sheets de LimeZu Character Generator
 * tienen un "header row" de 16 px arriba (3 mini-avatares para UI) y
 * luego filas de personajes de 16×32. Si lo cargamos como spritesheet
 * directo con frameWidth=16, el frame 0 sale cortado a la mitad. Aquí
 * registramos los frames programáticamente, saltando el header.
 *
 * Layout del sheet (post-offset):
 *   - 56 columnas de celdas 16×32 px.
 *   - Cada fila contiene 4 direcciones × 6 frames = 24 frames de animación
 *     (más sobrantes que ahora ignoramos: las columnas 24..55 son otras
 *     animaciones — ataque, sentado, etc.).
 *   - Orden REAL dentro de la fila: right(0) / up(6) / left(12) / down(18).
 *     Smoke test confirmó este orden tras una iteración.
 *   - Fila 0 = idle (6 fps, respiración suave).
 *   - Fila 1 = walk (10 fps).
 */

export type Direction = 'down' | 'right' | 'up' | 'left';

export const CHAR_COLS = 56;
export const CHAR_FPD = 6;
export const CHAR_DIR_OFFSET: Record<Direction, number> = {
  right: 0,
  up: 6,
  left: 12,
  down: 18,
};

/**
 * Registra frames numéricos en la texture `key` ignorando el header
 * superior (`topOffsetPx`). Idempotente: si ya hay frames numéricos los
 * limpia primero. Devuelve el número de frames añadidos (útil para
 * dimensionar HUDs / inspectors).
 */
export function registerCharacterFrames(
  scene: Phaser.Scene,
  key: string,
  cellW: number,
  cellH: number,
  topOffsetPx: number,
): number {
  if (!scene.textures.exists(key)) {
    // eslint-disable-next-line no-console
    console.warn(`[CharacterSetup] texture '${key}' ausente`);
    return 0;
  }
  const tex = scene.textures.get(key);
  const src = tex.getSourceImage() as HTMLImageElement;
  const cols = Math.floor(src.width / cellW);
  const rows = Math.floor((src.height - topOffsetPx) / cellH);

  // Idempotencia REAL: si ya existe el frame "0" con las dimensiones que
  // pediríamos, no tocamos nada. Crítico al cambiar de escena: si en
  // HubScene ya se crearon frames + animaciones, y ApartmentScene vuelve
  // a llamar a registerCharacterFrames, los `tex.remove` de abajo dejarían
  // las animaciones cacheadas (globales en Phaser.Game) apuntando a Frame
  // objects null → crash en sprite.play(). Saltar early evita ese estado.
  const existing = tex.has('0') ? tex.get('0') : null;
  if (
    existing &&
    existing.cutWidth === cellW &&
    existing.cutHeight === cellH &&
    existing.cutY === topOffsetPx
  ) {
    return 0; // ya estaba — fast path.
  }

  // Limpia frames numéricos preexistentes (si alguien re-invoca este método
  // con otra celda, no queremos frames stale con el tamaño anterior).
  const allNames =
    typeof (tex as unknown as { getFrameNames?: (b?: boolean) => string[] }).getFrameNames === 'function'
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
  return added;
}

/**
 * Crea las 8 animaciones de María (idle × 4 dirs + walk × 4 dirs).
 * Idempotente: si ya existen, no recrea. Asume que `registerCharacterFrames`
 * ya se llamó previamente en esta misma ejecución (las animaciones a nivel
 * de Phaser.Game son globales — solo hay que crearlas una vez en toda la
 * vida del proceso).
 */
export function ensureMariaAnimations(scene: Phaser.Scene): void {
  if (!scene.textures.exists('maria')) return;
  if (scene.anims.exists('maria-idle-down')) return;

  const make = (key: string, rowIdx: number, dirOffset: number, frameRate: number) => {
    const start = rowIdx * CHAR_COLS + dirOffset;
    const end = start + CHAR_FPD - 1;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers('maria', { start, end }),
      frameRate,
      repeat: -1,
    });
  };

  make('maria-idle-down', 0, CHAR_DIR_OFFSET.down, 6);
  make('maria-idle-right', 0, CHAR_DIR_OFFSET.right, 6);
  make('maria-idle-up', 0, CHAR_DIR_OFFSET.up, 6);
  make('maria-idle-left', 0, CHAR_DIR_OFFSET.left, 6);

  make('maria-walk-down', 1, CHAR_DIR_OFFSET.down, 10);
  make('maria-walk-right', 1, CHAR_DIR_OFFSET.right, 10);
  make('maria-walk-up', 1, CHAR_DIR_OFFSET.up, 10);
  make('maria-walk-left', 1, CHAR_DIR_OFFSET.left, 10);

  // eslint-disable-next-line no-console
  console.log('[CharacterSetup] anims maria: idle/walk × 4 dirs creadas.');
}

/**
 * Setup completo idempotente: registra frames + crea animaciones. Pensado
 * para que cada scene que muestre a María lo invoque en create() y se
 * olvide. Llamarlo varias veces es seguro.
 */
export function setupMaria(scene: Phaser.Scene): void {
  registerCharacterFrames(scene, 'maria', 16, 32, 32);
  ensureMariaAnimations(scene);
}
