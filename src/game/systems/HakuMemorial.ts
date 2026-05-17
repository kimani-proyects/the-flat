import * as Phaser from 'phaser';
import { FONT_STACK } from './TextStyle';

/**
 * Memorial de Haku — S2.8 (rework).
 *
 * Haku fue el gato real de Alex y María. Era alegre, dado al cariño
 * constante, recibía a María en la puerta cada vez que volvía a casa.
 * Murió antes del cumpleaños 2026.
 *
 * Pieza por pieza:
 *
 *   1. **Bienvenida al spawn**: cuando ApartmentScene arranca, Haku
 *      aparece junto a la puerta principal sentado (cat-sit), con
 *      bocadillo legible — fondo sólido + borde + texto contrastado.
 *      Tras ~4s desaparece con fade. Una de 12 frases al azar.
 *
 *   2. **Spot favorito** en el pie de la cama de María (sutil).
 *
 *   3. **Ronroneos / miaus ambientales** vía WebAudio cada 50-120s.
 *      Variedad: purr, meow corto, meow largo, scratch.
 */

const TILE = 16;
const HAKU_TILE_X_DOOR = 19;
const HAKU_TILE_Y_DOOR = 28;
const HAKU_TILE_X_BED = 45;
const HAKU_TILE_Y_BED = 13;

const HAKU_WELCOME_PHRASES = [
  '"hola, María. te esperaba aquí."',
  '"sigo viniendo a recibirte. lo prometí."',
  '"qué hambre tenía de verte, otra vez."',
  '"miau. (te quiero, en gatuno)."',
  '"déjame mirarte un rato, anda."',
  '"tu mochila huele a calle. cuéntame."',
  '"si los gatos no dan amor, alguien no me conoció."',
  '"estoy aquí, en el juego, y en el otro sitio también."',
  '"tienes los ojos cansados. siéntate."',
  '"siempre que entras, yo aparezco. ese era el trato."',
  '"vengo a saludarte. incluso aquí, en el juego."',
  '"prrr. (eso era importante, no me ignores)."',
];

/** Spawn de Haku-bienvenida usando su sprite real si existe. */
export function installHakuMemorial(scene: Phaser.Scene): { destroy: () => void } {
  const created: Array<Phaser.GameObjects.GameObject | Phaser.Time.TimerEvent> = [];

  // ─── 1. Welcome Haku ─────────────────────────────────────────────
  // Spawn 1.5s after scene create — el sprite real con scale del gato.
  const welcomeTimer = scene.time.delayedCall(1500, () => {
    const wx = HAKU_TILE_X_DOOR * TILE + TILE / 2;
    const wy = HAKU_TILE_Y_DOOR * TILE + TILE / 2;
    const DEPTH = 24;

    let hakuSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics | null = null;
    if (scene.textures.exists('haku-idle')) {
      const spr = scene.add.sprite(wx, wy, 'haku-idle', 0).setOrigin(0.5, 0.7);
      spr.setScale(1);
      spr.setDepth(DEPTH);
      spr.setTint(0xfff4d6);
      // Sit-idle preferido. Fallback a 'haku-sit' y luego 'haku-idle'.
      try {
        if (scene.anims.exists('haku-sit-idle')) spr.play('haku-sit-idle');
        else if (scene.anims.exists('haku-sit')) spr.play('haku-sit');
        else if (scene.anims.exists('haku-idle')) spr.play('haku-idle');
      } catch { /* ignore */ }
      hakuSprite = spr;
    } else {
      const g = scene.add.graphics();
      g.setDepth(DEPTH);
      g.fillStyle(0xfff4d6, 1).fillEllipse(wx, wy + 1, 14, 9);
      g.fillStyle(0xfff4d6, 1).fillEllipse(wx + 5, wy - 3, 9, 8);
      g.fillStyle(0x1a0e08, 1).fillCircle(wx + 3, wy - 3, 1);
      g.fillStyle(0x1a0e08, 1).fillCircle(wx + 7, wy - 3, 1);
      hakuSprite = g;
    }
    created.push(hakuSprite);

    // Nombre flotante encima del gato.
    const name = scene.add.text(wx, wy - 22, 'Haku', {
      fontFamily: FONT_STACK, fontSize: '7px', color: '#fff4d6', fontStyle: 'bold italic',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(DEPTH + 2).setAlpha(0);
    created.push(name);

    // S2.9: Bocadillo AL LADO (derecha del gato), no debajo. Auto-altura
    // según el texto. Padding 6px todo alrededor.
    const phrase = HAKU_WELCOME_PHRASES[Math.floor(Math.random() * HAKU_WELCOME_PHRASES.length)];
    const BUBBLE_W = 130;
    const BUBBLE_PAD_X = 8;
    const BUBBLE_PAD_Y = 6;
    // Creamos el texto primero para medir su altura real.
    const phraseText = scene.add.text(0, 0, phrase, {
      fontFamily: FONT_STACK, fontSize: '8px', color: '#fff4d6', fontStyle: 'bold',
      align: 'left', wordWrap: { width: BUBBLE_W - BUBBLE_PAD_X * 2, useAdvancedWrap: true },
      lineSpacing: 3,
    }).setOrigin(0, 0).setDepth(DEPTH + 3).setAlpha(0);
    const textH = phraseText.height;
    const bubbleH = textH + BUBBLE_PAD_Y * 2;
    // Bocadillo a la DERECHA del gato. Origin top-left para que crezca
    // hacia abajo predecible. Si se saliera del lado derecho, lo flip
    // al lado izquierdo.
    let bubbleX = wx + 12; // 12px a la derecha del centro del gato
    const cam = scene.cameras.main;
    const mapW = cam ? cam.getBounds().width : 768;
    if (bubbleX + BUBBLE_W > mapW - 4) {
      // Flip a la izquierda del gato.
      bubbleX = wx - 12 - BUBBLE_W;
    }
    const bubbleY = wy - bubbleH / 2 - 4; // centrado verticalmente respecto al gato
    const bubbleBg = scene.add.rectangle(bubbleX - 2, bubbleY - 2, BUBBLE_W + 4, bubbleH + 4, 0x1a0e08, 0.96)
      .setStrokeStyle(2, 0xfbbf24, 1)
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1).setAlpha(0);
    const bubbleInner = scene.add.rectangle(bubbleX, bubbleY, BUBBLE_W, bubbleH, 0x2a1810, 1)
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2).setAlpha(0);
    phraseText.setPosition(bubbleX + BUBBLE_PAD_X, bubbleY + BUBBLE_PAD_Y);
    // Tip (colita) apuntando al gato, en el lado de la caja que toca.
    const tipFromRight = bubbleX > wx;
    const tipX = tipFromRight ? bubbleX : (bubbleX + BUBBLE_W);
    const tipY = wy - 4;
    const tipDir = tipFromRight ? -1 : 1;
    const bubbleTip = scene.add.triangle(
      tipX, tipY,
      0, -4,
      tipDir * 6, 0,
      0, 4,
      0x1a0e08, 1,
    ).setDepth(DEPTH + 2).setAlpha(0).setStrokeStyle(2, 0xfbbf24, 1);
    created.push(bubbleBg, bubbleInner, bubbleTip, phraseText);

    scene.tweens.add({
      targets: [name, bubbleBg, bubbleInner, bubbleTip, phraseText],
      alpha: 1,
      duration: 600,
      ease: 'Quad.easeOut',
    });

    if ((hakuSprite as Phaser.GameObjects.Sprite).setScale) {
      scene.tweens.add({
        targets: hakuSprite,
        scaleY: { from: 1, to: 1.1 },
        duration: 320,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
      });
    }

    scene.time.delayedCall(4500, () => {
      scene.tweens.add({
        targets: [hakuSprite, name, bubbleBg, bubbleInner, bubbleTip, phraseText],
        alpha: 0,
        duration: 900,
        ease: 'Quad.easeIn',
        onComplete: () => {
          if (hakuSprite && (hakuSprite as { scene?: unknown }).scene) hakuSprite.destroy();
          if ((name as { scene?: unknown }).scene) name.destroy();
          if ((bubbleBg as { scene?: unknown }).scene) bubbleBg.destroy();
          if ((bubbleInner as { scene?: unknown }).scene) bubbleInner.destroy();
          if ((bubbleTip as { scene?: unknown }).scene) bubbleTip.destroy();
          if ((phraseText as { scene?: unknown }).scene) phraseText.destroy();
        },
      });
    });
  });
  created.push(welcomeTimer);

  // ─── 2. Spot favorito en cama María ───────────────────────────────
  const wxB = HAKU_TILE_X_BED * TILE + TILE / 2;
  const wyB = HAKU_TILE_Y_BED * TILE + TILE / 2;
  const spot = scene.add.ellipse(wxB, wyB, 10, 6, 0xfbbf24, 0.08)
    .setDepth(7);
  scene.tweens.add({
    targets: spot,
    alpha: { from: 0.04, to: 0.18 },
    duration: 3500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  created.push(spot);

  // ─── 3. Sonidos ambient: variedad ────────────────────────────────
  let audioCtx: AudioContext | null = null;
  const getCtx = (): AudioContext | null => {
    try {
      if (!audioCtx) {
        const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const AC = w.AudioContext || w.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
      }
      return audioCtx;
    } catch { return null; }
  };

  const playPurr = () => {
    const ac = getCtx(); if (!ac) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(28, now);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.2);
    g.gain.linearRampToValueAtTime(0.04, now + 0.7);
    g.gain.linearRampToValueAtTime(0, now + 1.4);
    const lfo = ac.createOscillator();
    lfo.frequency.setValueAtTime(11, now);
    const lfoGain = ac.createGain();
    lfoGain.gain.setValueAtTime(0.025, now);
    lfo.connect(lfoGain).connect(g.gain);
    o.connect(g).connect(ac.destination);
    o.start(now); lfo.start(now);
    o.stop(now + 1.6); lfo.stop(now + 1.6);
  };

  const playMeow = (long = false) => {
    const ac = getCtx(); if (!ac) return;
    const now = ac.currentTime;
    const dur = long ? 0.65 : 0.32;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    // Curva tipo "miaaau" — empieza grave, sube, baja.
    o.frequency.setValueAtTime(380, now);
    o.frequency.linearRampToValueAtTime(720, now + dur * 0.35);
    o.frequency.linearRampToValueAtTime(440, now + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.05);
    g.gain.linearRampToValueAtTime(0.05, now + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    // Filtro pasabajos para que no chille.
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    o.connect(filter).connect(g).connect(ac.destination);
    o.start(now); o.stop(now + dur + 0.05);
  };

  const playScratch = () => {
    const ac = getCtx(); if (!ac) return;
    const now = ac.currentTime;
    // Ruido blanco corto = scratch.
    const bufSize = ac.sampleRate * 0.2;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    const filter = ac.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, now);
    src.connect(filter).connect(g).connect(ac.destination);
    src.start(now); src.stop(now + 0.2);
  };

  const ambientSounds = [
    { fn: playPurr,        weight: 5 },
    { fn: () => playMeow(false), weight: 3 },
    { fn: () => playMeow(true),  weight: 2 },
    { fn: playScratch,     weight: 1 },
  ];
  const pickSound = () => {
    const total = ambientSounds.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const a of ambientSounds) {
      r -= a.weight;
      if (r <= 0) return a.fn;
    }
    return ambientSounds[0].fn;
  };

  const scheduleNext = () => {
    const ms = 50_000 + Math.random() * 70_000;
    const t = scene.time.delayedCall(ms, () => {
      pickSound()();
      scheduleNext();
    });
    created.push(t);
  };
  scheduleNext();

  return {
    destroy: () => {
      for (const o of created) {
        const asTimer = o as unknown as { remove?: (deleted?: boolean) => void; delay?: number };
        if (typeof asTimer.delay === 'number' && typeof asTimer.remove === 'function') {
          asTimer.remove(false);
          continue;
        }
        const asObj = o as Phaser.GameObjects.GameObject;
        if (asObj && (asObj as unknown as { scene?: unknown }).scene) asObj.destroy();
      }
      try { audioCtx?.close(); } catch { /* ignore */ }
    },
  };
}

export function pickHakuSpotMemory(): string {
  const spotMemories = [
    '*el sitio donde Haku dormía siempre.*',
    '"todavía huele un poco a él."',
    '*sonríes despacio.*',
    '"era el único que entendía mis horas raras."',
  ];
  return spotMemories[Math.floor(Math.random() * spotMemories.length)];
}
