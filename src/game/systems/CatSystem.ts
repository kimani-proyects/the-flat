import * as Phaser from 'phaser';
import { Cat, CatId, CatConfig, CatState } from '../entities/Cat';
import { TILE_SIZE, FLOORPLAN, isWallTile } from '../data/floorplan';
import type { InteractionSystem } from './InteractionSystem';
import type { Interactable } from '../data/floorplan';
import {
  CAT_PERSONALITIES,
  pickDialog,
  pickStateFor,
  isFridayThe13th,
  isKero420,
  type PersonalityCtx,
} from './CatPersonalities';
import { showCatMenu, type CatMenuChoice } from './CatMenu';
import { canPlayMinigame, markMinigamePlayed, cooldownLabel } from './MinigameCooldown';
import { runWordleMinigame } from '../minigames/wordle/WordleMinigame';
import { runKeroShellMinigame } from '../minigames/keroshell/KeroShellMinigame';
import {
  runTinderCatMinigame,
  canPlayTinder,
  tinderCooldownLabel,
} from '../minigames/tindercat/TinderCatMinigame';
import { useProgressStore } from '@/lib/stores/gameStore';
import { giftForCat } from '../data/gifts';
import { Sfx } from './SfxBank';

/**
 * CatSystem — Día 9-pre v4 SIMPLIFICADO.
 *
 * Filosofía: vida libre y orgánica. Cada cierto tiempo, cada gato hace
 * tirada random ponderada según hora + personalidad. Sin anchors fijos
 * (ya no van "a la cocina a comer"). Sin intents complejos.
 *
 * States posibles que la FSM puede elegir:
 *   - idle (mira al vacío)
 *   - walk (camina random tile adyacente)
 *   - sprint (corre random)
 *   - sleep (se queda dormido donde estaba)
 *   - playful (juega donde está)
 *   - purr (sentado, sit-idle visual)
 *
 * Eat sólo se dispara desde menú "Alimentar" → setState('eat') N segs.
 *
 * Tendencias (todas sutiles):
 *   - Cada gato tiene `favoriteZone` opcional. Cuando elige walk, 30%
 *     chance de moverse hacia esa zona (greedy, no pathfinding).
 *   - Agruparse: 10% chance de que un gato camine hacia el más cercano.
 *
 * Mecánica attack: cada 8s, prob por gato (Nala > Kero > Haku) si hay
 * vecino adyacente.
 */

const CAT_CONFIGS: CatConfig[] = [
  {
    id: 'kero',
    label: 'Kero',
    bodyColor: 0xe79f47,
    shadeColor: 0x8a5a20,
    eyeColor: 0x1a0e08,
    spawnTile: { x: 19, y: 30 },
    spriteKey: 'kero',
  },
  {
    id: 'haku',
    label: 'Haku',
    bodyColor: 0xf5f0e6,
    shadeColor: 0xc8b9a0,
    eyeColor: 0x5eead4,
    spawnTile: { x: 19, y: 30 },
    spriteKey: 'haku',
  },
  {
    id: 'nala',
    label: 'Nala',
    bodyColor: 0x8e7c6f,
    shadeColor: 0x4a3d35,
    eyeColor: 0xfbbf24,
    spawnTile: { x: 19, y: 30 },
    spriteKey: 'nala',
  },
];

/** Zona favorita por gato (sesgo suave en walk). */
const FAVORITE_ZONES: Partial<Record<CatId, { x: number; y: number; name: string }>> = {
  kero: { x: 18, y: 5, name: 'cocina' },
  haku: { x: 38, y: 8, name: 'salón/librería' },
  nala: { x: 7, y: 26, name: 'hab. Alex' },
};

/**
 * Sleep anchor por gato: tile EXACTO donde duermen. Bien separados
 * dentro de la cama de María (Kero/Haku) o cama Alex (Nala) para que
 * no se solapen.
 */
const SLEEP_ANCHORS: Record<CatId, { x: number; y: number }> = {
  kero: { x: 44, y: 13 }, // cama María
  haku: { x: 45, y: 13 }, // adyacente a Kero (mismo y, 1 tile a la dcha) — alex pidió "al lado"
  nala: { x: 1, y: 29 }, // cama Alex
};
/** Si dist al anchor ≤ esto → ya está, hace sleep. 0 = exacto, 1 = adyacente. */
const SLEEP_ANCHOR_TOLERANCE = 0;
/**
 * Si el gato lleva más de SLEEP_INTENT_TIMEOUT_MS caminando hacia la
 * cama y no llega (pathfinding greedy se atascó), abandona el intent y
 * duerme donde esté.
 */
const SLEEP_INTENT_TIMEOUT_MS = 30_000;

const NAMETAG_PROXIMITY_PX = 24;
const TOTAL_UNLOCKABLE_ROOMS = 5;

const STATE_SPEED: Partial<Record<CatState, number>> = {
  walk: 0.4,
  sprint: 0.8,
};

/** Duración antes de re-elegir state. */
const STATE_DURATION_MS: Record<CatState, { min: number; max: number }> = {
  idle: { min: 3000, max: 7000 },
  walk: { min: 2500, max: 5000 },
  sprint: { min: 1000, max: 2500 },
  playful: { min: 3000, max: 6000 },
  eat: { min: 5000, max: 9000 },
  purr: { min: 4000, max: 9000 },
  sleep: { min: 30000, max: 90000 },
  'attack-l': { min: 600, max: 600 },
  'attack-r': { min: 600, max: 600 },
  'hurt-l': { min: 600, max: 600 },
  'hurt-r': { min: 600, max: 600 },
};

/**
 * Probabilidad POR CHEQUEO (cada 4s) de que un gato pegue a un vecino
 * adyacente. Subido respecto a v3 — antes era 6%/min, ahora 10%/check
 * para que se vea pelearse en sesiones cortas.
 */
const ATTACK_PROB_PER_CHECK: Record<CatId, number> = {
  nala: 0.1,
  kero: 0.06,
  haku: 0.02,
};
const ATTACK_CHECK_INTERVAL_MS = 4000;

/** Probabilidad walk-towards-favorite-zone. */
const FAVZONE_BIAS = 0.3;
/**
 * Huddle dinámico. La probabilidad de "ir a buscar a otro gato" sube
 * con `lonelinessMs` (ms acumulados sin ningún vecino a ≤NEARBY_TILES).
 *   prob = BASE + (loneliness/60s) * PER_MIN, capped a MAX.
 *
 * Resultado orgánico: tras varios minutos solos, los gatos tienden a
 * encontrarse. Si están en trío/pareja, loneliness=0 y prob se queda
 * en BASE (5%) — siguen su rollo independiente.
 */
const HUDDLE_BIAS_BASE = 0.05;
const HUDDLE_BIAS_PER_MIN = 0.25;
const HUDDLE_BIAS_MAX = 0.7;
const NEARBY_TILES_FOR_COMPANY = 4;

interface CatRuntime {
  cat: Cat;
  nextDecisionAtMs: number;
  oneShotUntilMs: number;
  manualLockUntilMs: number;
  lonelinessMs: number;
  sleepIntent: { x: number; y: number } | null;
  sleepIntentStartedAtMs: number;
  sleepPath: { x: number; y: number }[] | null;
  /**
   * Ms cuando el gato terminó de dormir la última vez. Bloquea volver a
   * sleep durante SLEEP_COOLDOWN_MS — fuerza otro state si el random
   * elige sleep dentro del cooldown.
   */
  lastSleepEndedAtMs: number;
}

/** Tiempo mínimo entre siestas (5 minutos). */
const SLEEP_COOLDOWN_MS = 5 * 60 * 1000;

export class CatSystem {
  private scene: Phaser.Scene;
  private interactionSystem: InteractionSystem;
  private player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  private cats: CatRuntime[] = [];
  private spawned = false;
  private cinematicActive = false;
  private menuOpen = false;
  private alexConnected = false;
  private nalaStareSinceMs: number | null = null;
  private lastPlayerPos: { x: number; y: number } = { x: 0, y: 0 };
  private nextAttackCheckMs = 0;
  onCinematicStart?: () => void;
  onCinematicEnd?: () => void;

  constructor(
    scene: Phaser.Scene,
    interactionSystem: InteractionSystem,
    player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle,
  ) {
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.player = player;
    this.registerInteractionHandler();
  }

  // ──────────────────────────────────────────────────────────────────────
  // INTERACT
  // ──────────────────────────────────────────────────────────────────────

  private registerInteractionHandler(): void {
    this.interactionSystem.register('cat', async (ctx) => {
      const id = ctx.interactable.id;
      const catId = id.replace(/^cat-/, '') as CatId;
      const rt = this.cats.find((c) => c.cat.config.id === catId);
      if (!rt) return;

      const cat = rt.cat;
      this.menuOpen = true;
      cat.setFrozen(true);
      // NO forzamos state — se queda en lo que estaba haciendo. Si
      // estaba walking, la animación seguirá como pausa visual; si
      // dormido, seguirá durmiendo. Más natural.

      const personality = CAT_PERSONALITIES[catId];
      const subtitle = stateLabel(cat.state);

      // Choices por gato (Día 9d):
      //   - Haku: 4 opciones (Hablar / Wordle / Preguntar regalos / Cerrar)
      //   - Kero: 3 opciones (Hablar / Trilero / Cerrar)
      //   - Nala: 3 opciones (Hablar / Tinder / Cerrar)
      // El menú "Darle algo" (gift) lo quitamos en favor de la app
      // "Regalos" del PC María (Día 10-11). Aquí dentro del menú gato
      // sólo dejamos lo que es interacción directa.
      const choices: { id: CatMenuChoice; label: string; enabled?: boolean; hint?: string }[] = [
        { id: 'talk', label: 'Hablar / acariciar', enabled: true },
      ];
      if (catId === 'haku') {
        const wordleKey = 'haku-wordle';
        const canPlay = canPlayMinigame(wordleKey);
        const cdLabel = cooldownLabel(wordleKey);
        choices.push({
          id: 'play',
          label: 'Jugar al Wordle',
          enabled: canPlay,
          hint: canPlay ? undefined : cdLabel ?? 'mañana otra palabra',
        });
        // Día 9d: opción única de Haku — "Preguntar" (sobre regalos).
        // Reusa el slot 'gift' que ahora significa "consulta a Haku".
        const totalGifts = useProgressStore.getState().unlockedGifts.length;
        choices.push({
          id: 'gift',
          label: 'Preguntar',
          enabled: true,
          hint: totalGifts + '/3 regalos',
        });
      } else if (catId === 'kero') {
        const keroKey = 'kero-search';
        const canPlay = canPlayMinigame(keroKey);
        const cdLabel = cooldownLabel(keroKey);
        choices.push({
          id: 'play',
          label: 'El trilero de Kero',
          enabled: canPlay,
          hint: canPlay ? undefined : cdLabel ?? 'volver mañana',
        });
      } else if (catId === 'nala') {
        // Tinder Cat con cooldown 3h.
        const canPlay = canPlayTinder();
        const cdLabel = tinderCooldownLabel();
        const totalMatches = useProgressStore.getState().tinderMatchedIds.length;
        choices.push({
          id: 'play',
          label: 'Tinder Cat',
          enabled: canPlay,
          hint: canPlay ? totalMatches + '/15 matches' : cdLabel ?? '3h cooldown',
        });
      }
      choices.push({ id: 'close', label: 'Cerrar', enabled: true });
      // "Alimentar" sigue como opción extra cuando hay anim eat — no
      // cuenta para el límite de 3-4 botones del menú principal porque
      // se inserta sólo si la anim existe.
      const eatKey = `${catId}-eat`;
      if (this.scene.anims.exists(eatKey)) {
        choices.splice(1, 0, { id: 'feed', label: 'Alimentar', enabled: true });
      }

      const choice = await showCatMenu(this.scene, {
        catLabel: cat.config.label,
        portraitKey: cat.config.id,
        subtitle,
        choices,
      });

      if (choice === 'talk') {
        const eggCtx = this.buildPersonalityCtx();
        let eggActive = personality.easterEggCheck ? personality.easterEggCheck(eggCtx) : false;
        if (catId === 'nala' && this.nalaStareSinceMs !== null) {
          const stare = this.scene.time.now - this.nalaStareSinceMs;
          if (stare >= 5000) eggActive = true;
        }
        const lines = pickDialog(personality, cat.state, eggActive, new Date().getHours());
        await ctx.showDialog(lines, {
          speaker: cat.config.label,
          portrait: cat.config.id,
        });
        if (catId === 'nala') this.nalaStareSinceMs = null;
      } else if (choice === 'feed') {
        await ctx.showDialog(
          [`*pones comida. ${cat.config.label} come.*`],
          { speaker: 'María', portrait: 'maria' },
        );
        // Limpia cualquier intent previo para que no quede colgando tras eat.
        rt.sleepIntent = null;
        rt.sleepPath = null;
        cat.setState('eat');
        cat.speedPxPerFrame = 0;
        const dur = STATE_DURATION_MS.eat;
        rt.manualLockUntilMs = this.scene.time.now + dur.min + Math.random() * (dur.max - dur.min);
      } else if (choice === 'play') {
        if (catId === 'haku') {
          // Wordle de Haku — modal popup en la propia ApartmentScene.
          const result = await runWordleMinigame({
            scene: this.scene,
            // Reusamos el shape de MinigameContext aunque no haya muro:
            // pasamos un room/label "ficticios" sólo para satisfacer el
            // contrato. Los minijuegos de cat NO desbloquean room, así
            // que estos campos no se consultan.
            room: 'habitacion-maria',
            roomLabel: 'Wordle de Haku',
          });
          // Cooldown 24h pase lo que pase (gana o pierda). Sólo si NO
          // fue aborted — permitir reabrir el menú sin penalizar.
          if (result.reason !== 'aborted') {
            markMinigamePlayed('haku-wordle');
          }
          if (result.success) {
            const giftId = giftForCat('haku').id; // 'cena'
            const alreadyHad = useProgressStore.getState().unlockedGifts.includes(giftId);
            if (!alreadyHad) {
              useProgressStore.getState().unlockGift(giftId);
              await ctx.showDialog(
                [
                  '"lo has clavado, María."',
                  '"toma. te lo tenía guardado."',
                  '*Haku te empuja con la cabeza un sobre.*',
                  '— [REGALO] CENA PARA DOS desbloqueada —',
                ],
                { speaker: cat.config.label, portrait: cat.config.id },
              );
            } else {
              await ctx.showDialog(
                ['"otra vez. eres rápida."', '*Haku ronronea.*'],
                { speaker: cat.config.label, portrait: cat.config.id },
              );
            }
          } else if (result.reason === 'aborted') {
            await ctx.showDialog(
              ['*Haku entorna los ojos.*', '"vuelve cuando tengas la cabeza."'],
              { speaker: cat.config.label, portrait: cat.config.id },
            );
          } else {
            await ctx.showDialog(
              ['"casi."', '"mañana hay otra palabra."'],
              { speaker: cat.config.label, portrait: cat.config.id },
            );
          }
        } else if (catId === 'kero') {
          // Trilero de Kero — shell game con ovillo bajo cojín.
          const result = await runKeroShellMinigame({
            scene: this.scene,
            room: 'cocina',
            roomLabel: 'El Trilero de Kero',
          });
          if (result.reason !== 'aborted') {
            markMinigamePlayed('kero-search');
          }
          if (result.success) {
            const giftId = giftForCat('kero').id; // 'misterioso'
            const alreadyHad = useProgressStore.getState().unlockedGifts.includes(giftId);
            if (!alreadyHad) {
              useProgressStore.getState().unlockGift(giftId);
              await ctx.showDialog(
                [
                  '*Kero aparece a tus pies.*',
                  '*lleva un sobre cerrado entre los dientes.*',
                  '*lo deja sobre la alfombra.*',
                  '— [REGALO] ??? desbloqueado —',
                ],
                { speaker: cat.config.label, portrait: cat.config.id },
              );
            } else {
              await ctx.showDialog(
                ['*Kero ronronea.*', '*ya sabe que sabes encontrarlo.*'],
                { speaker: cat.config.label, portrait: cat.config.id },
              );
            }
          } else if (result.reason === 'aborted') {
            await ctx.showDialog(
              ['*Kero parpadea.*', '*él sigue escondido.*'],
              { speaker: cat.config.label, portrait: cat.config.id },
            );
          } else {
            await ctx.showDialog(
              ['*Kero se relame.*', '*"casi". eso parece pensar.*'],
              { speaker: cat.config.label, portrait: cat.config.id },
            );
          }
        } else if (catId === 'nala') {
          // Tinder Cat v2 — meta acumulativa: 15 matches → unlock escapada.
          // El minijuego marca tinderLastSessionAtMs al empezar (cooldown 3h).
          // Cada match individual se persiste vía addTinderMatch.
          const result = await runTinderCatMinigame({
            scene: this.scene,
            room: 'habitacion-alex',
            roomLabel: 'Tinder Cat',
          });
          // Tras la sesión, comprobamos el total de matches.
          const total = useProgressStore.getState().tinderMatchedIds.length;
          const giftId = giftForCat('nala').id; // 'escapada'
          const alreadyHad = useProgressStore.getState().unlockedGifts.includes(giftId);
          if (total >= 15 && !alreadyHad) {
            useProgressStore.getState().unlockGift(giftId);
            await ctx.showDialog(
              [
                '*Nala te mira a los ojos.*',
                '"15 pretendientes. ahora elige tú."',
                '*Nala desliza un papel doblado sobre la alfombra.*',
                '— [REGALO] ESCAPADA DE FIN DE SEMANA desbloqueada —',
              ],
              { speaker: cat.config.label, portrait: cat.config.id },
            );
          } else if (result.reason === 'aborted') {
            await ctx.showDialog(
              ['*Nala bosteza.*', '"vuelve cuando tengas tiempo, María."'],
              { speaker: cat.config.label, portrait: cat.config.id },
            );
          } else if (alreadyHad) {
            await ctx.showDialog(
              ['*Nala ronronea.*', '"ya tienes tu regalo. pero seguimos."'],
              { speaker: cat.config.label, portrait: cat.config.id },
            );
          } else {
            await ctx.showDialog(
              [
                '*Nala mira la lista de matches.*',
                `"${total}/15. siguen faltando pretendientes."`,
              ],
              { speaker: cat.config.label, portrait: cat.config.id },
            );
          }
        } else {
          await ctx.showDialog(
            [`*${cat.config.label} te mira como diciendo "todavía no".*`],
            { speaker: cat.config.label, portrait: cat.config.id },
          );
        }
      } else if (choice === 'gift') {
        // Día 9d: el slot 'gift' ahora es "Preguntar" para Haku
        // (consultar progreso de regalos). Para Kero/Nala el slot
        // no se ofrece en el menú, pero por seguridad reusamos.
        if (catId === 'haku') {
          const unlocked = useProgressStore.getState().unlockedGifts;
          const total = 3;
          const remaining = total - unlocked.length;
          const lines: string[] = [];
          if (remaining === 0) {
            lines.push(
              '"todos."',
              '"los tres regalos. de los tres."',
              '*Haku parpadea despacio, satisfecha.*',
              '"ahora ve a canjearlos al PC, María."',
            );
          } else {
            lines.push('"déjame ver."');
            // Lista qué tiene y qué falta.
            const has = unlocked.length === 0 ? 'ninguno' : unlocked.join(', ');
            lines.push(`"tienes: ${has}."`);
            lines.push(
              `"faltan ${remaining} de ${total}."`,
              remaining === 1
                ? '"el último, María. el último."'
                : '"sigue jugando."',
            );
          }
          await ctx.showDialog(lines, {
            speaker: cat.config.label,
            portrait: cat.config.id,
          });
        } else {
          // Fallback (no debería ocurrir — el slot no se ofrece).
          await ctx.showDialog(
            ['*aún no tienes nada para darle.*'],
            { speaker: 'María', portrait: 'maria' },
          );
        }
      }

      cat.setFrozen(false);
      this.menuOpen = false;
      // Si NO está en lock manual (eat), forzar nueva decisión inmediata.
      if (this.scene.time.now >= rt.manualLockUntilMs) {
        rt.nextDecisionAtMs = this.scene.time.now;
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // SPAWN + CINEMÁTICA
  // ──────────────────────────────────────────────────────────────────────

  spawnIfReady(catsAlreadyShown: boolean, onComplete?: () => void): void {
    if (this.spawned) {
      onComplete?.();
      return;
    }
    if (catsAlreadyShown) {
      this.spawnDirect();
      onComplete?.();
      return;
    }
    void this.playEntranceCinematic(onComplete);
  }

  private spawnDirect(): void {
    if (this.spawned) return;
    this.spawned = true;
    const now = this.scene.time.now;
    for (const cfg of CAT_CONFIGS) {
      const cat = new Cat(this.scene, cfg);
      // Estado inicial WALK 30-60s para distribuirse por la casa antes de
      // que el FSM tome control. Evita el "todos a dormir nada más entrar".
      cat.setState('walk');
      cat.speedPxPerFrame = STATE_SPEED.walk ?? 0.4;
      const initialWanderTarget = this.adjacentWalkable(cat.tile);
      if (initialWanderTarget.length > 0) {
        cat.targetTile = initialWanderTarget[Math.floor(Math.random() * initialWanderTarget.length)];
      }
      this.cats.push({
        cat,
        nextDecisionAtMs: now + 30_000 + Math.random() * 30_000, // 30-60s walk inicial
        oneShotUntilMs: 0,
        manualLockUntilMs: 0,
        lonelinessMs: 0,
        sleepIntent: null,
        sleepIntentStartedAtMs: 0,
        sleepPath: null,
        // Marcamos lastSleepEndedAtMs=now para activar cooldown sleep
        // desde el inicio (evita ir directos a dormir).
        lastSleepEndedAtMs: now,
      });
      this.registerCatInteractable(cat);
    }
  }

  private async playEntranceCinematic(onComplete?: () => void): Promise<void> {
    if (this.spawned || this.cinematicActive) return;
    this.cinematicActive = true;
    this.spawned = true;
    this.onCinematicStart?.();

    const cam = this.scene.cameras.main;
    cam.fadeOut(220, 0, 0, 0);
    await this.wait(260);

    for (let i = 0; i < CAT_CONFIGS.length; i++) {
      const cfg = CAT_CONFIGS[i];
      const cat = new Cat(this.scene, cfg);
      this.cats.push({
        cat,
        nextDecisionAtMs: this.scene.time.now + 800,
        oneShotUntilMs: 0,
        manualLockUntilMs: 0,
        lonelinessMs: 0,
      });
      this.registerCatInteractable(cat);
      cat.setState('walk');
      cat.speedPxPerFrame = STATE_SPEED.walk ?? 0.4;
      const offsets = [
        { x: 0, y: -1 },
        { x: -1, y: -1 },
        { x: 1, y: -1 },
      ];
      const off = offsets[i] ?? offsets[0];
      const t = { x: cfg.spawnTile.x + off.x, y: cfg.spawnTile.y + off.y };
      cat.targetTile = this.isTileWalkable(t.x, t.y) ? t : { ...cfg.spawnTile };
    }

    cam.fadeIn(380, 0, 0, 0);
    await this.wait(800);
    this.scene.events.emit('cats:cinematic-line', {
      lines: [
        '¡han entrado tres gatos!',
        '*les sonríes.*',
        'menos mal que sois vosotros.',
      ],
    });

    await this.wait(2400);
    for (const rt of this.cats) rt.nextDecisionAtMs = this.scene.time.now;

    this.cinematicActive = false;
    this.onCinematicEnd?.();
    onComplete?.();
  }

  private wait(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.scene.time.delayedCall(ms, () => resolve());
    });
  }

  private registerCatInteractable(cat: Cat): void {
    const it: Interactable = {
      id: `cat-${cat.config.id}`,
      x: cat.tile.x,
      y: cat.tile.y,
      type: 'cat',
      room: 'entrada',
    };
    this.interactionSystem.addExtra(it, cat.config.label);
  }

  // ──────────────────────────────────────────────────────────────────────
  // FSM SIMPLIFICADA
  // ──────────────────────────────────────────────────────────────────────

  private buildPersonalityCtx(): PersonalityCtx {
    return {
      alexConnected: this.alexConnected,
      isFridayThe13th: isFridayThe13th(),
      isKero420: isKero420(),
    };
  }

  private decideState(rt: CatRuntime): void {
    if (rt.cat.isFrozen()) return;
    const hour = new Date().getHours();
    const ctx = this.buildPersonalityCtx();
    let newState = pickStateFor(rt.cat.config.id, hour, ctx) as CatState;

    // Cooldown de sleep — si está bloqueado, re-elegir sin sleep.
    const now = this.scene.time.now;
    if (
      newState === 'sleep' &&
      rt.lastSleepEndedAtMs > 0 &&
      now - rt.lastSleepEndedAtMs < SLEEP_COOLDOWN_MS
    ) {
      // Re-elegir hasta 5 veces excluyendo sleep. Fallback: walk.
      let retries = 0;
      while (newState === 'sleep' && retries < 5) {
        newState = pickStateFor(rt.cat.config.id, hour, ctx) as CatState;
        retries++;
      }
      if (newState === 'sleep') newState = 'walk';
    }

    // Si elige sleep y NO está cerca de su cama → walk hacia la cama.
    if (newState === 'sleep') {
      const anchor = SLEEP_ANCHORS[rt.cat.config.id];
      const at = rt.cat.tile;
      const dist = Math.abs(at.x - anchor.x) + Math.abs(at.y - anchor.y);
      if (dist > SLEEP_ANCHOR_TOLERANCE) {
        rt.sleepIntent = anchor;
        rt.sleepIntentStartedAtMs = this.scene.time.now;
        // Precalcular path BFS hacia la cama. Si no hay ruta, abandona.
        const path = this.findPath(at, anchor);
        if (!path || path.length === 0) {
          // Sin ruta posible (anchor inaccesible) — duerme aquí.
          rt.sleepIntent = null;
          rt.cat.setState('sleep');
          rt.cat.speedPxPerFrame = 0;
          const dur = STATE_DURATION_MS.sleep;
          rt.nextDecisionAtMs =
            this.scene.time.now + dur.min + Math.random() * (dur.max - dur.min);
          return;
        }
        rt.sleepPath = path;
        rt.cat.setState('walk');
        rt.cat.speedPxPerFrame = STATE_SPEED.walk ?? 0.4;
        rt.cat.targetTile = path[0]; // primer paso de la ruta
        rt.cat.lastWanderAtMs = this.scene.time.now;
        rt.nextDecisionAtMs = this.scene.time.now + 60_000;
        return;
      }
      // Ya está en la cama: dormir directamente.
    }

    rt.cat.setState(newState);
    rt.cat.speedPxPerFrame = STATE_SPEED[newState] ?? 0;
    if (newState === 'walk' || newState === 'sprint') {
      this.assignWanderTarget(rt);
    }
    const dur = STATE_DURATION_MS[newState];
    rt.nextDecisionAtMs = this.scene.time.now + dur.min + Math.random() * (dur.max - dur.min);
  }

  /** Asigna target adyacente que reduce distancia Manhattan al goal. */
  private assignAdjacentTowards(cat: Cat, goal: { x: number; y: number }): void {
    const at = cat.tile;
    const candidates = this.adjacentWalkable(at);
    if (candidates.length === 0) return;
    cat.targetTile = this.pickClosestTo(candidates, goal);
    cat.lastWanderAtMs = this.scene.time.now;
  }

  /**
   * BFS pathfinder simple. Devuelve la ruta de tiles desde `start`
   * (excluido) hasta `goal` (incluido). Si no hay ruta, devuelve null.
   * 4-conexión, evita muros.
   *
   * Para 48×32 = 1536 tiles, BFS termina en milisegundos.
   */
  private findPath(
    start: { x: number; y: number },
    goal: { x: number; y: number },
  ): { x: number; y: number }[] | null {
    if (start.x === goal.x && start.y === goal.y) return [];
    const key = (x: number, y: number) => `${x},${y}`;
    const visited = new Set<string>();
    const parent = new Map<string, { x: number; y: number }>();
    const queue: { x: number; y: number }[] = [start];
    visited.add(key(start.x, start.y));

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.x === goal.x && cur.y === goal.y) {
        // Reconstruir path.
        const path: { x: number; y: number }[] = [];
        let p: { x: number; y: number } | undefined = cur;
        while (p && (p.x !== start.x || p.y !== start.y)) {
          path.push(p);
          p = parent.get(key(p.x, p.y));
        }
        path.reverse();
        return path;
      }
      for (const n of [
        { x: cur.x + 1, y: cur.y },
        { x: cur.x - 1, y: cur.y },
        { x: cur.x, y: cur.y + 1 },
        { x: cur.x, y: cur.y - 1 },
      ]) {
        const k = key(n.x, n.y);
        if (visited.has(k)) continue;
        if (!this.isTileWalkable(n.x, n.y)) continue;
        visited.add(k);
        parent.set(k, cur);
        queue.push(n);
      }
    }
    return null;
  }

  /**
   * Asigna target adyacente. Sesgos (orden de evaluación):
   *   - huddleBias dinámico (5%-70% según loneliness): hacia otro gato.
   *   - 30%: hacia favoriteZone del gato.
   *   - resto: random adyacente walkable, manteniendo dirección 60%.
   *
   * El huddle se evalúa PRIMERO porque cuando un gato está muy solo,
   * es lo dominante; un gato acompañado vuelve al random + favoriteZone.
   */
  private assignWanderTarget(rt: CatRuntime): void {
    const cat = rt.cat;
    const at = cat.tile;
    const candidates = this.adjacentWalkable(at);
    if (candidates.length === 0) return;

    // Huddle bias dinámico.
    const huddleBias = Math.min(
      HUDDLE_BIAS_MAX,
      HUDDLE_BIAS_BASE + (rt.lonelinessMs / 60_000) * HUDDLE_BIAS_PER_MIN,
    );

    const r = Math.random();
    if (r < huddleBias) {
      const closest = this.findClosestOtherCat(rt);
      if (closest) {
        cat.targetTile = this.pickClosestTo(candidates, closest.cat.tile);
        cat.lastWanderAtMs = this.scene.time.now;
        return;
      }
    } else if (r < huddleBias + FAVZONE_BIAS) {
      const fav = FAVORITE_ZONES[cat.config.id];
      if (fav) {
        cat.targetTile = this.pickClosestTo(candidates, fav);
        cat.lastWanderAtMs = this.scene.time.now;
        return;
      }
    }
    // Random uniforme con sesgo a mantener dirección.
    const prev = cat.targetTile;
    const sameDir = candidates.find(
      (c) => c.x - at.x === prev.x - at.x && c.y - at.y === prev.y - at.y,
    );
    cat.targetTile =
      sameDir && Math.random() < 0.6
        ? sameDir
        : candidates[Math.floor(Math.random() * candidates.length)];
    cat.lastWanderAtMs = this.scene.time.now;
  }

  private adjacentWalkable(at: { x: number; y: number }): { x: number; y: number }[] {
    return [
      { x: at.x + 1, y: at.y },
      { x: at.x - 1, y: at.y },
      { x: at.x, y: at.y + 1 },
      { x: at.x, y: at.y - 1 },
    ].filter((c) => this.isTileWalkable(c.x, c.y));
  }

  private pickClosestTo(
    candidates: { x: number; y: number }[],
    goal: { x: number; y: number },
  ): { x: number; y: number } {
    return candidates.reduce((best, c) => {
      const db = Math.abs(best.x - goal.x) + Math.abs(best.y - goal.y);
      const dc = Math.abs(c.x - goal.x) + Math.abs(c.y - goal.y);
      return dc < db ? c : best;
    });
  }

  private findClosestOtherCat(rt: CatRuntime): CatRuntime | null {
    const at = rt.cat.tile;
    let best: CatRuntime | null = null;
    let bestDist = Infinity;
    for (const other of this.cats) {
      if (other === rt) continue;
      const ot = other.cat.tile;
      const d = Math.abs(at.x - ot.x) + Math.abs(at.y - ot.y);
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    }
    return best;
  }

  private isTileWalkable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= FLOORPLAN.mapWidth || y >= FLOORPLAN.mapHeight) {
      return false;
    }
    if (isWallTile(x, y)) return false;
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────
  // ATTACK
  // ──────────────────────────────────────────────────────────────────────

  private maybeTriggerAttacks(now: number): void {
    if (now < this.nextAttackCheckMs) return;
    this.nextAttackCheckMs = now + ATTACK_CHECK_INTERVAL_MS;

    for (let i = 0; i < this.cats.length; i++) {
      const a = this.cats[i];
      if (a.cat.isFrozen() || now < a.oneShotUntilMs) continue;
      // Gatos durmiendo no pegan.
      if (a.cat.state === 'sleep' || a.cat.state === 'eat') continue;
      const aProb = ATTACK_PROB_PER_CHECK[a.cat.config.id];
      if (Math.random() > aProb) continue;
      const aTile = a.cat.tile;
      for (let j = 0; j < this.cats.length; j++) {
        if (i === j) continue;
        const b = this.cats[j];
        if (b.cat.isFrozen() || now < b.oneShotUntilMs) continue;
        const bTile = b.cat.tile;
        const dx = bTile.x - aTile.x;
        const dy = bTile.y - aTile.y;
        if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
        this.executeAttack(a, b, dx);
        return;
      }
    }
  }

  private executeAttack(attacker: CatRuntime, victim: CatRuntime, dx: number): void {
    const attackDir = dx > 0 ? 'attack-r' : 'attack-l';
    const hurtDir = dx > 0 ? 'hurt-l' : 'hurt-r';
    const dur = 600;
    attacker.oneShotUntilMs = this.scene.time.now + dur + 200;
    victim.oneShotUntilMs = this.scene.time.now + dur + 200;
    attacker.cat.playOneShot(attackDir);
    victim.cat.playOneShot(hurtDir);
    this.spawnStars(victim.cat);
  }

  private spawnStars(cat: Cat): void {
    const px = cat.px;
    for (let i = 0; i < 4; i++) {
      const star = this.scene.add
        .text(
          px.x + (Math.random() - 0.5) * 8,
          px.y - 10 + (Math.random() - 0.5) * 4,
          '✦',
          {
            fontFamily: "'Silkscreen', monospace",
            fontSize: '8px',
            color: '#fbbf24',
          },
        )
        .setOrigin(0.5, 0.5)
        .setDepth(30);
      this.scene.tweens.add({
        targets: star,
        y: star.y - 8 - Math.random() * 6,
        x: star.x + (Math.random() - 0.5) * 12,
        alpha: 0,
        duration: 600 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────────────────

  /** Última vez que actualizamos lonelinessMs (para calcular delta). */
  private lastLonelinessTickMs = 0;

  update(): void {
    if (!this.spawned) return;
    const now = this.scene.time.now;

    // Tick de loneliness — cada gato sin vecino ≤NEARBY_TILES suma delta.
    if (this.lastLonelinessTickMs === 0) this.lastLonelinessTickMs = now;
    const lonelinessDelta = now - this.lastLonelinessTickMs;
    this.lastLonelinessTickMs = now;
    for (const rt of this.cats) {
      const at = rt.cat.tile;
      const hasCompany = this.cats.some((other) => {
        if (other === rt) return false;
        const ot = other.cat.tile;
        return Math.abs(at.x - ot.x) + Math.abs(at.y - ot.y) <= NEARBY_TILES_FOR_COMPANY;
      });
      rt.lonelinessMs = hasCompany ? 0 : rt.lonelinessMs + lonelinessDelta;
    }

    const playerX = (this.player as Phaser.GameObjects.Sprite).x;
    const playerY = (this.player as Phaser.GameObjects.Sprite).y;
    const playerMoved =
      Math.abs(playerX - this.lastPlayerPos.x) > 0.5 ||
      Math.abs(playerY - this.lastPlayerPos.y) > 0.5;
    this.lastPlayerPos = { x: playerX, y: playerY };
    const nalaRt = this.cats.find((c) => c.cat.config.id === 'nala');
    if (
      nalaRt &&
      nalaRt.cat.isNear(playerX, playerY, NAMETAG_PROXIMITY_PX) &&
      !playerMoved
    ) {
      if (this.nalaStareSinceMs === null) this.nalaStareSinceMs = now;
    } else {
      this.nalaStareSinceMs = null;
    }

    this.maybeTriggerAttacks(now);

    for (const rt of this.cats) {
      const cat = rt.cat;
      const inOneShot = now < rt.oneShotUntilMs;
      const inManualLock = now < rt.manualLockUntilMs;

      if (inOneShot) {
        // Animación attack/hurt en curso. Sin lógica.
      } else if (inManualLock) {
        // Eat manual en curso. Anim eat se reproduce sola, no movemos.
        // No hacemos nada. Cuando expire (siguiente frame con
        // !inManualLock), entra al else y haremos limpieza + decisión.
      } else {
        // Acabamos de salir de un manualLock?
        if (rt.manualLockUntilMs > 0) {
          rt.manualLockUntilMs = 0;
          rt.nextDecisionAtMs = now;
        }
        // Procesar sleep intent si activo (usa path BFS precalculado).
        // Si estaba durmiendo y va a expirar el state → marca cooldown.
        if (cat.state === 'sleep' && now >= rt.nextDecisionAtMs) {
          rt.lastSleepEndedAtMs = now;
        }
        if (rt.sleepIntent) {
          const at = cat.tile;
          const goal = rt.sleepIntent;
          const dist = Math.abs(at.x - goal.x) + Math.abs(at.y - goal.y);
          const elapsed = now - rt.sleepIntentStartedAtMs;
          if (dist <= SLEEP_ANCHOR_TOLERANCE) {
            cat.setState('sleep');
            cat.speedPxPerFrame = 0;
            rt.sleepIntent = null;
            rt.sleepPath = null;
            const dur = STATE_DURATION_MS.sleep;
            rt.nextDecisionAtMs = now + dur.min + Math.random() * (dur.max - dur.min);
          } else if (elapsed > SLEEP_INTENT_TIMEOUT_MS) {
            // eslint-disable-next-line no-console
            console.warn(`[CatSystem] ${cat.config.id} timeout sleep intent, duerme aquí.`);
            cat.setState('sleep');
            cat.speedPxPerFrame = 0;
            rt.sleepIntent = null;
            rt.sleepPath = null;
            const dur = STATE_DURATION_MS.sleep;
            rt.nextDecisionAtMs = now + dur.min + Math.random() * (dur.max - dur.min);
          } else if (cat.hasReachedTarget()) {
            // Llegó al tile actual de la ruta — pop el siguiente.
            if (rt.sleepPath && rt.sleepPath.length > 0) {
              // El primer elem de la ruta debería coincidir con cat.tile.
              // Saltamos al siguiente.
              rt.sleepPath.shift();
              if (rt.sleepPath.length > 0) {
                cat.targetTile = rt.sleepPath[0];
                cat.lastWanderAtMs = now;
              } else {
                // Ruta agotada. Forzar sleep en el siguiente tick.
                cat.setState('sleep');
                cat.speedPxPerFrame = 0;
                rt.sleepIntent = null;
                rt.sleepPath = null;
                const dur = STATE_DURATION_MS.sleep;
                rt.nextDecisionAtMs = now + dur.min + Math.random() * (dur.max - dur.min);
              }
            } else {
              // No hay path (algo raro) — recalcula greedy para no atascarse.
              this.assignAdjacentTowards(cat, goal);
            }
          }
          cat.step();
        } else {
          // FSM normal.
          if (!cat.isFrozen() && now >= rt.nextDecisionAtMs) {
            this.decideState(rt);
          }
          if (
            !cat.isFrozen() &&
            (cat.state === 'walk' || cat.state === 'sprint') &&
            cat.hasReachedTarget()
          ) {
            this.assignWanderTarget(rt);
          }
          cat.step();
        }
      }

      this.interactionSystem.updateExtraPosition?.(`cat-${cat.config.id}`, cat.tile.x, cat.tile.y);
      cat.setNameTagVisible(cat.isNear(playerX, playerY, NAMETAG_PROXIMITY_PX));
    }
  }

  isCinematicActive(): boolean {
    return this.cinematicActive;
  }
  isMenuOpen(): boolean {
    return this.menuOpen;
  }
  hasSpawned(): boolean {
    return this.spawned;
  }

  setAlexConnected(connected: boolean): void {
    if (this.alexConnected === connected) return;
    this.alexConnected = connected;
    for (const rt of this.cats) rt.nextDecisionAtMs = this.scene.time.now;
  }

  destroy(): void {
    for (const rt of this.cats) {
      this.interactionSystem.removeExtra(`cat-${rt.cat.config.id}`);
      rt.cat.destroy();
    }
    this.cats = [];
    this.spawned = false;
  }

  static allRoomsUnlocked(unlockedRooms: string[]): boolean {
    return unlockedRooms.length >= TOTAL_UNLOCKABLE_ROOMS;
  }
}

function stateLabel(state: CatState): string {
  const labels: Record<CatState, string> = {
    idle: 'mirando al vacío',
    walk: 'paseando',
    sprint: 'corriendo',
    playful: 'jugando',
    eat: 'comiendo',
    purr: 'ronroneando',
    sleep: 'durmiendo',
    'attack-l': 'pegando',
    'attack-r': 'pegando',
    'hurt-l': 'magullado',
    'hurt-r': 'magullado',
  };
  return labels[state] ?? '';
}
