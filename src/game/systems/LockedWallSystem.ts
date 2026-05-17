import * as Phaser from 'phaser';
import { TILE_SIZE } from '../data/floorplan';
import type { Interactable } from '../data/floorplan';
import { useProgressStore } from '@/lib/stores/gameStore';
import type { UnlockableRoom } from '@/lib/stores/gameStore';
import type { InteractionSystem } from './InteractionSystem';
import type { LockedWallDef } from '../minigames/types';
import { Sfx } from './SfxBank';

/**
 * LockedWallSystem — Día 7.5.
 *
 * Renderiza muros bloqueantes encima de las puertas/aperturas de las
 * habitaciones que aún no están desbloqueadas. Cada muro:
 *
 *   1) Pinta tiles "barricada" (rect con patrón de tablas + tinte) sobre
 *      las casillas que constituyen la entrada a la habitación.
 *   2) Añade colliders estáticos para que la jugadora no pueda pasar.
 *   3) Inserta un "interactable virtual" (tipo wall-locked) en
 *      InteractionSystem para que aparezca el prompt E al acercarse.
 *   4) Cuando el jugador pulsa E, se lanza el minijuego asociado vía un
 *      handler único registrado para wall-locked. El handler resuelve qué
 *      muro está activo leyendo interactable.id ('wall-bano', 'wall-cocina',
 *      etc.) y dispara el runner correspondiente.
 *   5) Si el minijuego se resuelve con success=true:
 *        - useProgressStore.unlockRoom(room) → persiste en localStorage.
 *        - Animación de derrumbe (shake + crumble + dust).
 *        - Quita colliders, gráficos y el interactable virtual.
 *        - Diálogo final ("ya está, dentro").
 *
 * Lectura de estado: en init() consulta useProgressStore().unlockedRooms y
 * SOLO crea muros para los que aún no están desbloqueados. Si la jugadora
 * vuelve al piso desde el Hub habiendo desbloqueado una habitación, ese
 * muro ya no se monta.
 */

const WALL_DEPTH = 11; // por debajo del player (22) y por encima de doors (11). Igual que doors.
const WALL_LABEL_DEPTH = 12;

type ActiveWall = {
  def: LockedWallDef;
  interactableId: string;
  // Game objects que componen el muro (para destruir al desbloquear).
  graphics: Phaser.GameObjects.Graphics[];
  signBg: Phaser.GameObjects.Rectangle;
  signText: Phaser.GameObjects.Text;
  signIcon: Phaser.GameObjects.Text;
  colliders: Phaser.GameObjects.Rectangle[];
  staticGroup: Phaser.Physics.Arcade.StaticGroup;
  /**
   * Referencia al Collider entre player y staticGroup. CRÍTICO destruirlo
   * ANTES de destruir el staticGroup — si no, el siguiente tick del world
   * crashea con "Cannot read properties of undefined (reading 'size')"
   * porque Collider.update intenta llamar a staticGroup.getLength() sobre
   * un grupo cuyo set interno (children) ya no existe.
   */
  playerCollider: Phaser.Physics.Arcade.Collider;
};

export class LockedWallSystem {
  private scene: Phaser.Scene;
  private interactionSystem: InteractionSystem;
  private player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  private defs: LockedWallDef[];
  private active: Map<string, ActiveWall> = new Map();

  constructor(
    scene: Phaser.Scene,
    interactionSystem: InteractionSystem,
    player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle,
    defs: LockedWallDef[],
  ) {
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.player = player;
    this.defs = defs;
  }

  /**
   * Construye los muros para todas las habitaciones aún bloqueadas y
   * registra el handler único de wall-locked en InteractionSystem.
   *
   * Llamar después de que el InteractionSystem ya tenga registrados los
   * handlers estáticos (no pisamos nada porque wall-locked es un type
   * propio que NO usan los handlers del floorplan).
   */
  build(): void {
    const unlocked = useProgressStore.getState().unlockedRooms;

    // Handler único para todos los muros. El id del interactable nos dice
    // qué def aplicar.
    this.interactionSystem.register('wall-locked', async (ctx) => {
      const id = ctx.interactable.id;
      const wall = this.active.get(id);
      if (!wall) {
        // eslint-disable-next-line no-console
        console.warn(`[LockedWallSystem] No active wall para id=${id}`);
        return;
      }
      // eslint-disable-next-line no-console
      console.log(`[LockedWallSystem] Lanzando minijuego para ${wall.def.room}`);
      const result = await wall.def.run({
        scene: this.scene,
        room: wall.def.room,
        roomLabel: wall.def.label,
      });

      if (result.success) {
        // eslint-disable-next-line no-console
        console.log(`[LockedWallSystem] ✓ ${wall.def.room} desbloqueada.`);
        useProgressStore.getState().unlockRoom(wall.def.room);
        await this.crumbleWall(wall);
        // Día 8: notificar a la escena para que chequee si era el 5º
        // muro y dispare la cinemática de los gatos en runtime.
        Sfx.unlock();
        this.scene.events.emit('wall:unlocked', { room: wall.def.room });
        await ctx.showDialog(
          [wall.def.label + ' — desbloqueada.', 'Adentro.'],
          { speaker: 'María', portrait: 'maria' },
        );
      } else {
        // Diálogo corto de fallo. No es trágico — vuelves a intentarlo cuando quieras.
        await ctx.showDialog(
          ['No esta vez.', 'Inténtalo de nuevo cuando quieras.'],
          { speaker: 'María', portrait: 'maria' },
        );
      }
    });

    for (const def of this.defs) {
      if (unlocked.includes(def.room)) continue;
      this.spawnWall(def);
    }
  }

  /**
   * Crea visuales + colliders + interactable virtual para un muro.
   */
  private spawnWall(def: LockedWallDef): void {
    const id = `wall-${def.room}`;

    // 1) Visual del muro: por cada tile pintamos un rect con tinte +
    //    "tablas" diagonales. Estilo barricada cutre.
    const graphics: Phaser.GameObjects.Graphics[] = [];
    for (const t of def.wallTiles) {
      const px = t.x * TILE_SIZE;
      const py = t.y * TILE_SIZE;
      const g = this.scene.add.graphics();
      g.setDepth(WALL_DEPTH);

      // Fondo: madera oscura tintada con el color de la habitación.
      g.fillStyle(0x3a2618, 1); // marrón oscuro base
      g.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      // Capa de tinte de la habitación (alpha bajo).
      g.fillStyle(def.tint, 0.25);
      g.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      // Tablas horizontales (3 líneas a 1/3 y 2/3 + borde).
      g.lineStyle(1, 0x1a0e08, 1);
      g.lineBetween(px, py + 5, px + TILE_SIZE, py + 5);
      g.lineBetween(px, py + 11, px + TILE_SIZE, py + 11);

      // Clavos (4 puntitos).
      g.fillStyle(0xc09060, 1);
      g.fillRect(px + 2, py + 2, 1, 1);
      g.fillRect(px + TILE_SIZE - 3, py + 2, 1, 1);
      g.fillRect(px + 2, py + TILE_SIZE - 3, 1, 1);
      g.fillRect(px + TILE_SIZE - 3, py + TILE_SIZE - 3, 1, 1);

      // Borde más oscuro para definir el tile.
      g.lineStyle(1, 0x0a0604, 1);
      g.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

      graphics.push(g);
    }

    // 2) Cartel sobre el muro con el nombre de la habitación (estilo "cutre consciente").
    const cx = (def.promptAt.x + 0.5) * TILE_SIZE;
    const cy = (def.promptAt.y + 0.5) * TILE_SIZE - TILE_SIZE - 6; // por encima del muro
    const signBg = this.scene.add
      .rectangle(cx, cy, def.signText.length * 5 + 10, 11, 0xfbbf24, 1)
      .setStrokeStyle(1, 0x1a0e08, 1)
      .setDepth(WALL_LABEL_DEPTH);
    const signText = this.scene.add
      .text(cx, cy, def.signText, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#1a0e08',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(WALL_LABEL_DEPTH + 1);
    // Iconito candado a la izquierda del cartel para reforzar lectura.
    const signIcon = this.scene.add
      .text(cx - signBg.width / 2 + 4, cy - 1, '\u26BF', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#1a0e08',
      })
      .setOrigin(0, 0.5)
      .setDepth(WALL_LABEL_DEPTH + 2)
      .setVisible(false); // el cartel ya es claro; el icono lo deja recargado, lo dejo opcional.

    // 3) Colliders estáticos por cada tile.
    const staticGroup = this.scene.physics.add.staticGroup();
    const colliders: Phaser.GameObjects.Rectangle[] = [];
    for (const t of def.wallTiles) {
      const px = t.x * TILE_SIZE + TILE_SIZE / 2;
      const py = t.y * TILE_SIZE + TILE_SIZE / 2;
      const rect = this.scene.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, 0x000000, 0);
      this.scene.physics.add.existing(rect, true);
      staticGroup.add(rect);
      colliders.push(rect);
    }
    const playerCollider = this.scene.physics.add.collider(this.player, staticGroup);

    // 4) Interactable virtual para que aparezca el prompt E al acercarse.
    const it: Interactable = {
      id,
      x: def.promptAt.x,
      y: def.promptAt.y,
      type: 'wall-locked',
      room: def.room,
    };
    this.interactionSystem.addExtra(it, def.label);

    this.active.set(id, {
      def,
      interactableId: id,
      graphics,
      signBg,
      signText,
      signIcon,
      colliders,
      staticGroup,
      playerCollider,
    });
  }

  /**
   * Animación de derrumbe + cleanup. Devuelve una promesa que resuelve
   * cuando el muro ha desaparecido para encadenar con el diálogo de salida.
   *
   * Anim: shake de los gráficos (200 ms) + tween a alpha 0 + escala vertical
   *       a 0 (el muro "se hunde") + cleanup. Total ~700 ms.
   */
  private crumbleWall(wall: ActiveWall): Promise<void> {
    return new Promise<void>((resolve) => {
      // Quita colliders YA para que la jugadora pueda pasar antes de que
      // termine la animación si quiere — feedback inmediato de éxito.
      // ORDEN IMPORTA: primero destruimos el Collider (relación
      // player↔staticGroup), luego desactivamos los bodies y, al final del
      // tween, destruimos el staticGroup. Si destruimos el grupo sin matar
      // antes el Collider, el siguiente tick crashea.
      wall.playerCollider.destroy();
      for (const c of wall.colliders) {
        this.scene.physics.world.disable(c);
      }
      this.interactionSystem.removeExtra(wall.interactableId);

      // Cartel parpadea brevemente y desaparece.
      this.scene.tweens.add({
        targets: [wall.signBg, wall.signText, wall.signIcon],
        alpha: 0,
        duration: 250,
      });

      // Shake horizontal de los gráficos del muro.
      const shakeTargets = wall.graphics;
      let shakeT = 0;
      const shakeTimer = this.scene.time.addEvent({
        delay: 30,
        repeat: 6,
        callback: () => {
          shakeT++;
          const dx = shakeT % 2 === 0 ? 1 : -1;
          for (const g of shakeTargets) g.x = dx;
        },
      });

      // Tras el shake, fade + escala vertical → 0 (cae hacia abajo).
      this.scene.time.delayedCall(220, () => {
        shakeTimer.remove();
        for (const g of shakeTargets) g.x = 0;

        this.scene.tweens.add({
          targets: shakeTargets,
          alpha: 0,
          scaleY: 0.05,
          duration: 450,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            for (const g of shakeTargets) g.destroy();
            wall.signBg.destroy();
            wall.signText.destroy();
            wall.signIcon.destroy();
            for (const c of wall.colliders) c.destroy();
            wall.staticGroup.destroy(true);
            this.active.delete(wall.interactableId);
            resolve();
          },
        });

        // Particulitas de polvo (8 puntos cayendo).
        for (let i = 0; i < 8; i++) {
          const wx = wall.def.wallTiles[Math.floor(Math.random() * wall.def.wallTiles.length)];
          const px = wx.x * TILE_SIZE + Math.random() * TILE_SIZE;
          const py = wx.y * TILE_SIZE + Math.random() * TILE_SIZE;
          const dust = this.scene.add
            .rectangle(px, py, 2, 2, 0x9c8060, 0.9)
            .setDepth(WALL_DEPTH + 1);
          this.scene.tweens.add({
            targets: dust,
            y: py + 12 + Math.random() * 6,
            alpha: 0,
            duration: 600 + Math.random() * 200,
            ease: 'Quad.easeIn',
            onComplete: () => dust.destroy(),
          });
        }
      });
    });
  }
}
