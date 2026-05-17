'use client';

/**
 * Sprite Inspector — herramienta interna de desarrollo.
 *
 * Sirve para identificar frames concretos en cualquier sprite sheet o tileset
 * del proyecto (personajes con 1000+ frames, tilesets del Room_Builder, etc.).
 *
 * Flujo:
 *   1) Elige una hoja y el tamaño de tile
 *   2) Pasa el ratón: aparece col/row/frameIndex
 *   3) Click: añade el frame a la selección actual
 *   4) Shift+Click: rellena un rango desde el último click
 *   5) Escribe nombre (ej. "walk-down") → "Guardar grupo"
 *   6) "Exportar JSON" copia todo al portapapeles
 *
 * NO afecta al runtime de /game. Es una página hermana.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Sheet {
  id: string;
  name: string;
  path: string;
  tileW: number;
  tileH: number;
  group: 'Personajes' | 'Tilesets' | 'Gatos';
  /**
   * Píxeles a saltar arriba antes de que empiece la rejilla real de frames.
   * Los sheets de LimeZu Character Generator tienen un "header row" de 16 px
   * con 3 mini-avatares decorativos, así que los personajes 16×32 reales
   * empiezan en y=16. Para sheets sin header, dejar 0 o sin especificar.
   */
  yOffset?: number;
}

// Lista curada de sheets relevantes. Añadir aquí cuando aparezcan nuevos assets.
const SHEETS: Sheet[] = [
  // Personajes
  // Layout confirmado del LimeZu Character Generator:
  //   maria.png = 896×640. Hay 19 animaciones visibles en la guía.
  //   640 - 19 × 32 = 32 → el header son 32 px (NO 16).
  //   Las celdas son 16×32: cabeza arriba + cuerpo abajo dentro de la misma
  //   celda. Con tileH=16 antes SIEMPRE faltaba la cabeza porque cortaba la
  //   celda por la mitad.
  //   cols = 896/16 = 56, rows = (640-32)/32 = 19 ✓
  { id: 'maria', name: 'María (16×32, skip header 32px)', path: '/assets/sprites/characters/maria.png', tileW: 16, tileH: 32, yOffset: 32, group: 'Personajes' },
  { id: 'alex', name: 'Alex (32×32)', path: '/assets/sprites/characters/alex.png', tileW: 32, tileH: 32, group: 'Personajes' },
  { id: 'maria48', name: 'María 48 (48×48)', path: '/assets/sprites/characters/maria48.png', tileW: 48, tileH: 48, group: 'Personajes' },
  // Guía anotada: misma estructura que maria (16×32 con header 32px).
  { id: 'animGuide', name: 'LimeZu · Spritesheet Guide (16×32, skip 32px)', path: '/assets/tilesets/limezu/2_Characters/Character_Generator/Spritesheet_animations_GUIDE.png', tileW: 16, tileH: 32, yOffset: 32, group: 'Personajes' },
  { id: 'premadeList', name: 'LimeZu · Premade_Characters_LIST', path: '/assets/tilesets/limezu/2_Characters/Character_Generator/0_Premade_Characters/Premade_Characters_LIST.png', tileW: 16, tileH: 16, group: 'Personajes' },
  // Gatos
  { id: 'cats', name: 'Cat Sprite Sheet', path: '/assets/sprites/cats/Cat Sprite Sheet.png', tileW: 32, tileH: 32, group: 'Gatos' },
  // Tilesets del piso (paths reales tras Glob; los del /limezu raíz son
  // los que carga BootScene para el tilemap de Phaser).
  { id: 'roomBuilder', name: 'Room_Builder_16x16 (master)', path: '/assets/tilesets/limezu/Room_Builder_16x16.png', tileW: 16, tileH: 16, group: 'Tilesets' },
  { id: 'floors', name: 'Room_Builder_Floors_16x16', path: '/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png', tileW: 16, tileH: 16, group: 'Tilesets' },
  { id: 'walls', name: 'Room_Builder_Walls_16x16', path: '/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Walls_16x16.png', tileW: 16, tileH: 16, group: 'Tilesets' },
  { id: 'archedEntryways', name: 'Room_Builder_Arched_Entryways_16x16 (puertas)', path: '/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Arched_Entryways_16x16.png', tileW: 16, tileH: 16, group: 'Tilesets' },
  { id: 'baseboards', name: 'Room_Builder_Baseboards_16x16', path: '/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Baseboards_16x16.png', tileW: 16, tileH: 16, group: 'Tilesets' },
  { id: 'interiors', name: 'Interiors_16x16 (master)', path: '/assets/tilesets/limezu/Interiors_16x16.png', tileW: 16, tileH: 16, group: 'Tilesets' },
];

interface FrameGroup {
  name: string;
  sheetId: string;
  frames: number[];
}

const SCALES = [1, 2, 3, 4, 6, 8] as const;

export default function InspectorPage() {
  const [sheetId, setSheetId] = useState<string>(SHEETS[0].id);
  const sheet = useMemo(() => SHEETS.find((s) => s.id === sheetId)!, [sheetId]);

  // tileW/tileH/yOffset sobreescribibles (algunos sheets exóticos o para
  // experimentar). yOffset salta un header decorativo arriba de la sheet.
  const [tileW, setTileW] = useState<number>(sheet.tileW);
  const [tileH, setTileH] = useState<number>(sheet.tileH);
  const [yOffset, setYOffset] = useState<number>(sheet.yOffset ?? 0);
  const [scale, setScale] = useState<(typeof SCALES)[number]>(3);

  useEffect(() => {
    setTileW(sheet.tileW);
    setTileH(sheet.tileH);
    setYOffset(sheet.yOffset ?? 0);
  }, [sheet.id, sheet.tileW, sheet.tileH, sheet.yOffset]);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const overlayImgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [overlayImgSize, setOverlayImgSize] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<{ col: number; row: number; idx: number } | null>(null);
  const [selection, setSelection] = useState<number[]>([]);
  const [lastClicked, setLastClicked] = useState<number | null>(null);

  const [groupName, setGroupName] = useState<string>('walk-down');
  const [groups, setGroups] = useState<FrameGroup[]>([]);

  // Overlay: otra sheet superpuesta en semi-transparente. Sirve para usar la
  // guía anotada (animGuide) como referencia encima de maria.png — los
  // labels "idle", "walk", "sleep", etc. de la guía caen en las mismas filas
  // porque ambos sheets comparten la misma rejilla 16×16 (alineados top-left).
  const [overlayId, setOverlayId] = useState<string | null>(null);
  const overlay = useMemo(
    () => (overlayId ? SHEETS.find((s) => s.id === overlayId) ?? null : null),
    [overlayId],
  );
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.55);

  // La rejilla de frames empieza en y=yOffset px. Todo lo que hay por encima
  // se considera "header decorativo" (en LimeZu, 3 mini-avatares para UI) y
  // no cuenta como frame. Los números de índice arrancan en 0 = primera
  // celda real post-header.
  const cols = imgSize ? Math.floor(imgSize.w / tileW) : 0;
  const rows = imgSize ? Math.max(0, Math.floor((imgSize.h - yOffset) / tileH)) : 0;
  const totalFrames = cols * rows;

  // Redibuja el canvas de overlay cuando cambia cualquier cosa.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgSize) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = imgSize.w * scale;
    const H = imgSize.h * scale;
    const yOff = yOffset * scale; // desplazamiento del grid en canvas px
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    // Si hay header (yOffset>0), lo oscurecemos ligeramente para que quede
    // claro visualmente que no forma parte del grid.
    if (yOff > 0) {
      ctx.fillStyle = 'rgba(255,92,138,0.12)';
      ctx.fillRect(0, 0, W, yOff);
      ctx.strokeStyle = 'rgba(255,92,138,0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, yOff + 0.5);
      ctx.lineTo(W, yOff + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,92,138,0.85)';
      ctx.font = '10px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(`↑ header ${yOffset}px (no grid)`, 4, 2);
    }

    // Grid (empieza en y=yOff).
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      const x = c * tileW * scale + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, yOff);
      ctx.lineTo(x, yOff + rows * tileH * scale);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = yOff + r * tileH * scale + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cols * tileW * scale, y);
      ctx.stroke();
    }

    // Selección actual (cian translúcido).
    ctx.fillStyle = 'rgba(94,234,212,0.35)';
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 2;
    for (const idx of selection) {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const x = c * tileW * scale;
      const y = yOff + r * tileH * scale;
      ctx.fillRect(x, y, tileW * scale, tileH * scale);
      ctx.strokeRect(x + 1, y + 1, tileW * scale - 2, tileH * scale - 2);
    }

    // Hover (amarillo).
    if (hover) {
      const x = hover.col * tileW * scale;
      const y = yOff + hover.row * tileH * scale;
      ctx.fillStyle = 'rgba(255,215,0,0.2)';
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, tileW * scale, tileH * scale);
      ctx.strokeRect(x + 1, y + 1, tileW * scale - 2, tileH * scale - 2);
    }

    // Números de índice cada N celdas (sólo si el scale es razonable).
    if (scale >= 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `${Math.max(8, tileW * scale * 0.22)}px monospace`;
      ctx.textBaseline = 'top';
      const step = scale >= 4 ? 1 : 2;
      for (let r = 0; r < rows; r += step) {
        for (let c = 0; c < cols; c += step) {
          const idx = r * cols + c;
          ctx.fillText(String(idx), c * tileW * scale + 2, yOff + r * tileH * scale + 1);
        }
      }
    }
  }, [cols, rows, tileW, tileH, yOffset, scale, hover, selection, imgSize]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    setSelection([]);
    setLastClicked(null);
    setHover(null);
  };

  const onOverlayImgLoad = () => {
    const img = overlayImgRef.current;
    if (!img) return;
    setOverlayImgSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  // Auto-sugerencia: si la base es un personaje 16×16, proponer la guía
  // anotada como overlay. El usuario puede quitarla.
  useEffect(() => {
    if (sheet.group === 'Personajes' && sheet.tileW === 16 && sheet.id !== 'animGuide') {
      // Sólo auto-sugerir la primera vez; si el usuario ha desactivado el
      // overlay a propósito, no volvemos a imponerlo.
      setOverlayId((prev) => (prev === null && sheet.id === 'maria' ? 'animGuide' : prev));
    }
  }, [sheet.id, sheet.group, sheet.tileW]);

  const computeCell = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imgSize) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Quitar el header del y antes de mapear a fila. Si el ratón está
    // dentro del header, no hay celda válida.
    const yOff = yOffset * scale;
    const yInGrid = y - yOff;
    if (yInGrid < 0) return null;
    const col = Math.floor(x / (tileW * scale));
    const row = Math.floor(yInGrid / (tileH * scale));
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return { col, row, idx: row * cols + col };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setHover(computeCell(e));
  };

  const onMouseLeave = () => setHover(null);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = computeCell(e);
    if (!cell) return;
    if (e.shiftKey && lastClicked !== null) {
      const from = Math.min(lastClicked, cell.idx);
      const to = Math.max(lastClicked, cell.idx);
      const range: number[] = [];
      for (let i = from; i <= to; i++) range.push(i);
      setSelection((prev) => Array.from(new Set([...prev, ...range])).sort((a, b) => a - b));
    } else if (e.altKey || e.metaKey) {
      // Alt/Cmd+click: quitar
      setSelection((prev) => prev.filter((i) => i !== cell.idx));
    } else {
      setSelection((prev) =>
        prev.includes(cell.idx) ? prev.filter((i) => i !== cell.idx) : [...prev, cell.idx].sort((a, b) => a - b),
      );
    }
    setLastClicked(cell.idx);
  };

  const saveGroup = () => {
    if (!groupName.trim() || selection.length === 0) return;
    const newGroup: FrameGroup = {
      name: groupName.trim(),
      sheetId: sheet.id,
      frames: [...selection],
    };
    setGroups((prev) => [...prev.filter((g) => !(g.sheetId === newGroup.sheetId && g.name === newGroup.name)), newGroup]);
    setSelection([]);
    setLastClicked(null);
  };

  const deleteGroup = (g: FrameGroup) => {
    setGroups((prev) => prev.filter((x) => !(x.sheetId === g.sheetId && x.name === g.name)));
  };

  const loadGroup = (g: FrameGroup) => {
    setSelection([...g.frames]);
    setGroupName(g.name);
  };

  const exportJson = () => {
    const bySheet: Record<string, Record<string, number[]>> = {};
    for (const g of groups) {
      bySheet[g.sheetId] = bySheet[g.sheetId] || {};
      bySheet[g.sheetId][g.name] = g.frames;
    }
    const json = JSON.stringify(bySheet, null, 2);
    navigator.clipboard.writeText(json).then(
      () => alert(`Copiado ${groups.length} grupos al portapapeles.`),
      () => alert(json),
    );
    // También lo muestra en consola por si acaso.
    // eslint-disable-next-line no-console
    console.log('[inspector] export:', json);
  };

  const clearSelection = () => {
    setSelection([]);
    setLastClicked(null);
  };

  const invertSelection = () => {
    const all = [];
    for (let i = 0; i < totalFrames; i++) all.push(i);
    setSelection(all.filter((i) => !selection.includes(i)));
  };

  // Agrupar sheets para el <select>.
  const groupedSheets = useMemo(() => {
    const map: Record<string, Sheet[]> = {};
    for (const s of SHEETS) {
      map[s.group] = map[s.group] || [];
      map[s.group].push(s);
    }
    return map;
  }, []);

  const currentSheetGroups = groups.filter((g) => g.sheetId === sheet.id);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Barra superior. */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-neutral-800 bg-neutral-900/95 px-4 py-2 text-xs backdrop-blur">
        <h1 className="text-sm font-semibold text-teal-300">Sprite Inspector</h1>

        <label className="flex items-center gap-1">
          <span className="text-neutral-400">Sheet</span>
          <select
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs"
          >
            {Object.entries(groupedSheets).map(([groupName, items]) => (
              <optgroup key={groupName} label={groupName}>
                {items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1">
          <span className="text-neutral-400">Tile W</span>
          <input
            type="number"
            min={1}
            max={512}
            value={tileW}
            onChange={(e) => setTileW(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-14 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs"
          />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-neutral-400">Tile H</span>
          <input
            type="number"
            min={1}
            max={512}
            value={tileH}
            onChange={(e) => setTileH(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-14 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs"
          />
        </label>

        <label
          className="flex items-center gap-1"
          title="Píxeles a saltar arriba (header decorativo de LimeZu = 16 px)"
        >
          <span className="text-neutral-400">yOffset</span>
          <input
            type="number"
            min={0}
            max={512}
            value={yOffset}
            onChange={(e) => setYOffset(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-14 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs"
          />
        </label>

        <label className="flex items-center gap-1">
          <span className="text-neutral-400">Zoom</span>
          <select
            value={scale}
            onChange={(e) => setScale(parseInt(e.target.value, 10) as (typeof SCALES)[number])}
            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs"
          >
            {SCALES.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>

        {imgSize && (
          <span className="text-neutral-500">
            {imgSize.w}×{imgSize.h} px · {cols}×{rows} = {totalFrames} frames
            {yOffset > 0 && (
              <span className="ml-1 text-pink-400">(skip {yOffset}px header)</span>
            )}
          </span>
        )}

        {/* Overlay controls */}
        <div className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-950/50 px-2 py-1">
          <span className="text-neutral-400">Overlay</span>
          <select
            value={overlayId ?? ''}
            onChange={(e) => setOverlayId(e.target.value || null)}
            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs"
          >
            <option value="">(ninguno)</option>
            {SHEETS.filter((s) => s.id !== sheet.id).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {overlay && (
            <>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                className="h-3 w-24 accent-pink-500"
                title="Opacidad del overlay"
              />
              <span className="w-8 text-right text-neutral-500">
                {Math.round(overlayOpacity * 100)}%
              </span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-neutral-400">
            Sel: <span className="text-teal-300">{selection.length}</span>
          </span>
          {hover && (
            <span className="text-neutral-400">
              Hover: <span className="text-yellow-300">idx={hover.idx}</span> col={hover.col} row={hover.row}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Canvas + imagen. */}
        <div className="flex-1 overflow-auto p-4">
          <div
            ref={wrapRef}
            className="relative inline-block"
            style={{
              imageRendering: 'pixelated',
            }}
          >
            <img
              key={sheet.id}
              ref={imgRef}
              src={sheet.path}
              alt={sheet.name}
              onLoad={onImgLoad}
              style={{
                width: imgSize ? imgSize.w * scale : undefined,
                height: imgSize ? imgSize.h * scale : undefined,
                imageRendering: 'pixelated',
                display: 'block',
              }}
              draggable={false}
            />
            {overlay && (
              <img
                key={`ov-${overlay.id}`}
                ref={overlayImgRef}
                src={overlay.path}
                alt={`overlay ${overlay.name}`}
                onLoad={onOverlayImgLoad}
                className="pointer-events-none absolute left-0 top-0"
                style={{
                  width: overlayImgSize ? overlayImgSize.w * scale : undefined,
                  height: overlayImgSize ? overlayImgSize.h * scale : undefined,
                  imageRendering: 'pixelated',
                  opacity: overlayOpacity,
                  mixBlendMode: 'normal',
                }}
                draggable={false}
              />
            )}
            <canvas
              ref={canvasRef}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              onClick={onClick}
              className="absolute left-0 top-0 cursor-crosshair"
            />
          </div>
        </div>

        {/* Panel lateral. */}
        <aside className="w-full shrink-0 border-t border-neutral-800 bg-neutral-900/70 p-4 text-sm lg:w-96 lg:border-l lg:border-t-0">
          <section className="mb-4">
            <h2 className="mb-2 text-xs uppercase tracking-wider text-neutral-400">Selección actual</h2>
            <div className="mb-2 max-h-24 overflow-auto rounded border border-neutral-800 bg-neutral-950 p-2 font-mono text-xs">
              {selection.length === 0 ? (
                <span className="text-neutral-600">Haz click en una celda. Shift+Click: rango. Alt+Click: quitar.</span>
              ) : (
                <span className="text-teal-300">[{selection.join(', ')}]</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="nombre (walk-down)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs"
              />
              <button
                onClick={saveGroup}
                disabled={!groupName.trim() || selection.length === 0}
                className="rounded bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Guardar
              </button>
              <button
                onClick={clearSelection}
                className="rounded border border-neutral-700 px-3 py-1 text-xs hover:border-neutral-500"
              >
                Limpiar
              </button>
              <button
                onClick={invertSelection}
                className="rounded border border-neutral-700 px-3 py-1 text-xs hover:border-neutral-500"
              >
                Invertir
              </button>
            </div>
          </section>

          <section className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-wider text-neutral-400">
                Grupos de {sheet.name}
              </h2>
              {groups.length > 0 && (
                <button
                  onClick={exportJson}
                  className="rounded bg-pink-600 px-3 py-1 text-xs font-medium text-white hover:bg-pink-500"
                >
                  Exportar JSON ({groups.length})
                </button>
              )}
            </div>
            <ul className="space-y-1">
              {currentSheetGroups.length === 0 && (
                <li className="text-xs text-neutral-600">Aún no hay grupos guardados.</li>
              )}
              {currentSheetGroups.map((g) => (
                <li
                  key={g.name}
                  className="flex items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 py-1"
                >
                  <button
                    onClick={() => loadGroup(g)}
                    className="flex-1 truncate text-left font-mono text-xs text-teal-300 hover:text-teal-200"
                    title={`Cargar ${g.name}`}
                  >
                    {g.name}{' '}
                    <span className="text-neutral-500">
                      [{g.frames.length}]
                    </span>
                  </button>
                  <button
                    onClick={() => deleteGroup(g)}
                    className="rounded px-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="text-xs text-neutral-500">
            <h2 className="mb-1 uppercase tracking-wider text-neutral-400">Atajos</h2>
            <ul className="space-y-0.5">
              <li><span className="text-neutral-300">Click</span> · toggle celda</li>
              <li><span className="text-neutral-300">Shift+Click</span> · rango desde la última</li>
              <li><span className="text-neutral-300">Alt+Click</span> · quitar celda</li>
              <li><span className="text-neutral-300">Zoom</span> · 3× ya muestra índices</li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
