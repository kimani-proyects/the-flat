/**
 * SfxBank — biblioteca central de SFX sintetizados (WebAudio).
 *
 * Todos los efectos son procedurales, sin samples — el juego no carga
 * archivos extra. Cada función es safe: si WebAudio falla, devuelve sin
 * crashear. Compartimos un único AudioContext lazy-initialized.
 *
 * Uso:
 *   import { Sfx } from '../systems/SfxBank';
 *   Sfx.unlock();
 *   Sfx.fail();
 *   Sfx.win();
 *   Sfx.meow();
 *   Sfx.click();
 */

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  } catch { return null; }
}

function envelope(ac: AudioContext, gain: GainNode, attack: number, peak: number, decay: number, sustain = 0, release = 0): void {
  const now = ac.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.linearRampToValueAtTime(sustain * peak, now + attack + decay);
  if (release > 0) gain.gain.linearRampToValueAtTime(0, now + attack + decay + release);
}

function tone(opts: { freq: number; type?: OscillatorType; dur: number; gain: number; attack?: number; decay?: number; sweepTo?: number }): void {
  const ac = getCtx(); if (!ac) return;
  const o = ac.createOscillator();
  o.type = opts.type ?? 'sine';
  const now = ac.currentTime;
  o.frequency.setValueAtTime(opts.freq, now);
  if (opts.sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.sweepTo), now + opts.dur);
  const g = ac.createGain();
  const attack = opts.attack ?? 0.005;
  const decay = opts.decay ?? opts.dur - attack;
  envelope(ac, g, attack, opts.gain, decay);
  o.connect(g).connect(ac.destination);
  o.start(now);
  o.stop(now + opts.dur + 0.05);
}

function noise(opts: { dur: number; gain: number; filterType?: BiquadFilterType; filterFreq?: number }): void {
  const ac = getCtx(); if (!ac) return;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * opts.dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  const src = ac.createBufferSource(); src.buffer = buf;
  const g = ac.createGain();
  envelope(ac, g, 0.01, opts.gain, opts.dur - 0.01);
  if (opts.filterType) {
    const f = ac.createBiquadFilter();
    f.type = opts.filterType;
    f.frequency.setValueAtTime(opts.filterFreq ?? 1000, ac.currentTime);
    src.connect(f).connect(g).connect(ac.destination);
  } else {
    src.connect(g).connect(ac.destination);
  }
  src.start();
}

export const Sfx = {
  /** Click UI corto (menús, navegación). */
  click(): void {
    tone({ freq: 800, type: 'square', dur: 0.04, gain: 0.06 });
  },
  /** Confirmación / aceptar. */
  ok(): void {
    tone({ freq: 660, type: 'triangle', dur: 0.08, gain: 0.1, sweepTo: 990 });
  },
  /** Volver atrás / cancelar. */
  back(): void {
    tone({ freq: 440, type: 'triangle', dur: 0.1, gain: 0.08, sweepTo: 220 });
  },
  /** Unlock de puerta — click metálico + ding satisfactorio. */
  unlock(): void {
    tone({ freq: 220, type: 'sawtooth', dur: 0.08, gain: 0.12 });
    setTimeout(() => tone({ freq: 880, type: 'triangle', dur: 0.25, gain: 0.15, sweepTo: 1320 }), 90);
    setTimeout(() => tone({ freq: 1760, type: 'sine', dur: 0.18, gain: 0.08 }), 220);
  },
  /** Fail de minijuego — descenso triste. */
  fail(): void {
    tone({ freq: 440, type: 'sawtooth', dur: 0.18, gain: 0.18, sweepTo: 220 });
    setTimeout(() => tone({ freq: 220, type: 'sawtooth', dur: 0.28, gain: 0.14, sweepTo: 110 }), 180);
  },
  /** Win — fanfarria de 3 notas ascendentes. */
  win(): void {
    tone({ freq: 523, type: 'square', dur: 0.12, gain: 0.16 });   // C5
    setTimeout(() => tone({ freq: 659, type: 'square', dur: 0.12, gain: 0.16 }), 120);   // E5
    setTimeout(() => tone({ freq: 784, type: 'square', dur: 0.22, gain: 0.18 }), 240);   // G5
  },
  /** Sparkle — reveal de algo bonito (regalo, easter egg). */
  sparkle(): void {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => tone({ freq: 1200 + Math.random() * 800, type: 'triangle', dur: 0.08, gain: 0.07 }), i * 60);
    }
  },
  /** Tic-tac single — pasos, contadores. */
  tick(): void {
    tone({ freq: 1200, type: 'square', dur: 0.02, gain: 0.05 });
  },
  /** Page flip — para libro Manly, calendario. */
  pageFlip(): void {
    noise({ dur: 0.18, gain: 0.06, filterType: 'highpass', filterFreq: 3000 });
  },
  /** Type — typewriter para diálogos. */
  type(): void {
    tone({ freq: 600 + Math.random() * 200, type: 'square', dur: 0.015, gain: 0.03 });
  },
  /** Glitch / hack — un trozo de ruido + tono digital. */
  glitch(): void {
    noise({ dur: 0.12, gain: 0.1, filterType: 'bandpass', filterFreq: 800 + Math.random() * 800 });
    setTimeout(() => tone({ freq: 1500 + Math.random() * 500, type: 'square', dur: 0.06, gain: 0.08 }), 50);
  },
  // ── Gatos ──────────────────────────────────────────────────────────
  /** Miau corto. */
  meow(long = false): void {
    const ac = getCtx(); if (!ac) return;
    const now = ac.currentTime;
    const dur = long ? 0.6 : 0.3;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(380, now);
    o.frequency.linearRampToValueAtTime(720, now + dur * 0.35);
    o.frequency.linearRampToValueAtTime(440, now + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.05);
    g.gain.linearRampToValueAtTime(0.05, now + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(1800, now);
    o.connect(filter).connect(g).connect(ac.destination);
    o.start(now); o.stop(now + dur + 0.05);
  },
  /** Purr (ronroneo). */
  purr(): void {
    const ac = getCtx(); if (!ac) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(28, now);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.2);
    g.gain.linearRampToValueAtTime(0.04, now + 0.7);
    g.gain.linearRampToValueAtTime(0, now + 1.4);
    const lfo = ac.createOscillator(); lfo.frequency.setValueAtTime(11, now);
    const lfoGain = ac.createGain(); lfoGain.gain.setValueAtTime(0.025, now);
    lfo.connect(lfoGain).connect(g.gain);
    o.connect(g).connect(ac.destination);
    o.start(now); lfo.start(now);
    o.stop(now + 1.6); lfo.stop(now + 1.6);
  },
  /** Pet — sonido de caricia (pequeño ronroneo agradecido). */
  pet(): void {
    tone({ freq: 480, type: 'triangle', dur: 0.18, gain: 0.06, sweepTo: 720 });
    setTimeout(() => tone({ freq: 720, type: 'triangle', dur: 0.14, gain: 0.05, sweepTo: 480 }), 140);
  },
  /** Toc-toc: F (izq, grave) y J (dcha, agudo) — claramente diferenciables. */
  knock(side: 'L' | 'R'): void {
    tone({ freq: side === 'L' ? 220 : 440, type: 'sine', dur: 0.18, gain: 0.18, decay: 0.16 });
  },
  /** Chocolate sílaba correcta — campanita corta. */
  chocoHit(): void {
    tone({ freq: 880, type: 'triangle', dur: 0.08, gain: 0.12, sweepTo: 1320 });
  },
  /** Chocolate sílaba incorrecta — buzzer corto. */
  chocoMiss(): void {
    tone({ freq: 165, type: 'sawtooth', dur: 0.16, gain: 0.16, sweepTo: 110 });
  },
  /** Lockpick: chasquido metálico al ganzuar. */
  pickClick(): void {
    tone({ freq: 1400, type: 'square', dur: 0.03, gain: 0.1 });
  },
  /** Lockpick: rotura de ganzúa. */
  pickBreak(): void {
    noise({ dur: 0.3, gain: 0.18, filterType: 'bandpass', filterFreq: 400 });
  },
  /** Puerta atascada: golpe seco al avanzar. */
  doorThud(): void {
    tone({ freq: 95, type: 'sine', dur: 0.18, gain: 0.2, decay: 0.16 });
  },
  /** TV on/off: switch click. */
  tvSwitch(): void {
    tone({ freq: 600, type: 'square', dur: 0.04, gain: 0.08 });
    setTimeout(() => tone({ freq: 200, type: 'sine', dur: 0.06, gain: 0.05 }), 40);
  },
  /** Toggle UI (fire on, wc open, stove on...). */
  toggle(): void {
    tone({ freq: 520, type: 'triangle', dur: 0.08, gain: 0.08, sweepTo: 700 });
  },
  /** Clack / CLACK del Stack Game perfect. */
  clack(perfect = false): void {
    if (perfect) {
      tone({ freq: 880, type: 'triangle', dur: 0.18, gain: 0.16, sweepTo: 1760 });
    } else {
      tone({ freq: 180, type: 'square', dur: 0.08, gain: 0.12 });
    }
  },
};
