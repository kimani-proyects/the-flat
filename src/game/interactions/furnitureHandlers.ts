import * as Phaser from 'phaser';
import type { InteractionContext, InteractionHandler } from '../systems/InteractionSystem';
import { useProgressStore } from '@/lib/stores/gameStore';
import { pickRandomTvEpisode, getSpeakerColor, type TvShow } from '../data/tvShows';
import {
  MANLY_CHAPTERS,
  type ManlyChapter,
  type SigilKind,
} from '../data/manlyPHall';
import { S, COLORS, FONT_STACK } from '../systems/TextStyle';
import { getFurnitureRenderer } from '../systems/FurnitureRenderer';
import { Sfx } from '../systems/SfxBank';

/**
 * Handlers ricos para mobiliario emblemático (S1, Día 10).
 *
 * Cada handler es función async exportada. Se registran en handlers.ts
 * sobreescribiendo los stub-dialog del Día 6.
 *
 * Lista:
 *   - TV (combo con sofá): toggle ON/OFF. Sprite tinte cuando ON.
 *   - Sofá: si TV ON → reproduce episodio random (South Park / Shrek)
 *           con typewriter; si OFF → flavor.
 *   - Cama (bed-maria): de noche, "viaje astral" → fade negro y vuelve
 *           con texto "todavía no he meditado lo suficiente". De día,
 *           flavor normal.
 *   - Cama (bed-alex): lee `alexConnected` + `alexLastConnectedAtMs`
 *           del store y construye diálogo orgánico ("se conectó hace
 *           X horas", "está conectado ahora mismo", "no se conecta
 *           desde el martes").
 *   - Espejo (mirror): vapor opaco encima del espejo + cara cutre que
 *           aparece detrás 1s y se va. Susto suave.
 *   - Librería (bookshelf): abre modal de páginas con citas de Manly P.
 *           Hall ("The Secret Teachings of All Ages"). ←/→ navega,
 *           ESC cierra.
 *   - Armario (wardrobe): placeholder cozy "próximamente: ropa".
 *   - Nevera (fridge): placeholder "próximamente: mini-overcooked".
 */

// ─── TV STATE (singleton de módulo) ───────────────────────────────────

let TV_ON = false;
const TV_LISTENERS = new Set<(on: boolean) => void>();

export function isTvOn(): boolean {
  return TV_ON;
}
export function setTvOn(on: boolean): void {
  if (TV_ON === on) return;
  Sfx.tvSwitch();
  TV_ON = on;
  for (const l of TV_LISTENERS) l(on);
}
export function onTvStateChange(fn: (on: boolean) => void): () => void {
  TV_LISTENERS.add(fn);
  return () => TV_LISTENERS.delete(fn);
}

// ─── TV HANDLER ───────────────────────────────────────────────────────

/**
 * Estado del autoplay de TV. Cuando la TV se enciende, arranca un
 * timer que va sacando líneas del episodio en un bocadillo SCREEN-FIXED.
 * Al apagar la TV, el timer se detiene y el bocadillo se cierra.
 */
let TV_AUTOPLAY: TvAutoplay | null = null;

export const tvHandler: InteractionHandler = async (ctx) => {
  if (!TV_ON) {
    setTvOn(true);
    // S2.4: al encender → lanzamos el autoplay del show. NO hay que
    // sentarse en el sofá. El bocadillo aparece screen-fixed esquina
    // superior derecha (al lado de donde está la TV en el mundo).
    if (!TV_AUTOPLAY) {
      TV_AUTOPLAY = new TvAutoplay(ctx.scene);
      TV_AUTOPLAY.start();
    }
    await ctx.showDialog(
      ['*enciendes la tele.*', '"a ver qué echan."'],
      { speaker: 'María', portrait: 'maria' },
    );
  } else {
    setTvOn(false);
    if (TV_AUTOPLAY) {
      TV_AUTOPLAY.stop();
      TV_AUTOPLAY = null;
    }
    await ctx.showDialog(
      ['*apagas la tele.*', '"silencio."'],
      { speaker: 'María', portrait: 'maria' },
    );
  }
};

/**
 * S2.4: TV autoplay — saca líneas del episodio en un bocadillo
 * screen-fixed esquina top-right del viewport, una nueva línea cada
 * 4 segundos. Al terminar el episodio, elige otro automáticamente.
 */
class TvAutoplay {
  private scene: Phaser.Scene;
  private bubble: Phaser.GameObjects.GameObject[] = [];
  private speakerText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private currentShow: TvShow | null = null;
  private currentEpisodeLines: { speaker: string; text: string }[] = [];
  private currentLineIdx = 0;
  private currentTitle = '';
  private timer: Phaser.Time.TimerEvent | null = null;
  private stopped = false;
  /** Modo interstitial: "A CONTINUACIÓN…" entre episodios. */
  private interstitial = false;
  /** Próximo show — se elige durante el interstitial. */
  private nextShow: TvShow | null = null;
  private nextEpisodeData: { show: TvShow; episode: { title: string; lines: { speaker: string; text: string }[] } } | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  start(): void {
    this.buildBubble();
    this.queueNextEpisode();
    this.applyEpisode();
    // Avanza línea cada 4s.
    this.timer = this.scene.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => this.nextLine(),
    });
  }

  private buildBubble(): void {
    // S2.6: estilo Project Zomboid — texto flotante en el WORLD, ahora
    // colocado A LA IZQUIERDA Y DEBAJO de la TV para que no se salga
    // por la pared derecha. Tile TV ≈ (38, 1). Anclamos el bocadillo
    // en (32, 5) — debajo de la TV, contra la pared izquierda del
    // salón, con wordWrap más estrecho. Stroke negro grueso para
    // legibilidad sobre cualquier suelo.
    const DEPTH = 25;
    const TV_TILE_X = 38;
    const TV_TILE_Y = 1;
    const wx = (TV_TILE_X - 6) * 16; // 6 tiles a la IZQUIERDA del centro TV
    const wy = (TV_TILE_Y + 4) * 16; // 4 tiles DEBAJO de la TV

    this.titleText = this.scene.add
      .text(wx, wy, '', {
        fontFamily: FONT_STACK,
        fontSize: '7px',
        color: '#fbbf24',
        fontStyle: 'italic bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0, 0)
      .setDepth(DEPTH);
    this.speakerText = this.scene.add
      .text(wx, wy + 12, '', {
        fontFamily: FONT_STACK,
        fontSize: '8px',
        color: '#ff2e9f',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0, 0)
      .setDepth(DEPTH);
    this.bodyText = this.scene.add
      .text(wx, wy + 24, '', {
        fontFamily: FONT_STACK,
        fontSize: '8px',
        color: '#fafaf5',
        align: 'left',
        wordWrap: { width: 130, useAdvancedWrap: true },
        lineSpacing: 2,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0, 0)
      .setDepth(DEPTH);
  }

  /** Selecciona el próximo episodio (sin aplicarlo). */
  private queueNextEpisode(): void {
    const { show, episode } = pickRandomTvEpisode();
    this.nextEpisodeData = { show, episode };
    this.nextShow = show;
  }

  /** Aplica el episodio en cola al estado actual. */
  private applyEpisode(): void {
    if (!this.nextEpisodeData) return;
    const { show, episode } = this.nextEpisodeData;
    this.currentShow = show;
    this.currentTitle = '📺 ' + show.title.toUpperCase() + ' · ' + episode.title;
    this.currentEpisodeLines = episode.lines;
    this.currentLineIdx = 0;
    this.interstitial = false;
    if (this.titleText && this.titleText.scene) {
      const t =
        this.currentTitle.length > 38
          ? this.currentTitle.slice(0, 35) + '...'
          : this.currentTitle;
      this.titleText.setText(t).setColor(show.color);
    }
    this.renderCurrent();
  }

  /** Pinta la pantalla de interstitial "A CONTINUACIÓN…". */
  private showInterstitial(): void {
    this.interstitial = true;
    this.queueNextEpisode();
    if (!this.titleText?.scene) return;
    this.titleText.setText('— FIN —').setColor('#9ca3af');
    this.speakerText.setText('A CONTINUACIÓN…').setColor('#fbbf24');
    const next = this.nextEpisodeData;
    if (next) {
      this.bodyText
        .setText(next.show.title + '\n"' + next.episode.title + '"')
        .setColor(next.show.color);
    } else {
      this.bodyText.setText('...');
    }
  }

  private nextLine(): void {
    if (this.stopped) return;
    // Si estamos en interstitial → al siguiente tick aplicamos episodio.
    if (this.interstitial) {
      this.applyEpisode();
      return;
    }
    this.currentLineIdx += 1;
    if (this.currentLineIdx >= this.currentEpisodeLines.length) {
      // Fin del episodio — mostrar A CONTINUACIÓN durante 1 tick.
      this.showInterstitial();
      return;
    }
    this.renderCurrent();
  }

  private renderCurrent(): void {
    if (!this.speakerText || !this.speakerText.scene) return;
    const line = this.currentEpisodeLines[this.currentLineIdx];
    if (!line) return;
    const showColor = this.currentShow?.color ?? '#ff2e9f';
    const speakerColor = getSpeakerColor(line.speaker, showColor);
    this.speakerText.setText(line.speaker).setColor(speakerColor);
    this.bodyText.setText(line.text).setColor('#fafaf5');
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      this.timer.remove();
      this.timer = null;
    }
    for (const o of this.bubble) {
      if ((o as Phaser.GameObjects.GameObject & { scene?: unknown }).scene) o.destroy();
    }
    this.bubble = [];
    if (this.speakerText?.scene) this.speakerText.destroy();
    if (this.bodyText?.scene) this.bodyText.destroy();
    if (this.titleText?.scene) this.titleText.destroy();
  }
}

// ─── SOFA HANDLER (S2.4: ya no controla la TV) ────────────────────────

export const sofaHandler: InteractionHandler = async (ctx) => {
  // El sofá pasa a ser pasivo. La TV se enciende DIRECTAMENTE pulsando E
  // sobre la propia TV — el bocadillo del show aparece en esquina y no
  // depende de sentarse en el sofá.
  if (TV_ON) {
    await ctx.showDialog(
      [
        '*te dejas caer en el sofá.*',
        '"...mira eso, ya está enchufada."',
        '*ves un rato sin sentarte del todo.*',
      ],
      { speaker: 'María', portrait: 'maria' },
    );
  } else {
    await ctx.showDialog(
      [
        '*te tumbas en el sofá.*',
        '"si no enciendes la tele, la siesta es lo único que queda."',
      ],
      { speaker: 'María', portrait: 'maria' },
    );
  }
};

/**
 * Reproduce las líneas del episodio en un bocadillo pixel-art encima de
 * la TV (estilo Project Zomboid). SPACE/ENTER avanza línea, ESC se
 * levanta. El bocadillo se ancla en la posición fija de la TV
 * (interactable id 'tv').
 */
async function playTvShowBubble(
  ctx: InteractionContext,
  lines: { speaker: string; text: string }[],
  showTitle: string,
): Promise<void> {
  // S2.2: bocadillo SCREEN-FIXED en zona neutral del viewport — entre
  // la TV (arriba) y el DialogSystem (abajo). cy=130 lo deja claramente
  // dentro y no tapa al sprite TV. Banner de título en y=88.
  const cam = ctx.scene.cameras.main;
  const W = cam.width;
  const cx = W / 2;
  const cy = 130;
  const DEPTH = 1850;
  const BW = 260;
  const BH = 80;

  // Banner de título encima del bocadillo (el "canal" que está viendo).
  const bannerY = 84;
  // Recortamos el título si es muy largo para no desbordar el banner.
  const truncatedTitle =
    showTitle.length > 36 ? showTitle.slice(0, 33) + '...' : showTitle;
  const titleBg = ctx.scene.add
    .rectangle(cx, bannerY, BW + 20, 18, 0xb91c1c, 1)
    .setStrokeStyle(2, 0x1a0e08, 1)
    .setScrollFactor(0)
    .setDepth(DEPTH + 1);
  const titleText = ctx.scene.add
    .text(cx, bannerY, truncatedTitle, {
      fontFamily: FONT_STACK,
      fontSize: '9px',
      color: '#fafaf5',
      fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(DEPTH + 2);

  const shadow = ctx.scene.add
    .rectangle(cx + 2, cy + 2, BW + 4, BH + 4, 0x000000, 0.6)
    .setScrollFactor(0)
    .setDepth(DEPTH);
  const border = ctx.scene.add
    .rectangle(cx, cy, BW + 4, BH + 4, 0x1a0e08, 1)
    .setScrollFactor(0)
    .setDepth(DEPTH + 1);
  const bg = ctx.scene.add
    .rectangle(cx, cy, BW, BH, 0xfafaf5, 1)
    .setScrollFactor(0)
    .setDepth(DEPTH + 2);
  // Cola del bocadillo apuntando arriba (hacia el banner / TV).
  const tail = ctx.scene.add
    .triangle(cx - 60, cy - BH / 2 - 4, 0, 6, -6, 0, 6, 0, 0xfafaf5, 1)
    .setStrokeStyle(2, 0x1a0e08, 1)
    .setScrollFactor(0)
    .setDepth(DEPTH + 1);

  const speakerText = ctx.scene.add
    .text(cx - BW / 2 + 8, cy - BH / 2 + 4, '', {
      fontFamily: FONT_STACK,
      fontSize: '9px',
      color: '#b91c1c',
      fontStyle: 'bold',
    })
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(DEPTH + 3);
  const lineText = ctx.scene.add
    .text(cx, cy + 4, '', {
      fontFamily: FONT_STACK,
      fontSize: '10px',
      color: '#1a0e08',
      align: 'center',
      wordWrap: { width: BW - 16, useAdvancedWrap: true },
      lineSpacing: 2,
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(DEPTH + 3);
  const hint = ctx.scene.add
    .text(cx + BW / 2 - 8, cy + BH / 2 - 4, 'SPACE  ·  ESC para apagar', {
      fontFamily: FONT_STACK,
      fontSize: '7px',
      color: '#9ca3af',
    })
    .setOrigin(1, 1)
    .setScrollFactor(0)
    .setDepth(DEPTH + 3);

  const cleanup = () => {
    [titleBg, titleText, shadow, border, bg, tail, speakerText, lineText, hint].forEach((o) =>
      o.destroy(),
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    speakerText.setText(line.speaker);
    lineText.setText(line.text);

    const escaped = await new Promise<boolean>((resolve) => {
      const onKey = (e: KeyboardEvent) => {
        const k = e.key;
        if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
          e.preventDefault();
          window.removeEventListener('keydown', onKey);
          resolve(false);
        } else if (k === 'Escape' || k === 'Esc') {
          e.preventDefault();
          window.removeEventListener('keydown', onKey);
          resolve(true);
        }
      };
      window.addEventListener('keydown', onKey);
    });
    if (escaped) break;
  }
  cleanup();
}

// ─── BED HANDLER (branch por id) ──────────────────────────────────────

export const bedHandler: InteractionHandler = async (ctx) => {
  const id = ctx.interactable.id;
  if (id === 'bed-maria') {
    return bedMariaHandler(ctx);
  }
  if (id === 'bed-alex') {
    return bedAlexHandler(ctx);
  }
  // Fallback (no debería pasar).
  await ctx.showDialog(['*una cama. nada interesante.*'], {
    speaker: 'María',
    portrait: 'maria',
  });
};

async function bedMariaHandler(ctx: InteractionContext): Promise<void> {
  const hour = new Date().getHours();
  const isNight = hour >= 22 || hour < 6;
  if (!isNight) {
    await ctx.showDialog(
      [
        '*tu cama. te llama, pero es temprano.*',
        '"luego."',
      ],
      { speaker: 'María', portrait: 'maria' },
    );
    return;
  }
  // Noche → intento de viaje astral (placeholder con fade).
  await ctx.showDialog(
    [
      '*te tumbas en la cama.*',
      '"vamos a probar lo del viaje astral."',
      '*cierras los ojos.*',
    ],
    { speaker: 'María', portrait: 'maria' },
  );
  // Fade a negro, espera, fade in.
  const cam = ctx.scene.cameras.main;
  cam.fadeOut(800, 0, 0, 0);
  await new Promise<void>((resolve) =>
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => resolve()),
  );
  await new Promise<void>((resolve) => ctx.scene.time.delayedCall(1500, () => resolve()));
  cam.fadeIn(900, 0, 0, 0);
  await new Promise<void>((resolve) =>
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => resolve()),
  );
  await ctx.showDialog(
    [
      '*abres los ojos.*',
      '"todavía no he meditado lo suficiente."',
      '"...próximamente."',
    ],
    { speaker: 'María', portrait: 'maria' },
  );
}

async function bedAlexHandler(ctx: InteractionContext): Promise<void> {
  const store = useProgressStore.getState();
  const isConnectedNow = false; // TODO: leer de useGameStore.alexMode === 'spawned' / 'invisible'
  // De momento usamos `alexLastConnectedAtMs` como única señal. Cuando
  // multiplayer esté wired, se detecta la conexión real y `markAlexConnected`
  // se llama desde el sistema de presencia.
  const last = store.alexLastConnectedAtMs;
  const lines: string[] = ['*la cama de Alex.*'];
  if (isConnectedNow) {
    lines.push('"está aquí. lo siento."', '*la cama está caliente.*');
  } else if (last === 0) {
    lines.push(
      '*aún no se ha conectado.*',
      '"esperando."',
    );
  } else {
    const ago = Date.now() - last;
    const hrs = Math.floor(ago / (60 * 60 * 1000));
    const days = Math.floor(hrs / 24);
    if (hrs < 1) {
      lines.push('*aún huele a él. acaba de irse.*');
    } else if (hrs < 24) {
      lines.push(`*se conectó hace ${hrs} ${hrs === 1 ? 'hora' : 'horas'}.*`);
    } else if (days < 7) {
      lines.push(`*lleva ${days} ${days === 1 ? 'día' : 'días'} sin conectarse.*`);
    } else {
      lines.push('*hace mucho que no se conecta.*', '"...lo echo de menos."');
    }
  }
  await ctx.showDialog(lines, { speaker: 'María', portrait: 'maria' });
}

// ─── MIRROR HANDLER (S2: anim del sprite + diálogo, sin vapor procedural) ─

export const mirrorHandler: InteractionHandler = async (ctx) => {
  // S2: el sprite "person approaching" YA cuenta la historia visual —
  // alguien se acerca al cristal y se ve. Reproducimos su anim al
  // interactuar y mantenemos un diálogo cortito de María. Hemos quitado
  // el vapor procedural + cara roja porque era kitsch encima del sprite.
  getFurnitureRenderer()?.playOneShot('mirror');
  await ctx.showDialog(
    [
      '*te miras al espejo.*',
      '"hay vaho. siempre hay vaho aquí."',
      '*ves algo detrás.*',
      '"...habrá sido el vaho."',
      '*sales del baño rapidito.*',
    ],
    { speaker: 'María', portrait: 'maria' },
  );
};

// ─── BOOKSHELF HANDLER (chapter menu + paginated reader) ─────────────

export const bookshelfHandler: InteractionHandler = async (ctx) => {
  await ctx.showDialog(
    [
      '*pasas la mano por los lomos.*',
      '"el de Manly P. Hall siempre vuelve a llamarme."',
      '"... Las enseñanzas secretas de todas las épocas."',
      '*lo sacas. pesa lo que pesan los libros que importan.*',
    ],
    { speaker: 'María', portrait: 'maria' },
  );
  while (true) {
    const choice = await openBookMenu(ctx);
    if (choice === null) return; // ESC en menú → cierra
    await openBookReader(ctx, MANLY_CHAPTERS[choice]);
    // Tras cerrar el reader (ESC) volvemos al menú.
  }
};

/**
 * Menú de capítulos. ↑/↓ navega, ENTER/SPACE elige, ESC cierra.
 * Devuelve el índice del capítulo o null si se canceló.
 */
function openBookMenu(ctx: InteractionContext): Promise<number | null> {
  return new Promise<number | null>((resolve) => {
    const cam = ctx.scene.cameras.main;
    const PW = 340;
    const PH = 220;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const DEPTH = 2000;

    let cursor = 0;

    const dim = ctx.scene.add
      .rectangle(cx, cy, cam.width, cam.height, 0x000000, 0.88)
      .setScrollFactor(0)
      .setDepth(DEPTH);
    const leather = ctx.scene.add
      .rectangle(cx, cy, PW + 12, PH + 12, 0x4a2818, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    const gilt = ctx.scene.add
      .rectangle(cx, cy, PW + 6, PH + 6, 0xb89060, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH + 2);
    const bg = ctx.scene.add
      .rectangle(cx, cy, PW, PH, 0xf5ecd6, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH + 3);

    const ornament = ctx.scene.add
      .text(cx, cy - PH / 2 + 14, '✤', {
        fontFamily: SERIF_STACK,
        fontSize: '16px',
        color: '#6b4425',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 4);

    const title = ctx.scene.add
      .text(cx, cy - PH / 2 + 36, 'LAS ENSEÑANZAS SECRETAS', {
        fontFamily: SERIF_STACK,
        fontSize: '15px',
        color: '#2a1810',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 4);
    const subtitle = ctx.scene.add
      .text(cx, cy - PH / 2 + 52, 'de todas las épocas', {
        fontFamily: SERIF_STACK,
        fontSize: '11px',
        color: '#6b4425',
        fontStyle: 'italic',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 4);
    const author = ctx.scene.add
      .text(cx, cy - PH / 2 + 66, 'Manly P. Hall', {
        fontFamily: SERIF_STACK,
        fontSize: '10px',
        color: '#8a5a3a',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 4);

    const indexLabel = ctx.scene.add
      .text(cx, cy - PH / 2 + 88, '— ÍNDICE —', {
        fontFamily: SERIF_STACK,
        fontSize: '9px',
        color: '#6b4425',
        fontStyle: 'italic',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 4);

    const chapterRows: Phaser.GameObjects.Text[] = [];
    const chapterSubs: Phaser.GameObjects.Text[] = [];
    const startY = cy - PH / 2 + 110;
    const rowH = 18;
    for (let i = 0; i < MANLY_CHAPTERS.length; i++) {
      const ch = MANLY_CHAPTERS[i];
      const y = startY + i * rowH;
      const t = ctx.scene.add
        .text(cx, y, `${i + 1}.  ${ch.title}`, {
          fontFamily: SERIF_STACK,
          fontSize: '13px',
          color: '#2a1810',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH + 4);
      chapterRows.push(t);
      const sub = ctx.scene.add
        .text(cx, y + 9, ch.subtitle, {
          fontFamily: SERIF_STACK,
          fontSize: '9px',
          color: '#8a5a3a',
          fontStyle: 'italic',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH + 4);
      chapterSubs.push(sub);
    }

    const hint = ctx.scene.add
      .text(cx, cy + PH / 2 - 12, '↑/↓ elegir  ·  ENTER abrir  ·  ESC cerrar', S.hint())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 4);

    const render = () => {
      for (let i = 0; i < chapterRows.length; i++) {
        const isCursor = i === cursor;
        chapterRows[i].setColor(isCursor ? '#b91c1c' : '#2a1810');
        chapterRows[i].setStyle({
          fontStyle: isCursor ? 'bold' : 'normal',
        });
      }
    };
    render();

    let done = false;
    const close = (result: number | null) => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey);
      [
        dim,
        leather,
        gilt,
        bg,
        ornament,
        title,
        subtitle,
        author,
        indexLabel,
        hint,
      ].forEach((o) => o.destroy());
      for (const r of chapterRows) r.destroy();
      for (const s of chapterSubs) s.destroy();
      resolve(result);
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') {
        e.preventDefault();
        cursor = (cursor - 1 + MANLY_CHAPTERS.length) % MANLY_CHAPTERS.length;
        render();
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        e.preventDefault();
        cursor = (cursor + 1) % MANLY_CHAPTERS.length;
        render();
      } else if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        e.preventDefault();
        close(cursor);
      } else if (k === 'Escape' || k === 'Esc') {
        e.preventDefault();
        close(null);
      }
    };
    window.addEventListener('keydown', onKey);
    ctx.scene.events.once('shutdown', () => close(null));
    ctx.scene.events.once('destroy', () => close(null));
  });
}

/**
 * Tipografía SERIF para el libro. Le da clase y rompe el aire 8-bit del
 * resto de la UI — al fin y al cabo, María está leyendo papel impreso,
 * no consultando un terminal. Cargada desde el sistema (Georgia / Times)
 * con fallback genérico serif para máxima compatibilidad.
 */
const SERIF_STACK = "'EB Garamond', 'Garamond', 'Georgia', 'Times New Roman', serif";

function openBookReader(
  ctx: InteractionContext,
  chapter: ManlyChapter,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const cam = ctx.scene.cameras.main;
    // S2.6: libro casi pantalla completa (475×268). Necesitamos cada
    // píxel porque algunas páginas de Manly P. Hall tienen 14+ líneas.
    const PW = Math.min(475, cam.width - 4);
    const PH = Math.min(268, cam.height - 2);
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const DEPTH = 2000;

    let pageIdx = 0;
    // sigilGroup: objetos del sigilo actual (los recreamos en cada render).
    let sigilGroup: Phaser.GameObjects.GameObject[] = [];

    const dim = ctx.scene.add
      .rectangle(cx, cy, cam.width, cam.height, 0x000000, 0.88)
      .setScrollFactor(0)
      .setDepth(DEPTH);
    // Marco de cuero exterior.
    const leather = ctx.scene.add
      .rectangle(cx, cy, PW + 12, PH + 12, 0x4a2818, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    // Filete dorado.
    const gilt = ctx.scene.add
      .rectangle(cx, cy, PW + 6, PH + 6, 0xb89060, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH + 2);
    // Páginas: papel cremoso.
    const bg = ctx.scene.add
      .rectangle(cx, cy, PW, PH, 0xf5ecd6, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH + 3);
    // Línea central como "encuadernación".
    const spine = ctx.scene.add
      .rectangle(cx, cy, 2, PH - 32, 0x6b4425, 0.35)
      .setScrollFactor(0)
      .setDepth(DEPTH + 4);
    // Pequeño ornamento decorativo arriba (asterisco floral simple).
    const ornament = ctx.scene.add
      .text(cx, cy - PH / 2 + 14, '✤', {
        fontFamily: SERIF_STACK,
        fontSize: '14px',
        color: '#6b4425',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 5);

    // S2 layout: zonas claramente separadas para que el texto NO se
    // solape con título ni sigilo.
    //   - chapter label: y = -PH/2 + 22  (banda superior)
    //   - page title  : y = -PH/2 + 38
    //   - body        : centrado en (-PH/2 + 56) hasta (PH/2 - 60)
    //   - sigil zone  : y = PH/2 - 50 (banda inferior izquierda)
    //   - page num    : y = PH/2 - 22
    //   - hint        : y = PH/2 - 8
    const chapterLabel = ctx.scene.add
      .text(cx, cy - PH / 2 + 22, chapter.title.toUpperCase(), {
        fontFamily: SERIF_STACK,
        fontSize: '11px',
        color: '#6b4425',
        fontStyle: 'italic',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 5);

    const pageTitle = ctx.scene.add
      .text(cx, cy - PH / 2 + 42, '', {
        fontFamily: SERIF_STACK,
        fontSize: '13px',
        color: '#2a1810',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 5);

    // Body con origin (0.5, 0) — anclado por arriba para que crezca
    // hacia abajo sin pisar el title. Top en y = -PH/2 + 58.
    // Zona segura inferior: hasta cy + PH/2 - 38 (deja sitio para
    // sigilo + page-num + hint). Si el texto rebasa, auto-shrink.
    const BODY_TOP = cy - PH / 2 + 58;
    const BODY_BOTTOM_MAX = cy + PH / 2 - 38;
    const BODY_MAX_HEIGHT = BODY_BOTTOM_MAX - BODY_TOP;
    const pageBody = ctx.scene.add
      .text(cx, BODY_TOP, '', {
        fontFamily: SERIF_STACK,
        fontSize: '12px',
        color: '#2a1810',
        align: 'center',
        wordWrap: { width: PW - 48, useAdvancedWrap: true },
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH + 5);

    const pageNum = ctx.scene.add
      .text(cx, cy + PH / 2 - 22, '', {
        fontFamily: SERIF_STACK,
        fontSize: '10px',
        color: '#6b4425',
        fontStyle: 'italic',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 5);

    // Hint mantengo en pixel (es UI del juego, no del libro).
    const hint = ctx.scene.add
      .text(cx, cy + PH / 2 - 12, '←/→ pasar página  ·  ESC cerrar', S.hint())
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 5);

    const render = () => {
      const p = chapter.pages[pageIdx];
      pageTitle.setText(p.title);
      // S2.6: auto-shrink — empieza en 12px y baja hasta 9px hasta que
      // entre en la zona segura. Si aún no entra, recorta líneas con
      // marca "..." al final.
      pageBody.setStyle({
        fontFamily: SERIF_STACK,
        fontSize: '12px',
        color: '#2a1810',
        align: 'center',
        wordWrap: { width: PW - 48, useAdvancedWrap: true },
      });
      pageBody.setLineSpacing(3);
      pageBody.setText(p.body);
      const sizes = ['12px', '11px', '10px', '9px'];
      const spacings = [3, 3, 2, 2];
      for (let i = 0; i < sizes.length; i++) {
        pageBody.setFontSize(sizes[i]);
        pageBody.setLineSpacing(spacings[i]);
        if (pageBody.height <= BODY_MAX_HEIGHT) break;
      }
      pageNum.setText(pageIdx + 1 + ' / ' + chapter.pages.length);
      // Sigilo: limpiar previos y dibujar el de esta página si hay.
      for (const o of sigilGroup) o.destroy();
      sigilGroup = [];
      if (p.sigil) {
        // S2: sigilo en zona dedicada — esquina inferior izquierda
        // del libro, sobre el page-num. NUNCA encima del body. Si la
        // página tiene mucho cuerpo, la zona sigue libre porque el
        // body está anclado arriba.
        const sigilX = cx - PW / 2 + 36;
        const sigilY = cy + PH / 2 - 50;
        sigilGroup = drawSigil(ctx, sigilX, sigilY, p.sigil, DEPTH + 6);
      }
    };
    render();

    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey);
      for (const o of sigilGroup) o.destroy();
      sigilGroup = [];
      [
        dim,
        leather,
        gilt,
        bg,
        spine,
        ornament,
        chapterLabel,
        pageTitle,
        pageBody,
        pageNum,
        hint,
      ].forEach((o) => o.destroy());
      resolve();
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        e.preventDefault();
        pageIdx = (pageIdx - 1 + chapter.pages.length) % chapter.pages.length;
        render();
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        e.preventDefault();
        pageIdx = (pageIdx + 1) % chapter.pages.length;
        render();
      } else if (k === 'Escape' || k === 'Esc') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    ctx.scene.events.once('shutdown', close);
    ctx.scene.events.once('destroy', close);
  });
}

// ─── WARDROBE PLACEHOLDER ────────────────────────────────────────────

export const wardrobeHandler: InteractionHandler = async (ctx) => {
  await ctx.showDialog(
    [
      '*abres el armario.*',
      '"toda mi ropa, hecha pasillo."',
      '*hay un cartel pegado por dentro:*',
      '"PRÓXIMAMENTE: aquí podrás vestirte tú misma."',
      '*sonríes y cierras.*',
    ],
    { speaker: 'María', portrait: 'maria' },
  );
};

// ─── SIGIL RENDERER (procedural) ─────────────────────────────────────

/**
 * Pinta un sigilo decorativo (símbolo esotérico) usando primitivas
 * Phaser. Devuelve el array de objetos creados para destruirlos al
 * cambiar de página.
 */
function drawSigil(
  ctx: InteractionContext,
  cx: number,
  cy: number,
  kind: SigilKind,
  depth: number,
): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const inkColor = 0x4a2818; // tinta marrón vieja
  const accentColor = 0xb91c1c;

  const add = (o: Phaser.GameObjects.GameObject) => {
    (o as Phaser.GameObjects.Image).setScrollFactor?.(0);
    (o as Phaser.GameObjects.Image).setDepth?.(depth);
    out.push(o);
    return o;
  };

  switch (kind) {
    case 'pentacle': {
      // Estrella 5 puntas dentro de círculo.
      const r = 14;
      const points: number[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const radius = i % 2 === 0 ? r : r * 0.5;
        points.push(cx + Math.cos(angle) * radius);
        points.push(cy + Math.sin(angle) * radius);
      }
      add(ctx.scene.add.polygon(0, 0, points, 0x000000, 0).setStrokeStyle(1.5, inkColor, 1).setOrigin(0, 0));
      add(ctx.scene.add.circle(cx, cy, r + 2, 0x000000, 0).setStrokeStyle(1, inkColor, 1));
      break;
    }
    case 'eye': {
      // Triángulo con ojo dentro.
      add(
        ctx.scene.add
          .triangle(cx, cy, 0, -16, -18, 12, 18, 12, 0x000000, 0)
          .setStrokeStyle(1.5, inkColor, 1),
      );
      // Iris.
      add(ctx.scene.add.circle(cx, cy + 1, 4, 0xfafaf5, 1).setStrokeStyle(1, inkColor, 1));
      add(ctx.scene.add.circle(cx, cy + 1, 2, inkColor, 1));
      // Rayos.
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * (Math.PI / 6) - Math.PI / 6;
        add(
          ctx.scene.add
            .line(0, 0, cx + Math.cos(a) * 18, cy + Math.sin(a) * 18, cx + Math.cos(a) * 24, cy + Math.sin(a) * 24, inkColor, 1)
            .setLineWidth(1)
            .setOrigin(0, 0),
        );
      }
      break;
    }
    case 'caduceus': {
      // Vara central con dos serpientes simplificadas.
      add(ctx.scene.add.line(0, 0, cx, cy - 18, cx, cy + 14, inkColor, 1).setLineWidth(1.5).setOrigin(0, 0));
      // Alas en la cima.
      add(ctx.scene.add.line(0, 0, cx, cy - 18, cx - 10, cy - 22, inkColor, 1).setLineWidth(1).setOrigin(0, 0));
      add(ctx.scene.add.line(0, 0, cx, cy - 18, cx + 10, cy - 22, inkColor, 1).setLineWidth(1).setOrigin(0, 0));
      // Bola superior.
      add(ctx.scene.add.circle(cx, cy - 18, 2.5, inkColor, 1));
      // Serpientes (zig-zag).
      for (let i = 0; i < 4; i++) {
        const y0 = cy - 12 + i * 7;
        const y1 = cy - 8 + i * 7;
        add(ctx.scene.add.line(0, 0, cx - 6, y0, cx + 6, y1, inkColor, 1).setLineWidth(1).setOrigin(0, 0));
        add(ctx.scene.add.line(0, 0, cx + 6, y0, cx - 6, y1, inkColor, 1).setLineWidth(1).setOrigin(0, 0));
      }
      break;
    }
    case 'hexagram': {
      // Estrella de 6 puntas (dos triángulos superpuestos).
      const r = 14;
      add(
        ctx.scene.add
          .triangle(cx, cy, 0, -r, -r * 0.866, r * 0.5, r * 0.866, r * 0.5, 0x000000, 0)
          .setStrokeStyle(1.2, inkColor, 1),
      );
      add(
        ctx.scene.add
          .triangle(cx, cy, 0, r, -r * 0.866, -r * 0.5, r * 0.866, -r * 0.5, 0x000000, 0)
          .setStrokeStyle(1.2, inkColor, 1),
      );
      add(ctx.scene.add.circle(cx, cy, r + 3, 0x000000, 0).setStrokeStyle(1, inkColor, 1));
      break;
    }
    case 'cross-rose': {
      // Cruz vertical + horizontal con rosa en el centro.
      add(ctx.scene.add.line(0, 0, cx, cy - 16, cx, cy + 16, inkColor, 1).setLineWidth(1.8).setOrigin(0, 0));
      add(ctx.scene.add.line(0, 0, cx - 12, cy, cx + 12, cy, inkColor, 1).setLineWidth(1.8).setOrigin(0, 0));
      // Rosa: 3 círculos concéntricos.
      add(ctx.scene.add.circle(cx, cy, 5, accentColor, 1));
      add(ctx.scene.add.circle(cx, cy, 3, 0xfafaf5, 1));
      add(ctx.scene.add.circle(cx, cy, 1.5, accentColor, 1));
      break;
    }
    case 'tetragramaton': {
      // Las 4 letras hebreas YHVH como texto serif rojo.
      add(
        ctx.scene.add
          .text(cx, cy, 'יהוה', {
            fontFamily: SERIF_STACK,
            fontSize: '24px',
            color: '#b91c1c',
            fontStyle: 'bold',
          })
          .setOrigin(0.5, 0.5),
      );
      // Marco de hexagrama alrededor.
      add(ctx.scene.add.circle(cx, cy + 2, 18, 0x000000, 0).setStrokeStyle(1, inkColor, 1));
      break;
    }
    case 'tree-life': {
      // 10 sefirot — círculos pequeños conectados por líneas.
      // Layout simplificado.
      const layout = [
        { x: 0, y: -22 }, // Kéter
        { x: -10, y: -12 }, // Biná
        { x: 10, y: -12 }, // Jojmá
        { x: -10, y: -2 }, // Gevurá
        { x: 10, y: -2 }, // Jésed
        { x: 0, y: 6 }, // Tiféret
        { x: -10, y: 14 }, // Hod
        { x: 10, y: 14 }, // Nétsaj
        { x: 0, y: 22 }, // Yesod
        { x: 0, y: 30 }, // Maljut
      ];
      for (const p of layout) {
        add(ctx.scene.add.circle(cx + p.x, cy + p.y, 3, 0xfafaf5, 1).setStrokeStyle(1, inkColor, 1));
      }
      // Líneas (algunas conexiones representativas).
      const lines: [number, number][] = [
        [0, 1], [0, 2], [1, 3], [2, 4], [1, 2], [3, 4], [3, 5],
        [4, 5], [5, 6], [5, 7], [6, 7], [6, 8], [7, 8], [5, 8], [8, 9],
      ];
      for (const [a, b] of lines) {
        const pa = layout[a];
        const pb = layout[b];
        add(
          ctx.scene.add
            .line(0, 0, cx + pa.x, cy + pa.y, cx + pb.x, cy + pb.y, inkColor, 0.5)
            .setLineWidth(0.8)
            .setOrigin(0, 0),
        );
      }
      break;
    }
    case 'ouroboros': {
      // Serpiente que se muerde la cola — círculo con detalle "cabeza".
      const r = 16;
      add(ctx.scene.add.circle(cx, cy, r, 0x000000, 0).setStrokeStyle(2, inkColor, 1));
      // Cabeza.
      add(ctx.scene.add.circle(cx + r, cy, 3, inkColor, 1));
      add(ctx.scene.add.circle(cx + r, cy, 1, 0xfafaf5, 1));
      // Escamas (puntos pequeños).
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        add(ctx.scene.add.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, inkColor, 1));
      }
      break;
    }
  }
  return out;
}

// ─── FRIDGE PLACEHOLDER ──────────────────────────────────────────────

export const fridgeHandler: InteractionHandler = async (ctx) => {
  // S2: la nevera abre/cierra animada al interactuar.
  getFurnitureRenderer()?.playOneShot('fridge');
  await ctx.showDialog(
    [
      '*abres la nevera.*',
      '"a ver qué tenemos."',
      '*hay un post-it pegado:*',
      '"PRÓXIMAMENTE: mini-overcooked en esta nevera."',
      '"...vale, vale. ya lo hará."',
      '*cierras y suspiras.*',
    ],
    { speaker: 'María', portrait: 'maria' },
  );
};
