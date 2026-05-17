import * as Phaser from 'phaser';
import { useProgressStore } from '../../lib/stores/gameStore';

/**
 * IntroScene — apertura narrativa del juego.
 *
 * Pantalla 1 (match): un mock cutre de partida LoL. María está muerta
 *                     esperando respawn. Arriba: reloj + score. Centro:
 *                     "ESPERANDO RESPAWN" + countdown. Derecha-arriba:
 *                     minimap con bolitas. Abajo: scoreboard cutre y
 *                     chat con kill feed + trash talk rodando.
 *
 * Pantalla 2 (surrender): popup de rendición con timer. El jugador vota
 *                         SÍ o NO (clic o teclas Y/N/S). La votación se
 *                         decide dramáticamente en contra, independiente-
 *                         mente de la elección de la jugadora.
 *
 * Pantalla 3 (defeat): pantalla roja DEFEAT + chat con flames.
 *
 * Pantalla 4 (dialogue): línea de María "Vaya mierda..."
 *
 * Luego fade-out → LetterScene (o directamente HubScene si no tengo la
 * scene intermedia montada).
 *
 * Filosofía "cutre consciente": mezcla intencional de estilos tipográficos
 * y colores chillones. No buscamos fidelidad a Riot Games (sería fraude y
 * poco divertido). Buscamos que reconozca el FEELING de estar en una
 * partida perdida, con la frustración de sus amigas. Es el portal emocional
 * para abrir la carta del piso.
 */
export class IntroScene extends Phaser.Scene {
  private phase: 'match' | 'surrender' | 'voting' | 'defeat' | 'dialog' | 'fadeout' = 'match';

  // Grupos para teardown en transición de pantallas.
  private matchLayer!: Phaser.GameObjects.Container;
  private surrenderLayer?: Phaser.GameObjects.Container;
  private defeatLayer?: Phaser.GameObjects.Container;
  private dialogLayer?: Phaser.GameObjects.Container;

  // Elementos animados del match
  private respawnText!: Phaser.GameObjects.Text;
  private matchClockText!: Phaser.GameObjects.Text;
  private chatLines: Phaser.GameObjects.Text[] = [];

  private respawnSeconds = 14;
  private matchSeconds = 24 * 60 + 13; // arranca en 24:13
  private tickTimer?: Phaser.Time.TimerEvent;
  private chatTimer?: Phaser.Time.TimerEvent;

  // Kill feed / chat trash talk. Rueda con chatTimer.
  private readonly TRASH_TALK = [
    '[EQUIPO] Arya_M4in: jg diff',
    '[EQUIPO] Arya_M4in: jinx ff',
    '[EQUIPO] xLupita_07: reportadme al sup',
    '[TODO] LanBerlioz: ez',
    '[TODO] LanBerlioz: :)',
    '[EQUIPO] Arya_M4in: ff15 ya',
    '[EQUIPO] xLupita_07: jinx lvl 9 y 0/4',
    '[TODO] Plumitas99: gg wp',
    '[EQUIPO] rodoloco: me voy a torre',
    '[EQUIPO] Arya_M4in: reportad a jinx',
    '[EQUIPO] xLupita_07: MARÍA QUE HACES',
  ];

  constructor() {
    super({ key: 'IntroScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#05060a');

    this.buildMatchLayer();
    this.startMatchPhase();

    // Tecla DEV: SPACE salta instantáneamente a Hub (útil para debug,
    // no documentado al jugador). Q también salta toda la secuencia.
    const kb = this.input.keyboard;
    if (kb) {
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q).on('down', () => this.skipToHub());
    }
  }

  // ---------- PHASE: MATCH ----------

  private buildMatchLayer(): void {
    this.matchLayer = this.add.container(0, 0).setDepth(10);

    // Top bar: score + reloj
    const topBar = this.add
      .rectangle(240, 8, 480, 16, 0x0b0e1f, 0.95)
      .setOrigin(0.5, 0.5);
    this.matchLayer.add(topBar);

    // Azul 8 — 22 Rojo (masacre). Colores de la tipo placeholders.
    const blueScore = this.add
      .text(180, 8, '8', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '11px',
        color: '#4ea0ff',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);
    this.matchLayer.add(blueScore);

    this.matchClockText = this.add
      .text(240, 8, this.formatClock(this.matchSeconds), {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#e2a83e',
      })
      .setOrigin(0.5, 0.5);
    this.matchLayer.add(this.matchClockText);

    const redScore = this.add
      .text(300, 8, '22', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '11px',
        color: '#ff4e4e',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    this.matchLayer.add(redScore);

    // Minimap arriba-derecha
    const mapBg = this.add
      .rectangle(420, 48, 108, 70, 0x0b0e1f, 0.95)
      .setStrokeStyle(1, 0xe2a83e, 0.9)
      .setOrigin(0.5, 0.5);
    this.matchLayer.add(mapBg);
    // Líneas de carriles cutres
    const mg = this.add.graphics();
    mg.lineStyle(1, 0x2a2e40, 1);
    mg.lineBetween(370, 80, 470, 20);
    mg.lineBetween(370, 50, 470, 50);
    mg.lineBetween(370, 20, 470, 80);
    this.matchLayer.add(mg);

    // 5 enemigos rojos desperdigados (concentrados en medio, señal mala)
    for (let i = 0; i < 5; i++) {
      const rx = 410 + Math.random() * 20;
      const ry = 40 + Math.random() * 20;
      const e = this.add.circle(rx, ry, 2, 0xff4e4e).setStrokeStyle(1, 0xffffff, 0.5);
      this.matchLayer.add(e);
    }
    // 4 aliados azules dispersos, uno caído (gris, María)
    const allies = [
      { x: 375, y: 70, dead: false },
      { x: 390, y: 40, dead: false },
      { x: 465, y: 30, dead: false },
      { x: 400, y: 62, dead: false },
      { x: 430, y: 78, dead: true }, // María muerta
    ];
    for (const a of allies) {
      const c = this.add
        .circle(a.x, a.y, 2, a.dead ? 0x555566 : 0x4ea0ff)
        .setStrokeStyle(1, 0xffffff, a.dead ? 0.4 : 0.7);
      if (a.dead) c.setAlpha(0.6);
      this.matchLayer.add(c);
    }

    // Centro: mensaje de muerta
    const centerPanel = this.add
      .rectangle(240, 130, 280, 60, 0x0b0e1f, 0.6)
      .setStrokeStyle(1, 0x888888, 0.2);
    this.matchLayer.add(centerPanel);

    const deadLabel = this.add
      .text(240, 115, 'HAS SIDO ELIMINADA', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '14px',
        color: '#ff5c5c',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    this.matchLayer.add(deadLabel);

    this.respawnText = this.add
      .text(240, 138, `RESPAWN EN ${this.respawnSeconds}`, {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#c0c4d0',
      })
      .setOrigin(0.5, 0.5);
    this.matchLayer.add(this.respawnText);

    const mariaLabel = this.add
      .text(240, 152, 'Jinx · 2/7/1', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#4ea0ff',
      })
      .setOrigin(0.5, 0.5);
    this.matchLayer.add(mariaLabel);

    // Scoreboard izq-abajo (5v5 nombres cutres)
    const sbBg = this.add
      .rectangle(84, 218, 160, 88, 0x0b0e1f, 0.95)
      .setStrokeStyle(1, 0x2a2e40, 0.9);
    this.matchLayer.add(sbBg);
    const sbTitle = this.add
      .text(84, 182, 'TU EQUIPO', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#4ea0ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    this.matchLayer.add(sbTitle);
    const team = [
      { champ: 'Jinx', name: 'María (tú)', k: 2, d: 7, a: 1, color: '#c0c4d0', me: true },
      { champ: 'Braum', name: 'Arya_M4in', k: 1, d: 6, a: 3, color: '#c0c4d0' },
      { champ: 'Shen', name: 'xLupita_07', k: 2, d: 5, a: 2, color: '#c0c4d0' },
      { champ: 'Yasuo', name: 'rodoloco', k: 1, d: 4, a: 0, color: '#c0c4d0' },
      { champ: 'Lux', name: 'MiniPulpo', k: 2, d: 5, a: 1, color: '#c0c4d0' },
    ];
    team.forEach((p, i) => {
      const y = 192 + i * 10;
      const row = this.add
        .text(
          14,
          y,
          `${p.champ.padEnd(8, ' ')} ${p.name.padEnd(12, ' ')} ${p.k}/${p.d}/${p.a}`,
          {
            fontFamily: "'Silkscreen', monospace",
            fontSize: '7px',
            color: p.me ? '#e2a83e' : p.color,
          },
        )
        .setOrigin(0, 0.5);
      this.matchLayer.add(row);
    });

    // Chat der-abajo (kill feed + trash talk)
    const chatBg = this.add
      .rectangle(360, 218, 220, 88, 0x0b0e1f, 0.95)
      .setStrokeStyle(1, 0x2a2e40, 0.9);
    this.matchLayer.add(chatBg);
    const chatTitle = this.add
      .text(360, 182, 'CHAT / KILL FEED', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#888a99',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    this.matchLayer.add(chatTitle);

    // 6 líneas vacías (se van rellenando con chatTimer)
    for (let i = 0; i < 6; i++) {
      const t = this.add
        .text(256, 192 + i * 10, '', {
          fontFamily: "'Silkscreen', monospace",
          fontSize: '7px',
          color: '#c0c4d0',
        })
        .setOrigin(0, 0.5);
      this.chatLines.push(t);
      this.matchLayer.add(t);
    }
  }

  private startMatchPhase(): void {
    this.phase = 'match';

    // Tick del reloj de partida + countdown respawn.
    this.tickTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.matchSeconds += 1;
        this.matchClockText.setText(this.formatClock(this.matchSeconds));
        this.respawnSeconds = Math.max(0, this.respawnSeconds - 1);
        this.respawnText.setText(
          this.respawnSeconds > 0 ? `RESPAWN EN ${this.respawnSeconds}` : 'RESPAWN LISTO',
        );
      },
    });

    // Trash talk rolling.
    let chatIdx = 0;
    this.chatTimer = this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        this.pushChatLine(this.TRASH_TALK[chatIdx % this.TRASH_TALK.length]);
        chatIdx++;
      },
    });

    // Tras ~7 segundos, salta al popup de surrender.
    this.time.delayedCall(7000, () => this.startSurrenderPhase());
  }

  private pushChatLine(line: string): void {
    // Scroll arriba: todas las líneas suben una posición, la última es nueva.
    for (let i = 0; i < this.chatLines.length - 1; i++) {
      this.chatLines[i].setText(this.chatLines[i + 1].text);
      this.chatLines[i].setColor(this.chatLines[i + 1].style.color as string);
    }
    const last = this.chatLines[this.chatLines.length - 1];
    last.setText(line);
    // Color por canal
    if (line.startsWith('[TODO]')) last.setColor('#c0c4d0');
    else if (line.includes('MARÍA')) last.setColor('#ff5c5c');
    else last.setColor('#4ea0ff');
  }

  // ---------- PHASE: SURRENDER ----------

  private startSurrenderPhase(): void {
    this.phase = 'surrender';

    // Dim background
    const dim = this.add
      .rectangle(240, 135, 480, 270, 0x000000, 0.55)
      .setDepth(50);

    this.surrenderLayer = this.add.container(0, 0).setDepth(60);
    this.surrenderLayer.add(dim);

    const panel = this.add
      .rectangle(240, 135, 260, 110, 0x0b0e1f, 0.98)
      .setStrokeStyle(2, 0xe2a83e, 1)
      .setOrigin(0.5, 0.5);
    this.surrenderLayer.add(panel);

    const title = this.add
      .text(240, 100, 'VOTACIÓN DE RENDICIÓN', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#e2a83e',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    this.surrenderLayer.add(title);

    const sub = this.add
      .text(240, 116, 'Arya_M4in ha solicitado rendirse', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#c0c4d0',
      })
      .setOrigin(0.5, 0.5);
    this.surrenderLayer.add(sub);

    const tally = this.add
      .text(240, 132, '3 / 5 · faltan 2 votos', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '8px',
        color: '#888a99',
      })
      .setOrigin(0.5, 0.5);
    this.surrenderLayer.add(tally);

    // Botones SÍ / NO
    const yesBtn = this.add
      .rectangle(200, 160, 60, 20, 0x1a6b2a, 1)
      .setStrokeStyle(1, 0x4eff77, 1)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });
    const yesLbl = this.add
      .text(200, 160, 'SÍ (Y)', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '9px',
        color: '#4eff77',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    this.surrenderLayer.add(yesBtn);
    this.surrenderLayer.add(yesLbl);

    const noBtn = this.add
      .rectangle(280, 160, 60, 20, 0x6b1a1a, 1)
      .setStrokeStyle(1, 0xff6a6a, 1)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });
    const noLbl = this.add
      .text(280, 160, 'NO (N)', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '9px',
        color: '#ff6a6a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    this.surrenderLayer.add(noBtn);
    this.surrenderLayer.add(noLbl);

    const hint = this.add
      .text(240, 186, 'haz click o pulsa Y / N — tú decides', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '7px',
        color: '#888a99',
        fontStyle: 'italic',
      })
      .setOrigin(0.5, 0.5);
    this.surrenderLayer.add(hint);

    // El voto NO timeoutea — esperamos input del jugador siempre. Aunque la
    // narrativa ya está escrita (el equipo vota sí dramáticamente da igual
    // qué elija), la JUGADORA debe pulsar algo para que la escena avance.
    // Ese acto de elegir, aunque inútil, es el gesto emocional que abre la
    // puerta al resto del juego. Sin él, no hay portal.
    const onVote = () => this.onVoteCast();
    yesBtn.on('pointerdown', onVote);
    noBtn.on('pointerdown', onVote);
    const kb = this.input.keyboard;
    if (kb) {
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.Y).once('down', onVote);
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.N).once('down', onVote);
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.S).once('down', onVote);
    }

    // Pulso visual del hint para enfatizar que esperamos input.
    this.tweens.add({
      targets: hint,
      alpha: { from: 0.5, to: 1 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private onVoteCast(): void {
    if (this.phase !== 'surrender') return;
    this.phase = 'voting';

    // Anima el contador: 4/5 → 5/5 dramático, con chat rageando.
    const tallyText = (this.surrenderLayer?.list.find(
      (go) =>
        go instanceof Phaser.GameObjects.Text &&
        (go as Phaser.GameObjects.Text).text.includes('/ 5'),
    ) as Phaser.GameObjects.Text | undefined);

    if (tallyText) tallyText.setText('4 / 5 · falta 1 voto');

    this.pushChatLine('[EQUIPO] Arya_M4in: voooota');
    this.pushChatLine('[EQUIPO] xLupita_07: ff YA');

    this.time.delayedCall(1200, () => {
      if (tallyText) tallyText.setText('5 / 5 · RENDIDAS');
      this.pushChatLine('[EQUIPO] rodoloco: gg');
      this.pushChatLine('[TODO] LanBerlioz: ez report jinx');
    });

    this.time.delayedCall(2800, () => this.startDefeatPhase());
  }

  // ---------- PHASE: DEFEAT ----------

  private startDefeatPhase(): void {
    this.phase = 'defeat';
    this.tickTimer?.remove();
    this.chatTimer?.remove();

    this.matchLayer.setAlpha(0.2);
    this.surrenderLayer?.destroy();
    this.surrenderLayer = undefined;

    this.defeatLayer = this.add.container(0, 0).setDepth(100);

    const bg = this.add
      .rectangle(240, 135, 480, 270, 0x1a0505, 0.96)
      .setOrigin(0.5, 0.5);
    this.defeatLayer.add(bg);

    // DERROTA enorme con stroke rojo.
    const defeat = this.add
      .text(240, 110, 'DERROTA', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '44px',
        color: '#ff3333',
        fontStyle: 'bold',
        stroke: '#660000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0);
    this.defeatLayer.add(defeat);

    this.tweens.add({
      targets: defeat,
      alpha: 1,
      scale: { from: 1.4, to: 1 },
      duration: 600,
      ease: 'Back.easeOut',
    });

    const sub = this.add
      .text(240, 160, 'LP: -28   ·   MMR: bajando', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '11px',
        color: '#ff8888',
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0);
    this.defeatLayer.add(sub);

    this.tweens.add({
      targets: sub,
      alpha: 1,
      duration: 400,
      delay: 700,
    });

    // Tras 2.5s, pasa a diálogo María.
    this.time.delayedCall(2500, () => this.startDialoguePhase());
  }

  // ---------- PHASE: DIALOGUE ----------

  private startDialoguePhase(): void {
    this.phase = 'dialog';
    this.dialogLayer = this.add.container(0, 0).setDepth(200);

    // Oscurece más
    const dim = this.add.rectangle(240, 135, 480, 270, 0x000000, 0.5).setOrigin(0.5, 0.5);
    this.dialogLayer.add(dim);

    // Panel de diálogo manual (no reutilizo DialogSystem porque aquí
    // no tengo escena 'casa' todavía; además quiero estilo propio
    // del intro con fuente más dramática).
    const panel = this.add
      .rectangle(240, 220, 420, 62, 0x0b0c10, 0.96)
      .setStrokeStyle(2, 0xe2a83e, 1)
      .setOrigin(0.5, 0.5);
    this.dialogLayer.add(panel);

    const speaker = this.add
      .text(48, 195, 'MARÍA', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '9px',
        color: '#e2a83e',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0);
    this.dialogLayer.add(speaker);

    const text = this.add
      .text(48, 212, '', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '11px',
        color: '#ffffff',
        wordWrap: { width: 384 },
      })
      .setOrigin(0, 0);
    this.dialogLayer.add(text);

    const line = 'Vaya mierda de partida...';
    let idx = 0;
    const tw = this.time.addEvent({
      delay: 40,
      repeat: line.length - 1,
      callback: () => {
        idx++;
        text.setText(line.substring(0, idx));
      },
    });

    // Indicador continuar
    const cont = this.add
      .text(440, 240, '\u25BC', {
        fontFamily: "'Silkscreen', monospace",
        fontSize: '10px',
        color: '#e2a83e',
      })
      .setOrigin(1, 1)
      .setAlpha(0);
    this.dialogLayer.add(cont);

    this.time.delayedCall(line.length * 40 + 400, () => {
      this.tweens.add({
        targets: cont,
        alpha: { from: 0.3, to: 1 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    });

    // SPACE/ENTER/clic → fade-out al hub.
    const kb = this.input.keyboard;
    const advance = () => {
      if (this.phase !== 'dialog') return;
      tw.remove();
      text.setText(line);
      this.time.delayedCall(300, () => this.startFadeoutPhase());
    };
    if (kb) {
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).once('down', advance);
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).once('down', advance);
    }
    this.input.once('pointerdown', advance);
  }

  // ---------- PHASE: FADEOUT → HUB ----------

  private startFadeoutPhase(): void {
    this.phase = 'fadeout';
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      useProgressStore.getState().markIntroPlayed();
      this.scene.start('HubScene');
    });
  }

  private skipToHub(): void {
    useProgressStore.getState().markIntroPlayed();
    this.scene.start('HubScene');
  }

  // ---------- helpers ----------

  private formatClock(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
