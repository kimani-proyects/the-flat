import * as Phaser from 'phaser';
import type { MinigameContext, MinigameResult, MinigameRunner } from '../types';
import { showMinigameIntro } from '../_shared/MinigameIntroPanel';
import { Sfx } from '../../systems/SfxBank';

/**
 * PIEDRA · PAPEL · TIJERA TRUCADO — Hab. de Alex.  REWORK v4 (mente).
 *
 * Cambios respecto a v3:
 *   - Fix bug "gana el perdedor": v3 comparaba mariaWon = BEATS[mariaMove]===scriptMove,
 *     pero BEATS[X] significa "lo que VENCE A X". El check correcto es
 *     mariaMove === BEATS[scriptMove] — María necesita la jugada que
 *     vence a la del script. Ahora correcto.
 *   - Quitada la mecánica "Alex te dice qué saca". Sustituida por
 *     "ENTRAR EN LA MENTE", que es lo que María quiere (tema concept de
 *     juego).
 *
 * NUEVA MECÁNICA — ENTRAR EN LA MENTE:
 *
 *   1) Para CERRAR el set, María necesita 3 victorias Y 2 EMPATES.
 *
 *   2) Para empatar adrede, María debe LEER las pistas SUTILES de Alex
 *      (no obvias) y elegir LO MISMO que Alex sacará. Para ganar →
 *      elegir lo que VENCE a la jugada de Alex.
 *
 *   3) Si María llega a 2 victorias y va a por la 3ª SIN haber empatado
 *      2 veces aún → ALEX ENTRA EN SU MENTE:
 *        - Cuadro Alex: "Hah, acabo de entrar en tu mente 🧠"
 *        - Esa ronda Alex elige el COUNTER de la jugada de María (siempre
 *          gana). La victoria de María se convierte en derrota.
 *        - alexInMind se ACTIVA y queda perpetuo: cada vez que María
 *          intente cerrar el set sin tener los 2 empates, Alex le roba.
 *        - María sigue pudiendo empatar. Cuando consiga sus 2 empates
 *          la mecánica se invierte (ver punto 4).
 *
 *   4) Cuando María consigue su 2º empate → MARÍA ENTRA EN SU MENTE:
 *        - Cuadro María: "Gracias Alex, ahora estoy en tu mente."
 *        - mariaMindActive = true. A partir de aquí, en CADA fase pick
 *          aparece un HALO VERDE sobre la opción correcta (la que vence
 *          a Alex) y HALOS ROJOS sobre las otras dos.
 *        - María sigue eligiendo manualmente (puede equivocarse o hacer
 *          timeout y perder), pero con los halos no necesita memorizar.
 *        - Si Alex tenía el "autowin" activo y María entra en mente, se
 *          DESACTIVA el autowin de Alex — el juego vuelve a ser justo,
 *          ahora ventaja para María.
 *
 *   5) Alex gana sin "entrar en mente" si María falla un pick (timeout).
 *      Sólo activa la mecánica si María iba a CERRAR el set sin tener
 *      los empates.
 *
 * PISTAS SUTILES (no decir literalmente "voy con piedra"):
 *   - PIEDRA: "esto va lento", "como una roca", "hoy estoy ROCKED",
 *             "no me muevo", "duro este round"
 *   - PAPEL: "blanco como mi cabeza ahora", "ligero, ligero",
 *            "hoy va de fino", "me siento liso", "ssssh ssssh"
 *   - TIJERA: "este round corto", "afilado el día", "ssssss",
 *             "click click", "voy con dos puntas"
 *
 * HINTS ENTRE SETS PERDIDOS (escalan):
 *   1) silencio (intento 1)
 *   2) "ay María, no me lees tan bien, ¿no?"
 *   3) "tienes que pillarme el ritmo, no sólo ganarme"
 *   4) "necesito que conectes conmigo... empata, María, empata."
 *   5) 4ª pared con la pista directa
 *
 * ESC para abortar.
 */

type Move = 'piedra' | 'papel' | 'tijera';
const MOVES: Move[] = ['piedra', 'papel', 'tijera'];

/** BEATS[X] = "qué jugada VENCE a X". papel vence a piedra → BEATS.piedra='papel'. */
const BEATS: Record<Move, Move> = {
  piedra: 'papel',
  papel: 'tijera',
  tijera: 'piedra',
};

const ICON: Record<Move, string> = {
  piedra: '✊',
  papel: '✋',
  tijera: '✌',
};

const ALEX_LINES: Record<Move, string[]> = {
  piedra: [
    '"qué pereza tengo hoy"',
    '"voy con peso, María"',
    '"hoy estoy ROCKED del todo"',
    '"como la calzada"',
    '"estatua mode, no me muevo"',
    '"voy duro, no aprietes"',
    '"hoy granito"',
  ],
  papel: [
    '"voy fino, ¿eh?"',
    '"cero gramos hoy"',
    '"soy un origami andante"',
    '"blanco impoluto"',
    '"envuelvo, no taladro"',
    '"hoja al viento, María"',
    '"hoy plano, plano"',
  ],
  tijera: [
    '"snip snip"',
    '"voy a recortar"',
    '"doble filo, ojo"',
    '"afila los oídos"',
    '"metalero hoy"',
    '"te corto al tres"',
    '"ssssss, María, sssss"',
  ],
};

const ALEX_SET_HINTS: string[] = [
  '',
  '"ay María, no me lees tan bien, ¿no?"',
  '"tienes que pillarme el ritmo. ganarme no basta."',
  '"necesito que conectes conmigo. el truco no es lo que piensas."',
  '"María, vas demasiado a saco. ¿no notas nada?\n' +
    'a veces no hay que ganar la ronda. a veces hay que IGUALARLA.\n' +
    'pruébalo."',
  '"María. Para. Si tu objetivo es sólo ganar rondas, NUNCA cierras esto.\n' +
    'Tienes que IGUALARME varias veces antes. Léeme bien y saca lo MISMO\n' +
    'que yo. Cuando estés en mi cabeza, podrás cerrarme. Te quiero."',
];

const PANEL_DEPTH = 2000;
const ALEX_LINE_TIME_MS = 1700;
const COUNTDOWN_STEP_MS = 480;
const PICK_TIME_MS = 3500;
const CLASH_TIME_MS = 1400;
const MIND_DIALOG_MS = 2200;

/**
 * Empates necesarios para "entrar en la mente de Alex". Mecánica oculta —
 * NO se muestra en UI. La jugadora debe descubrirla sola o por los hints
 * escalados de Alex tras perder sets enteros.
 */
const TIES_NEEDED = 3;

/**
 * Contador de intentos PERSISTIDO entre instancias del minijuego (it.6).
 * Antes vivía en `RpsGame.setAttempt` y se reseteaba cada vez que María
 * volvía a interactuar con la pared. Eso impedía que los hints de Alex
 * escalaran realmente (siempre arrancabas en intento 1).
 *
 * Vive en el módulo → persiste durante la sesión del navegador, se resetea
 * al recargar (lo cual es razonable: si pasa un día y vuelves, ves el
 * hint suave para refrescar memoria muscular del truco).
 */
let persistentSetAttempt = 1;

type Phase = 'alexLine' | 'countdown' | 'pick' | 'clash' | 'mindDialog' | 'done';

export const runRpsMinigame: MinigameRunner = (ctx: MinigameContext) => {
  return new Promise<MinigameResult>(async (resolve) => {
    const ok = await showMinigameIntro(ctx.scene, {
      title: 'PIEDRA · PAPEL · TIJERA',
      description:
        'Es un piedra papel o tijeras.\nVence a Alex para abrir esta puerta.',
      controls: '1 = piedra · 2 = papel · 3 = tijera · ESC para salir',
    });
    if (!ok) return resolve({ success: false, reason: 'aborted' });
    new RpsGame(ctx, resolve).start();
  });
};

class RpsGame {
  private ctx: MinigameContext;
  private resolveOuter: (r: MinigameResult) => void;

  // Marcador.
  private mariaWins = 0;
  private scriptWins = 0;
  private mariaTies = 0;
  // Lee de persistentSetAttempt al construir — escalado de hints
  // sobrevive entre intentos del minijuego.
  private setAttempt = persistentSetAttempt;

  // Estados de "mente".
  private mariaMindActive = false; // María consiguió 2 empates → halos
  private alexMindEverTriggered = false; // narrativo (para variar diálogo en repeticiones)

  private phase: Phase = 'alexLine';
  private finished = false;
  private currentScriptMove: Move = 'piedra';
  private countdownStep = 0;
  private phaseTimer?: Phaser.Time.TimerEvent;
  private pickStartedAt = 0;

  // Input.
  private keyEsc?: Phaser.Input.Keyboard.Key;
  private key1?: Phaser.Input.Keyboard.Key;
  private key2?: Phaser.Input.Keyboard.Key;
  private key3?: Phaser.Input.Keyboard.Key;

  // Visuales fijos.
  private dim!: Phaser.GameObjects.Rectangle;
  private panelBg!: Phaser.GameObjects.Rectangle;
  private panelBorder!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private mindBadge!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private alexLineText!: Phaser.GameObjects.Text;
  private centerText!: Phaser.GameObjects.Text;
  private timeBarBg!: Phaser.GameObjects.Rectangle;
  private timeBarFg!: Phaser.GameObjects.Rectangle;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private optionLabels: Phaser.GameObjects.Text[] = [];
  private optionHalos: Phaser.GameObjects.Arc[] = [];
  private setHintText!: Phaser.GameObjects.Text;

  // Visuales temporales (clash + diálogos mente).
  private clashObjects: Phaser.GameObjects.GameObject[] = [];
  private mindDialogObjects: Phaser.GameObjects.GameObject[] = [];

  private cx = 0;
  private cy = 0;

  private onUpdate?: (time: number, delta: number) => void;

  constructor(ctx: MinigameContext, resolve: (r: MinigameResult) => void) {
    this.ctx = ctx;
    this.resolveOuter = resolve;
  }

  start(): void {
    this.buildUi();
    this.bindInput();
    this.refreshScore();
    this.startAlexLine();
    this.onUpdate = (time, _delta) => this.tick(time);
    this.ctx.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
  }

  // ──────────────────────────────────────────────────────────────────────
  // UI
  // ──────────────────────────────────────────────────────────────────────

  private buildUi(): void {
    const cam = this.ctx.scene.cameras.main;
    const PW = 290;
    const PH = 200;
    this.cx = cam.width / 2;
    this.cy = cam.height / 2;

    this.dim = this.ctx.scene.add
      .rectangle(this.cx, this.cy, cam.width, cam.height, 0x000000, 0.7)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH);

    this.panelBorder = this.ctx.scene.add
      .rectangle(this.cx, this.cy, PW + 4, PH + 4, 0xfbbf24, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.panelBg = this.ctx.scene.add
      .rectangle(this.cx, this.cy, PW, PH, 0x1a0e08, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 2);

    this.titleText = this.ctx.scene.add
      .text(this.cx, this.cy - PH / 2 + 10, 'PIEDRA · PAPEL · TIJERA', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '9px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.scoreText = this.ctx.scene.add
      .text(this.cx, this.cy - PH / 2 + 22, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#c08a4f',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Badge "🧠 mente activa" para María cuando consigue los empates.
    this.mindBadge = this.ctx.scene.add
      .text(this.cx, this.cy - PH / 2 + 33, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#4ade80',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Frase de Alex (la pista). Mantiene visible toda la ronda.
    this.alexLineText = this.ctx.scene.add
      .text(this.cx, this.cy - 38, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '9px',
        color: '#5eead4',
        fontStyle: 'italic',
        wordWrap: { width: PW - 28 },
        align: 'center',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Texto central (countdown + ¡PICK!).
    this.centerText = this.ctx.scene.add
      .text(this.cx, this.cy - 8, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '20px',
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    // Time bar.
    this.timeBarBg = this.ctx.scene.add
      .rectangle(this.cx, this.cy + 56, 220, 5, 0x3a2618, 1)
      .setStrokeStyle(1, 0x6b4425, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3)
      .setVisible(false);
    this.timeBarFg = this.ctx.scene.add
      .rectangle(this.cx - 110, this.cy + 56, 220, 4, 0xfbbf24, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 4)
      .setVisible(false);

    // Options + halos detrás (sólo se ven cuando mariaMindActive).
    const optY = this.cy + 30;
    const optsX = [this.cx - 50, this.cx, this.cx + 50];
    for (let i = 0; i < 3; i++) {
      const halo = this.ctx.scene.add
        .circle(optsX[i], optY, 16, 0x4ade80, 0)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 2)
        .setVisible(false);
      const t = this.ctx.scene.add
        .text(optsX[i], optY, ICON[MOVES[i]], {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '20px',
          color: '#fbbf24',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 3)
        .setVisible(false);
      const lab = this.ctx.scene.add
        .text(optsX[i], optY + 14, `[${i + 1}] ${MOVES[i]}`, {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '6px',
          color: '#9ca3af',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 3)
        .setVisible(false);
      this.optionHalos.push(halo);
      this.optionTexts.push(t);
      this.optionLabels.push(lab);
    }

    this.hintText = this.ctx.scene.add
      .text(this.cx, this.cy + PH / 2 - 18, 'Lee a Alex · 1=piedra 2=papel 3=tijera · ESC: salir', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#6b4425',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);

    this.setHintText = this.ctx.scene.add
      .text(this.cx, this.cy + PH / 2 - 6, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#fbbf24',
        fontStyle: 'italic',
        wordWrap: { width: PW - 28 },
        align: 'center',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 3);
  }

  private bindInput(): void {
    const kb = this.ctx.scene.input.keyboard;
    if (!kb) return;
    this.keyEsc = kb.addKey('ESC');
    this.key1 = kb.addKey('ONE');
    this.key2 = kb.addKey('TWO');
    this.key3 = kb.addKey('THREE');

    this.keyEsc.on('down', () => this.abort());
    this.key1.on('down', () => this.tryPick(0));
    this.key2.on('down', () => this.tryPick(1));
    this.key3.on('down', () => this.tryPick(2));
  }

  // ──────────────────────────────────────────────────────────────────────
  // PHASES
  // ──────────────────────────────────────────────────────────────────────

  private startAlexLine(): void {
    if (this.finished) return;
    this.phase = 'alexLine';
    this.clearClash();
    this.timeBarBg.setVisible(false);
    this.timeBarFg.setVisible(false);
    this.setOptionsVisible(false);
    this.setHalosVisible(false);
    this.centerText.setText('');

    // Decide jugada del script + frase aleatoria del pool de esa jugada.
    this.currentScriptMove = MOVES[Math.floor(Math.random() * 3)];
    const pool = ALEX_LINES[this.currentScriptMove];
    const line = pool[Math.floor(Math.random() * pool.length)];
    this.alexLineText.setText('Alex: ' + line);
    this.alexLineText.setColor('#5eead4');

    this.phaseTimer?.remove();
    this.phaseTimer = this.ctx.scene.time.delayedCall(ALEX_LINE_TIME_MS, () => {
      if (this.finished) return;
      this.startCountdown();
    });
  }

  private startCountdown(): void {
    if (this.finished) return;
    this.phase = 'countdown';
    this.countdownStep = 0;
    this.centerText.setText('uno...');
    this.scheduleCountdownStep();
  }

  private scheduleCountdownStep(): void {
    this.phaseTimer?.remove();
    this.phaseTimer = this.ctx.scene.time.delayedCall(COUNTDOWN_STEP_MS, () => {
      if (this.finished) return;
      this.countdownStep++;
      if (this.countdownStep === 1) {
        this.centerText.setText('dos...');
        this.scheduleCountdownStep();
      } else if (this.countdownStep === 2) {
        this.centerText.setText('tres...');
        this.scheduleCountdownStep();
      } else {
        this.startPick();
      }
    });
  }

  private startPick(): void {
    if (this.finished) return;
    this.phase = 'pick';
    this.centerText.setText('¡PICK!').setColor('#4ade80');
    this.timeBarBg.setVisible(true);
    this.timeBarFg.setVisible(true);
    this.timeBarFg.width = 220;
    this.timeBarFg.fillColor = 0xfbbf24;
    this.setOptionsVisible(true);

    // Si María está en la mente de Alex, pintamos los halos verde/rojo
    // sobre las opciones según cuál vence al script.
    if (this.mariaMindActive) {
      const winningMove = BEATS[this.currentScriptMove];
      for (let i = 0; i < 3; i++) {
        const m = MOVES[i];
        const halo = this.optionHalos[i];
        if (m === winningMove) {
          halo.setFillStyle(0x4ade80, 0.4);
        } else {
          halo.setFillStyle(0xef4444, 0.25);
        }
        halo.setVisible(true);
      }
    }

    this.pickStartedAt = this.ctx.scene.time.now;

    this.ctx.scene.time.delayedCall(280, () => {
      if (this.finished || this.phase !== 'pick') return;
      this.centerText.setText('');
    });
  }

  private tryPick(idx: number): void {
    if (this.phase !== 'pick' || this.finished) return;
    const mariaMove = MOVES[idx];
    this.resolveRound(mariaMove);
  }

  private timeoutPick(): void {
    if (this.phase !== 'pick' || this.finished) return;
    // Forfeit: María no eligió → derrota directa de esa ronda. NO activa
    // "Alex en mente" — éste sólo se dispara cuando María iba a ganar.
    this.resolveRound(null);
  }

  /**
   * Resuelve una ronda. La lógica de "Alex entra en mente" se activa
   * AQUÍ cuando detectamos que María iba a cerrar el set sin tener los
   * empates necesarios (TIES_NEEDED).
   *
   * Refactor it.5: cada animación ahora toma un `onComplete` callback
   * explícito. Antes, dos delayedCalls paralelos (uno para "actualiza
   * marcador" otro para "afterRound") chequeaban phase==='mindDialog'
   * para decidir si seguir, y cuando Alex hijack-eaba ese chequeo
   * bloqueaba el set y se quedaba atascado.
   */
  private resolveRound(mariaMove: Move | null): void {
    if (this.phase !== 'pick' || this.finished) return;
    this.phase = 'clash';
    this.timeBarBg.setVisible(false);
    this.timeBarFg.setVisible(false);
    this.setOptionsVisible(false);
    this.setHalosVisible(false);
    this.centerText.setText('');

    // Caso forfeit: Alex gana esa ronda con su jugada anunciada.
    if (mariaMove === null) {
      const sm = this.currentScriptMove;
      this.runClashAnim(null, sm, false, false, () =>
        this.applyRoundOutcome(null, sm, false, false),
      );
      return;
    }

    const isTie = mariaMove === this.currentScriptMove;
    const mariaWouldWin = mariaMove === BEATS[this.currentScriptMove];

    // ¿Alex activa la mecánica de hijack?
    const wouldClose =
      mariaWouldWin && this.mariaWins + 1 >= 3 && this.mariaTies < TIES_NEEDED;
    if (wouldClose && !this.mariaMindActive) {
      this.alexMindEverTriggered = true;
      const hijackScriptMove = BEATS[mariaMove];
      this.currentScriptMove = hijackScriptMove;
      this.showMindDialog(
        'alex',
        'Alex: "Hah, acabo de entrar en tu mente 🧠"',
        () => {
          if (this.finished) return;
          this.runClashAnim(mariaMove, hijackScriptMove, false, false, () =>
            this.applyRoundOutcome(mariaMove, hijackScriptMove, false, false),
          );
        },
      );
      return;
    }

    const sm = this.currentScriptMove;
    this.runClashAnim(mariaMove, sm, mariaWouldWin, isTie, () =>
      this.applyRoundOutcome(mariaMove, sm, mariaWouldWin, isTie),
    );
  }

  /**
   * Aplica el resultado de la ronda al marcador y decide la siguiente
   * acción: si María acaba de empatar la TIES_NEEDED-ésima vez, pasa al
   * showMindDialog de María; si no, va directo a afterRound.
   */
  private applyRoundOutcome(
    _mariaMove: Move | null,
    _scriptMove: Move,
    mariaWon: boolean,
    tie: boolean,
  ): void {
    if (this.finished) return;
    if (tie) this.mariaTies++;
    else if (mariaWon) this.mariaWins++;
    else this.scriptWins++;
    this.refreshScore();

    if (tie && this.mariaTies >= TIES_NEEDED && !this.mariaMindActive) {
      this.mariaMindActive = true;
      this.showMindDialog(
        'maria',
        'María: "Gracias Alex, ahora estoy en tu mente."',
        () => this.afterRound(),
      );
      return;
    }

    this.afterRound();
  }

  // ──────────────────────────────────────────────────────────────────────
  // CLASH ANIM
  // ──────────────────────────────────────────────────────────────────────

  private runClashAnim(
    mariaMove: Move | null,
    scriptMove: Move,
    mariaWon: boolean,
    tie: boolean,
    onComplete: () => void,
  ): void {
    const leftIcon = mariaMove ? ICON[mariaMove] : '⌛'; // reloj de arena si timeout
    const rightIcon = ICON[scriptMove];
    const mariaIco = this.ctx.scene.add
      .text(this.cx - 100, this.cy + 14, leftIcon, {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '36px',
        color: mariaMove ? '#fbbf24' : '#ef4444',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 5);
    const scriptIco = this.ctx.scene.add
      .text(this.cx + 100, this.cy + 14, rightIcon, {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '36px',
        color: '#fbbf24',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 5);
    const mariaLab = this.ctx.scene.add
      .text(this.cx - 100, this.cy + 42, 'María', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#c08a4f',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 5);
    const scriptLab = this.ctx.scene.add
      .text(this.cx + 100, this.cy + 42, 'Alex', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '6px',
        color: '#c08a4f',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 5);
    this.clashObjects.push(mariaIco, scriptIco, mariaLab, scriptLab);

    this.ctx.scene.tweens.add({
      targets: mariaIco,
      x: this.cx - 22,
      duration: 380,
      ease: 'Cubic.easeOut',
    });
    this.ctx.scene.tweens.add({
      targets: scriptIco,
      x: this.cx + 22,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.finished) return;
        this.ctx.scene.cameras.main.shake(120, 0.005);

        const resultText = tie ? 'EMPATE' : mariaWon ? '¡GANAS!' : 'PIERDES';
        const resultColor = tie ? '#fbbf24' : mariaWon ? '#4ade80' : '#ef4444';
        const r = this.ctx.scene.add
          .text(this.cx, this.cy - 16, resultText, {
            fontFamily: "'Silkscreen', monospace",
            fontSize: '14px',
            color: resultColor,
            fontStyle: 'bold',
          })
          .setOrigin(0.5, 0.5)
          .setScrollFactor(0)
          .setDepth(PANEL_DEPTH + 6);
        this.clashObjects.push(r);

        if (!tie) {
          const loser = mariaWon ? scriptIco : mariaIco;
          const winner = mariaWon ? mariaIco : scriptIco;
          this.ctx.scene.tweens.add({
            targets: loser,
            y: this.cy + 90,
            angle: mariaWon ? 90 : -90,
            alpha: 0,
            duration: 600,
            ease: 'Cubic.easeIn',
          });
          winner.setColor('#4ade80');
          this.ctx.scene.tweens.add({
            targets: winner,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 250,
            yoyo: true,
          });
        }

        // Único delayedCall final: tras el clash visual, llamamos al
        // onComplete que el caller (resolveRound) ha provisto. Toda la
        // lógica de marcador / siguiente ronda / mind dialog está dentro
        // de applyRoundOutcome (it.5 refactor — antes había dos
        // delayedCalls paralelos que se pisaban con el flag mindDialog).
        this.ctx.scene.time.delayedCall(CLASH_TIME_MS, () => {
          if (this.finished) return;
          onComplete();
        });
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // MIND DIALOGS
  // ──────────────────────────────────────────────────────────────────────

  private showMindDialog(
    who: 'alex' | 'maria',
    text: string,
    after: () => void,
  ): void {
    this.phase = 'mindDialog';
    this.clearMindDialog();

    // Panel adaptativo (it.6): si el texto es largo (hint 4ª pared),
    // crece la altura del overlay para no comprimir las líneas.
    const lineCount = (text.match(/\n/g) || []).length + 1;
    const wrappedExtra = Math.max(0, Math.floor(text.length / 60));
    const overlayH = Math.min(140, 50 + (lineCount + wrappedExtra) * 14);

    const overlay = this.ctx.scene.add
      .rectangle(this.cx, this.cy, 320, overlayH, who === 'alex' ? 0x5eead4 : 0xff8ab8, 0.18)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 7);
    const t = this.ctx.scene.add
      .text(this.cx, this.cy, text, {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: who === 'alex' ? '#5eead4' : '#ff8ab8',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 280 },
        lineSpacing: 2,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 8);
    this.mindDialogObjects.push(overlay, t);

    // Pulse del overlay para que llame la atención.
    this.ctx.scene.tweens.add({
      targets: overlay,
      alpha: { from: 0.18, to: 0.36 },
      duration: 280,
      yoyo: true,
      repeat: 2,
    });

    // It.6: tiempo del cuadro escala con la longitud del texto. Mensajes
    // cortos ("Hah, entré en tu mente") quedan en el mínimo (2.2s).
    // Mensajes largos (hint 4ª pared) se quedan más tiempo para leerse.
    const charBudget = text.length;
    const dialogMs = Math.max(MIND_DIALOG_MS, Math.min(8000, charBudget * 45));

    this.ctx.scene.time.delayedCall(dialogMs, () => {
      if (this.finished) return;
      this.clearMindDialog();
      after();
    });
  }

  private clearMindDialog(): void {
    for (const o of this.mindDialogObjects) o.destroy();
    this.mindDialogObjects = [];
  }

  // ──────────────────────────────────────────────────────────────────────
  // ROUND TRANSITIONS
  // ──────────────────────────────────────────────────────────────────────

  private afterRound(): void {
    if (this.finished) return;

    // ¿Set cerrado? Para María: 3 wins Y TIES_NEEDED empates (mecánica oculta).
    if (this.mariaWins >= 3 && this.mariaTies >= TIES_NEEDED) {
      this.finishSetWin();
      return;
    }
    if (this.scriptWins >= 3) {
      this.finishSetLoss();
      return;
    }
    this.startAlexLine();
  }

  private finishSetWin(): void {
    this.phase = 'done';
    // Al ganar, reseteamos persistentSetAttempt — la próxima sesión del
    // minijuego (si la hubiera) arranca limpia.
    persistentSetAttempt = 1;
    this.centerText.setText('SET').setColor('#4ade80');
    this.alexLineText.setText('Alex: "...vale, has entrado bien. ven."');
    this.ctx.scene.time.delayedCall(1100, () => {
      if (this.finished) return;
      this.finish(true);
    });
  }

  /**
   * It.6: en vez de reiniciar el set automáticamente, mostramos el hint
   * de Alex como diálogo grande y cerramos el minijuego. María lee la
   * pista y vuelve a interactuar con la pared cuando quiera.
   *
   * El setAttempt se incrementa en `persistentSetAttempt` (variable
   * módulo) para que la próxima vez que se abra el minijuego arranque
   * con el siguiente nivel de hint — la escalada sí se mantiene entre
   * intentos.
   */
  private finishSetLoss(): void {
    persistentSetAttempt = this.setAttempt + 1;
    this.phase = 'done';

    // Calcula qué hint le toca a este intento (basado en intento que
    // acaba de perder, no en el siguiente).
    const hintIdx = Math.min(this.setAttempt - 1, ALEX_SET_HINTS.length - 1);
    const hint = ALEX_SET_HINTS[hintIdx];

    // Limpia visuales activos.
    this.centerText.setText('');
    this.alexLineText.setText('');
    this.timeBarBg.setVisible(false);
    this.timeBarFg.setVisible(false);
    this.setOptionsVisible(false);
    this.setHalosVisible(false);
    this.clearClash();

    // Si no hay hint (intento 1), cuadro genérico de "ya casi" tipo Alex
    // tranquilizando para que no sea ruido vacío.
    const dialogText = hint
      ? 'Alex (desde dentro):\n' + hint
      : 'Alex: "uy. otro día. tú insistes y entras."';

    // Pausa breve antes del cuadro para asentar el clash final.
    this.ctx.scene.time.delayedCall(500, () => {
      if (this.finished) return;
      this.showMindDialog('alex', dialogText, () => {
        if (this.finished) return;
        // Cierra el minijuego como derrota — María vuelve a interactuar
        // con la pared cuando quiera. El handler del wall NO desbloquea
        // la habitación porque success=false.
        this.finish(false, 'failed');
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // TICK
  // ──────────────────────────────────────────────────────────────────────

  private tick(time: number): void {
    if (this.finished) return;
    if (this.phase !== 'pick') return;
    const tElapsed = time - this.pickStartedAt;
    const ratio = Math.max(0, 1 - tElapsed / PICK_TIME_MS);
    if (this.timeBarFg.scene) {
      this.timeBarFg.width = 220 * ratio;
      if (ratio < 0.3) {
        const blink = Math.floor(time / 80) % 2 === 0;
        this.timeBarFg.fillColor = blink ? 0xb91c1c : 0xef4444;
      } else {
        this.timeBarFg.fillColor = 0xfbbf24;
      }
    }
    if (ratio <= 0) this.timeoutPick();
  }

  // ──────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────

  private refreshScore(): void {
    if (!this.scoreText.scene) return;
    // Mecánica oculta (it.5): NO mostramos el contador de empates. María
    // tiene que descubrir por sí sola que necesita igualar a Alex varias
    // veces antes de poder cerrar el set. Sólo se muestra wins / wins / set.
    this.scoreText.setText(
      `María ${this.mariaWins}/3  ·  ${this.scriptWins}/3 Alex  ·  set ${this.setAttempt}`,
    );
    if (this.mindBadge.scene) {
      // El badge sólo aparece cuando María ya está en mente — es feedback
      // de un estado activo, no un contador. (Y viendo el badge encendido
      // tras un empate, María ata cabos: "ah, los empates servían".)
      if (this.mariaMindActive) {
        this.mindBadge.setText('🧠 estás en su mente');
      } else {
        this.mindBadge.setText('');
      }
    }
  }

  private setOptionsVisible(v: boolean): void {
    for (let i = 0; i < 3; i++) {
      this.optionTexts[i]?.setVisible(v);
      this.optionLabels[i]?.setVisible(v);
    }
  }

  private setHalosVisible(v: boolean): void {
    for (const h of this.optionHalos) h.setVisible(v);
  }

  private clearClash(): void {
    for (const o of this.clashObjects) o.destroy();
    this.clashObjects = [];
  }

  // ──────────────────────────────────────────────────────────────────────
  // FINISH
  // ──────────────────────────────────────────────────────────────────────

  private abort(): void {
    if (this.finished) return;
    this.finish(false, 'aborted');
  }

  private finish(success: boolean, reason?: 'completed' | 'aborted' | 'failed'): void {
    if (this.finished) return;
    this.finished = true;
    this.cleanup();
    this.resolveOuter({
      success,
      reason: reason ?? (success ? 'completed' : 'failed'),
    });
  }

  private cleanup(): void {
    if (this.onUpdate) {
      this.ctx.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
      this.onUpdate = undefined;
    }
    this.phaseTimer?.remove();
    this.phaseTimer = undefined;

    this.clearClash();
    this.clearMindDialog();

    this.keyEsc?.removeAllListeners();
    this.key1?.removeAllListeners();
    this.key2?.removeAllListeners();
    this.key3?.removeAllListeners();
    // OJO: NO removeKey() — Phaser reusa Keys con la apartment scene.

    [
      this.dim,
      this.panelBg,
      this.panelBorder,
      this.titleText,
      this.scoreText,
      this.mindBadge,
      this.hintText,
      this.alexLineText,
      this.centerText,
      this.timeBarBg,
      this.timeBarFg,
      this.setHintText,
    ].forEach((o) => o?.destroy());
    [
      ...this.optionTexts,
      ...this.optionLabels,
      ...this.optionHalos,
    ].forEach((o) => o.destroy());
    this.optionTexts = [];
    this.optionLabels = [];
    this.optionHalos = [];
  }
}
