import * as Phaser from 'phaser';
import { S, COLORS, FONT_STACK } from './TextStyle';
import { Portraits } from './Portraits';

/**
 * DialogSystem — panel de diálogo con typewriter.
 *
 * Día 6: reemplaza el toast placeholder del Día 5 por un panel real en la
 * parte baja del viewport. Soporta:
 *   - Múltiples páginas (string[]). Cada pulsación de SPACE/ENTER avanza.
 *   - Typewriter: el texto aparece letra a letra. Pulsa SPACE durante el
 *     typewriter para completar la página instantáneamente.
 *   - Speaker opcional (nombre resaltado arriba). Útil para Alex u otros NPCs.
 *   - Cierre mediante Promise: `await dialog.show([...pages])` bloquea hasta
 *     que la jugadora cierra el diálogo. Encaja con InteractionHandler async.
 *
 * El panel está anclado al viewport (scrollFactor=0) igual que el prompt.
 *
 * Controles (registrados internamente, no interfieren con otras teclas):
 *   - SPACE : si typewriter activo → completa la página. Si está completa →
 *             avanza a la siguiente página o cierra.
 *   - ENTER : igual que SPACE (alternativa cómoda con teclados distintos).
 *
 * NOTA: NO usamos E como avance para evitar reabrir el mismo interactable
 *       al cerrar el diálogo (E ya está cableada a InteractionSystem.trigger).
 */

export interface DialogOptions {
  /** Nombre del hablante (p.ej. "Alex"). Si se omite, María habla sola. */
  speaker?: string;
  /**
   * Clave del speaker para mostrar PORTRAIT al lado del texto (Día 8.5).
   * Mapeo en `src/game/systems/Portraits.ts` — actualmente: 'maria',
   * 'alex' (los gatos llegan en Día 8). Si la clave no tiene portrait
   * registrado, se cae a "sólo texto" sin error.
   *
   * Si se omite pero `speaker` está presente, intentamos un match
   * automático: speaker.toLowerCase() → portrait key.
   */
  portrait?: string;
  /** Velocidad del typewriter en chars/segundo. Default 35. */
  charsPerSecond?: number;
}

const PANEL_DEPTH = 1900;

export class DialogSystem {
  private scene: Phaser.Scene;

  private panel!: Phaser.GameObjects.Rectangle;
  private panelShadow!: Phaser.GameObjects.Rectangle;
  private textObj!: Phaser.GameObjects.Text;
  private speakerObj!: Phaser.GameObjects.Text;
  private continueIndicator!: Phaser.GameObjects.Text;
  private continueTween?: Phaser.Tweens.Tween;
  /** Cuadro mini-panel detrás del portrait (Día 8.5). Marco interno. */
  private portraitFrame?: Phaser.GameObjects.Rectangle;
  /** Imagen del portrait actual. Se destruye/reasigna en cada show(). */
  private portraitImg?: Phaser.GameObjects.Image;
  /** Posición base del texto sin portrait (para reset). */
  private textBaseX = 0;
  /** Ancho útil del texto sin portrait (para reset). */
  private textBaseWidth = 0;
  /** Posición base del speaker sin portrait (para reset). */
  private speakerBaseX = 0;

  private pages: string[] = [];
  private currentPageIdx = 0;
  private currentCharIdx = 0;
  private typewriterActive = false;
  private typewriterTimer?: Phaser.Time.TimerEvent;

  private resolve?: () => void;
  private opening = false;

  private keySpace?: Phaser.Input.Keyboard.Key;
  private keyEnter?: Phaser.Input.Keyboard.Key;
  /**
   * Respaldo nativo del navegador (it.5). Algunos minijuegos crean Keys
   * para SPACE con captureEnabled=true, y al cerrarse pueden interferir
   * con el listener Phaser del DialogSystem (los Keys son singletons por
   * keycode dentro de Phaser, así que `removeAllListeners()` en uno
   * borra los listeners del otro). Para que el DialogSystem siempre
   * responda a SPACE/ENTER independientemente de lo que hagan los
   * minijuegos con sus Keys, escuchamos también keydown nativo del
   * navegador.
   */
  private nativeKeyHandler?: (e: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.build();
    this.wireKeys();
  }

  // ---------- construcción ----------

  private build(): void {
    const cam = this.scene.cameras.main;
    const margin = 8;
    // Día 8.5: panel un poco más alto (56→70) para acomodar texto +grande
    // (Silkscreen 11px) y el portrait 32×32 a la izquierda.
    const h = 70;
    const w = cam.width - margin * 2;
    const x = cam.width / 2;
    const y = cam.height - h / 2 - margin;

    // Sombra suave bajo el panel para despegarlo del fondo del juego.
    this.panelShadow = this.scene.add
      .rectangle(x + 1, y + 2, w, h, 0x000000, 0.35)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH - 1)
      .setVisible(false);

    // Panel: dark bg + yellow border (coherente con el prompt).
    this.panel = this.scene.add
      .rectangle(x, y, w, h, 0x0b0c10, 0.94)
      .setStrokeStyle(2, 0xfbbf24, 1)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH)
      .setVisible(false);

    // Marco interno para el portrait (Día 8.5b). Slot 36×52 — antes 36×36
    // sólo cabía el cráneo (16×16). Ahora 16×24 escalado 2× = 32×48
    // (cabeza + hombros) + 2px padding ≈ 36×52.
    const portraitMarginLeft = 8;
    const portraitW = 36;
    const portraitH = 52;
    const portraitCx = x - w / 2 + portraitMarginLeft + portraitW / 2;
    // Ancla el portrait al BORDE INFERIOR del panel — el frame es más
    // alto que el panel (52 > 70?? sí cabe, 70-52=18px de margen) y
    // queda mejor centrado verticalmente.
    const portraitCy = y;
    this.portraitFrame = this.scene.add
      .rectangle(portraitCx, portraitCy, portraitW, portraitH, 0x1a0e08, 1)
      .setStrokeStyle(1, 0xc08a4f, 1)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1)
      .setVisible(false);

    // Posiciones BASE — sin portrait. Cuando hay portrait, las desplazamos
    // a la derecha del slot.
    this.speakerBaseX = x - w / 2 + 8;
    this.textBaseX = x - w / 2 + 10;
    this.textBaseWidth = w - 20;

    // Speaker arriba-izquierda dentro del panel (Silkscreen body bold yellow).
    this.speakerObj = this.scene.add
      .text(this.speakerBaseX, y - h / 2 + 5, '', S.speaker())
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1)
      .setVisible(false);

    // Texto del diálogo (Silkscreen 11px, blanco).
    this.textObj = this.scene.add
      .text(this.textBaseX, y - h / 2 + 22, '', S.dialog({ wordWrap: this.textBaseWidth }))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1)
      .setVisible(false);

    // Indicador de "continuar" (flecha parpadeante abajo-derecha).
    this.continueIndicator = this.scene.add
      .text(x + w / 2 - 8, y + h / 2 - 6, '\u25BC', {
        fontFamily: FONT_STACK,
        fontSize: '10px',
        color: COLORS.yellow,
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1)
      .setVisible(false);
  }

  private wireKeys(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keySpace = kb.addKey(K.SPACE);
    this.keyEnter = kb.addKey(K.ENTER);
    // Dedup wrapper: si Phaser y nativo disparan el mismo keydown, sólo
    // el primero corre (gap < 60ms = duplicado).
    const onAdvance = () => {
      const now = performance.now();
      if (this.lastAdvanceAtMs && now - this.lastAdvanceAtMs < 60) return;
      this.lastAdvanceAtMs = now;
      this.onAdvanceKey();
    };
    this.keySpace.on('down', onAdvance);
    this.keyEnter.on('down', onAdvance);

    // Respaldo nativo (it.5). Un minijuego puede haber capturado SPACE
    // o tirado removeAllListeners sobre la Key compartida; este listener
    // siempre llega.
    this.nativeKeyHandler = (e: KeyboardEvent) => {
      if (!this.isOpen()) return;
      const k = e.key;
      if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        // onAdvance ya tiene dedupe interno con lastAdvanceAtMs.
        onAdvance();
      }
    };
    window.addEventListener('keydown', this.nativeKeyHandler);
  }

  /** Marca temporal para deduplicar Phaser+native double-trigger (it.5). */
  private lastAdvanceAtMs = 0;

  // ---------- API pública ----------

  /**
   * Abre el diálogo y muestra las páginas en orden. Resuelve la promesa
   * cuando la jugadora cierra el diálogo.
   *
   * Acepta string (una página) o string[] (varias).
   */
  show(pages: string | string[], opts: DialogOptions = {}): Promise<void> {
    const list = Array.isArray(pages) ? pages.slice() : [pages];
    return new Promise<void>((resolve) => {
      this.pages = list;
      this.currentPageIdx = 0;
      this.resolve = resolve;
      this.opening = true;

      // Speaker name + color por personaje (Día 8.5).
      if (opts.speaker) {
        // Color del nombre según speaker conocido. Caemos a yellow por defecto.
        const sLower = opts.speaker.toLowerCase();
        let speakerColor = COLORS.yellow;
        if (sLower.includes('alex')) speakerColor = COLORS.alex;
        else if (sLower.includes('maría') || sLower.includes('maria')) speakerColor = COLORS.maria;
        this.speakerObj.setText(opts.speaker).setColor(speakerColor).setVisible(true);
      } else {
        this.speakerObj.setVisible(false);
      }

      // Portrait (Día 8.5). Si la opción `portrait` está, usamos esa
      // clave; si no, intentamos derivar del speaker (toLowerCase).
      this.applyPortrait(opts);

      this.panelShadow.setVisible(true);
      this.panel.setVisible(true);
      this.textObj.setVisible(true);

      // Evita que la misma pulsación que abrió el diálogo lo avance.
      // Damos un pequeño margen antes de activar la escucha de teclado.
      this.scene.time.delayedCall(80, () => {
        this.opening = false;
        this.startPage();
      });
    });
  }

  /**
   * Resuelve y muestra el portrait según `opts.portrait` o (fallback)
   * el `opts.speaker` lowercased. Si no hay registro disponible, oculta
   * el portrait y resetea las posiciones de speaker/text.
   *
   * Cuando hay portrait visible, desplaza el texto y el nombre del
   * speaker a la derecha del cuadro del portrait (slot de 36×36 + 8 de
   * margen → +44px).
   */
  private applyPortrait(opts: DialogOptions): void {
    // Limpia portrait previo si lo había.
    this.portraitImg?.destroy();
    this.portraitImg = undefined;

    let key = opts.portrait;
    if (!key && opts.speaker) {
      const guess = opts.speaker
        .toLowerCase()
        .replace('í', 'i')
        .replace(/[^a-z]/g, '');
      // Sólo aceptamos como fallback si Portraits lo conoce.
      if (Portraits.has(this.scene, guess)) key = guess;
    }

    if (!key || !Portraits.has(this.scene, key)) {
      // Sin portrait — reset posiciones base.
      this.portraitFrame?.setVisible(false);
      this.speakerObj.setX(this.speakerBaseX);
      this.textObj.setX(this.textBaseX);
      this.textObj.setStyle(S.dialog({ wordWrap: this.textBaseWidth }));
      return;
    }

    // Crea el portrait centrado dentro del slot del frame (slot a la
    // izquierda del panel — coordenadas las calculó build()).
    const slotCx = this.portraitFrame!.x;
    const slotCy = this.portraitFrame!.y;
    this.portraitImg = Portraits.create(this.scene, slotCx, slotCy, key) ?? undefined;
    if (this.portraitImg) {
      this.portraitImg.setDepth(PANEL_DEPTH + 2);
    }
    this.portraitFrame?.setVisible(true);

    // Desplaza speaker y texto a la derecha del slot.
    const portraitSlotEndX = this.portraitFrame!.x + this.portraitFrame!.width / 2 + 8;
    this.speakerObj.setX(portraitSlotEndX);
    this.textObj.setX(portraitSlotEndX);
    // Re-calcula word wrap para el ancho restante.
    const cam = this.scene.cameras.main;
    const newWrap = cam.width - 8 - portraitSlotEndX - 10;
    this.textObj.setStyle(S.dialog({ wordWrap: newWrap }));
  }

  /** True si el panel está en pantalla ahora mismo. */
  isOpen(): boolean {
    return this.panel?.visible === true;
  }

  // ---------- interno ----------

  private startPage(): void {
    const page = this.pages[this.currentPageIdx] ?? '';
    this.currentCharIdx = 0;
    this.typewriterActive = true;
    this.continueIndicator.setVisible(false);
    this.stopContinueTween();
    this.textObj.setText('');

    this.typewriterTimer?.remove();
    const speed = 35; // chars/segundo
    const delay = 1000 / speed;

    // Con Phaser TimerEvent, repeat ejecuta el callback N veces adicionales.
    // Queremos que avance len veces (una por cada char). repeat = len-1.
    this.typewriterTimer = this.scene.time.addEvent({
      delay,
      repeat: Math.max(0, page.length - 1),
      callback: () => {
        this.currentCharIdx++;
        this.textObj.setText(page.substring(0, this.currentCharIdx));
        if (this.currentCharIdx >= page.length) {
          this.onPageComplete();
        }
      },
    });

    // Caso edge: página vacía → completar inmediatamente.
    if (page.length === 0) {
      this.onPageComplete();
    }
  }

  private onPageComplete(): void {
    this.typewriterActive = false;
    this.continueIndicator.setVisible(true);
    this.startContinueTween();
  }

  private startContinueTween(): void {
    this.stopContinueTween();
    this.continueTween = this.scene.tweens.add({
      targets: this.continueIndicator,
      alpha: { from: 0.3, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  private stopContinueTween(): void {
    this.continueTween?.stop();
    this.continueTween?.remove();
    this.continueTween = undefined;
    this.continueIndicator.setAlpha(1);
  }

  private onAdvanceKey(): void {
    if (!this.isOpen() || this.opening) return;
    if (this.typewriterActive) {
      this.completeCurrentPage();
    } else {
      this.advance();
    }
  }

  private completeCurrentPage(): void {
    const page = this.pages[this.currentPageIdx] ?? '';
    this.typewriterTimer?.remove();
    this.typewriterTimer = undefined;
    this.textObj.setText(page);
    this.currentCharIdx = page.length;
    this.onPageComplete();
  }

  private advance(): void {
    this.currentPageIdx++;
    if (this.currentPageIdx >= this.pages.length) {
      this.close();
    } else {
      this.startPage();
    }
  }

  private close(): void {
    this.typewriterTimer?.remove();
    this.typewriterTimer = undefined;
    this.stopContinueTween();
    this.typewriterActive = false;

    this.panel.setVisible(false);
    this.panelShadow.setVisible(false);
    this.textObj.setVisible(false);
    this.speakerObj.setVisible(false);
    this.continueIndicator.setVisible(false);
    // Día 8.5: oculta y libera el portrait.
    this.portraitFrame?.setVisible(false);
    this.portraitImg?.destroy();
    this.portraitImg = undefined;

    const resolver = this.resolve;
    this.resolve = undefined;
    // Resuelve en el siguiente tick para que la pulsación que cierra el
    // diálogo no se cuele en un handler encadenado (p.ej. otra interacción).
    this.scene.time.delayedCall(16, () => resolver?.());
  }
}
