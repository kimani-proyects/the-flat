import * as Phaser from 'phaser';
import type { UnlockableRoom } from '@/lib/stores/gameStore';

/**
 * Tipos compartidos por todos los minijuegos de Día 7.5.
 *
 * Filosofía: cada minijuego es una FUNCIÓN ASYNC que:
 *   1) Recibe la escena padre (ApartmentScene típicamente).
 *   2) Construye su UI (popup o overlay diegético) sobre esa misma escena.
 *      No abrimos sub-escenas Phaser separadas para evitar el coste de
 *      crear/destruir contextos físicos y para mantener al jugador "en el
 *      mundo" (la escena se pausa parcialmente vía interactionSystem busy).
 *   3) Resuelve un MinigameResult cuando el jugador termina (gana o sale).
 *
 * Quien lo invoca (LockedWallSystem) se encarga de:
 *   - Setear interactionSystem.busy = true antes (la jugadora se congela).
 *   - Limpiar busy = false después.
 *   - Si success: llamar a useProgressStore.unlockRoom(room) y disparar
 *     animación de derrumbe del muro.
 *
 * Esta separación permite reutilizar los minijuegos en otros contextos
 * (p.ej. el mismo lockpicking podría usarse en la caja fuerte de la
 * habitación secreta más adelante) sin acoplarlos al sistema de muros.
 */

export interface MinigameContext {
  /** Escena padre (ApartmentScene). Los popups se montan aquí. */
  scene: Phaser.Scene;
  /** Habitación cuyo muro se está intentando romper. Para context/labels. */
  room: UnlockableRoom;
  /** Etiqueta humana ("Habitación de María", "Baño", ...). */
  roomLabel: string;
}

export interface MinigameResult {
  /** True si la jugadora completó con éxito el minijuego. */
  success: boolean;
  /** Opcional: razón si abortó (ESC, fallo definitivo, etc.). */
  reason?: 'completed' | 'aborted' | 'failed';
}

/**
 * Contrato de un minijuego. Una función async pura.
 * Implementaciones:
 *   - chocolate/ChocolateMinigame.ts
 *   - knock/KnockMinigame.ts
 *   - rps/RpsMinigame.ts
 *   - lockpick/LockpickMinigame.ts
 *   - stuckdoor/StuckDoorMinigame.ts
 */
export type MinigameRunner = (ctx: MinigameContext) => Promise<MinigameResult>;

/**
 * Definición de un muro bloqueante: qué tiles ocupa el muro físico, qué
 * minijuego lanza, dónde se posiciona el "interactable virtual" para que
 * el InteractionSystem detecte proximidad. Una entrada por habitación.
 */
export interface LockedWallDef {
  /** Habitación a desbloquear. */
  room: UnlockableRoom;
  /** Etiqueta humana mostrada en el prompt y en el cartel del muro. */
  label: string;
  /** Tiles que el muro ocupa físicamente (rect en el mapa). Se renderizan + collider. */
  wallTiles: { x: number; y: number }[];
  /**
   * Posición del interactable virtual (en tiles). Donde el jugador tiene
   * que estar cerca para que aparezca el prompt "E muro X".
   * Normalmente = centro del muro.
   */
  promptAt: { x: number; y: number };
  /** Función que ejecuta el minijuego cuando el jugador pulsa E. */
  run: MinigameRunner;
  /** Color de tinte del muro (ambient mood por habitación). */
  tint: number;
  /** Texto corto que aparece en el cartel sobre el muro ("BAÑO", "COCINA", etc.). */
  signText: string;
}
