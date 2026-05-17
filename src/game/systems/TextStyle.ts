import * as Phaser from 'phaser';

/**
 * TextStyle — presets de texto centralizados (Día 8.5).
 *
 * Toda la UI del juego (DialogSystem, IntroScene, HubScene, marcadores,
 * minijuegos, IntroPanel) debe consumir uno de estos presets en vez de
 * declarar `fontFamily / fontSize / color` ad-hoc. Beneficios:
 *
 *   1) Una sola fuente: cambiar Silkscreen por otra es un edit aquí.
 *   2) Tamaños coherentes: máximo 5 escalas (HEADER, DIALOG, BODY, HINT, PROMPT).
 *   3) Colores coherentes: paleta limitada con semántica (yellow=énfasis,
 *      teal=Alex, pink=María, green=success, red=error, gray=neutral).
 *   4) Permite `cloneStyle(...)` con override puntual sin tocar el resto.
 *
 * Convención: TODO `Phaser.Scene.add.text(x, y, msg, S.dialog())` o
 * variantes con override `S.dialog({ color: COLORS.alex })`.
 */

/**
 * Stack de fuentes: Silkscreen primero (cargada via `next/font/google` en
 * layout.tsx). Si no está disponible (SSR o error de carga), monospace
 * como fallback inmediato. La string completa la pasa Phaser a Canvas2D.
 */
export const FONT_STACK = "'Silkscreen', monospace";

/**
 * Paleta del juego — usar SIEMPRE estos colores, no hex sueltos. Pensada
 * para combinar bien sobre el fondo `#1a0e08` de los paneles del juego.
 */
export const COLORS = {
  // Acento principal (énfasis, títulos, prompts).
  yellow: '#fbbf24',
  yellowDim: '#c08a4f',
  // Speakers — coherentes con los sprites usados en los minijuegos.
  alex: '#5eead4',  // teal — frase Alex en PPT, paneles diegéticos
  maria: '#ff8ab8', // pink — diálogos María
  // Estados.
  success: '#4ade80',
  error: '#ef4444',
  errorDark: '#b91c1c',
  // Texto neutro.
  textWhite: '#ffffff',
  textBeige: '#e5d3b3',
  textBrown: '#6b4425',
  textBrownDark: '#3a2618',
  gray: '#9ca3af',
  grayDark: '#6b7280',
  // Fondo de paneles (uso decorativo en strokes/sombras).
  panelBg: '#1a0e08',
} as const;

/**
 * Tamaños del juego. El viewport interno es 480×270; a 1920×1080 escala
 * 4×, así que 8px → 32px reales (legible). Mínimo absoluto: 7px.
 */
export const SIZE = {
  header: 14,  // títulos de panel grandes
  dialog: 11,  // texto principal de diálogos
  body: 10,    // texto general (descripciones, marcadores)
  hint: 9,     // hints de teclas, controles
  prompt: 8,   // prompts secundarios, labels pequeños
} as const;

type StyleConfig = Phaser.Types.GameObjects.Text.TextStyle;

interface StyleOverride {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  wordWrap?: number; // ancho de wrap en px
  lineSpacing?: number;
  fontSize?: number; // override puntual del tamaño (en px)
}

function build(baseSizePx: number, baseColor: string, override: StyleOverride = {}): StyleConfig {
  const out: StyleConfig = {
    fontFamily: FONT_STACK,
    fontSize: (override.fontSize ?? baseSizePx) + 'px',
    color: override.color ?? baseColor,
  };
  const styleParts: string[] = [];
  if (override.bold) styleParts.push('bold');
  if (override.italic) styleParts.push('italic');
  if (styleParts.length) out.fontStyle = styleParts.join(' ');
  if (override.align) out.align = override.align;
  if (override.wordWrap !== undefined) {
    out.wordWrap = { width: override.wordWrap, useAdvancedWrap: true };
  }
  if (override.lineSpacing !== undefined) out.lineSpacing = override.lineSpacing;
  return out;
}

/**
 * Presets — exportados como funciones para permitir override puntual.
 * Uso típico:
 *
 *   scene.add.text(x, y, 'Título', S.header({ color: COLORS.alex }));
 *   scene.add.text(x, y, msg, S.dialog({ wordWrap: 240 }));
 */
export const S = {
  /** Títulos grandes de panel. Bold por defecto, amarillo. */
  header: (o: StyleOverride = {}) => build(SIZE.header, COLORS.yellow, { bold: true, ...o }),

  /** Texto principal de DialogSystem y cuadros narrativos. */
  dialog: (o: StyleOverride = {}) => build(SIZE.dialog, COLORS.textWhite, o),

  /** Texto general — descripciones, marcadores HUD, instructions. */
  body: (o: StyleOverride = {}) => build(SIZE.body, COLORS.textBeige, o),

  /** Hints de controles, atajos. */
  hint: (o: StyleOverride = {}) => build(SIZE.hint, COLORS.yellowDim, o),

  /** Prompts pequeños, labels, hints muy secundarios. */
  prompt: (o: StyleOverride = {}) => build(SIZE.prompt, COLORS.gray, o),

  /**
   * Texto del speaker (nombre del personaje hablando). Usado por el
   * DialogSystem encima del cuadro principal. Bold + en color del speaker.
   */
  speaker: (o: StyleOverride = {}) => build(SIZE.body, COLORS.yellow, { bold: true, ...o }),
} as const;

/**
 * Helper para Phaser.GameObjects.Text setColor cuando la API canvas tome
 * un color directo. Usa la paleta para no escapar a hex sueltos.
 */
export function colorOf(name: keyof typeof COLORS): string {
  return COLORS[name];
}
