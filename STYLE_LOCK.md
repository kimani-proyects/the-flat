# STYLE_LOCK — Dimensiones y convenciones clavadas

Este documento define las constantes visuales del juego. **No cambiar sin
discusión explícita** — todo el código y los assets futuros se apoyan en
estos números. Si algún asset nuevo no encaja, se adapta el asset, no el
lock.

---

## 1. Unidad base

| Concepto                 | Valor      | Observaciones                                     |
|--------------------------|------------|---------------------------------------------------|
| Tile size                | **16×16 px** | Fuente: `floorplan.json.tileSize`.              |
| Character sprite         | **16×32 px** | Estándar LimeZu walker. 1 tile ancho × 2 tiles alto. |
| Map interno              | **48×32 tiles** = 768×512 px | Fuente: `floorplan.json`.                |
| Viewport interno Phaser  | **480×270 px** (30×17 tiles) | Camera feel "habitación y media" en pantalla. |
| Escala de render         | ×3 → canvas 1440×810 | Coincide con la escala de la demo del Character Creator de LimeZu que me enseñaste. |

Las versiones 32×32 y 48×48 de LimeZu están subidas pero **no se usan en
runtime**. Reservadas para un eventual modo "HD" o assets especiales
(retratos en diálogo, splash). El motor del juego trabaja a **16×16 siempre**.

---

## 2. Tilesets oficiales

Los tilesets declarados en `apartment.tmj` son **cuatro**, con sus `firstgid`
calculados automáticamente por `scripts/gen-tilemap.mjs` en cada corrida:

| # | Tileset                    | Ruta                                                                                    | Grid     | Tiles | firstgid |
|---|----------------------------|-----------------------------------------------------------------------------------------|----------|-------|----------|
| 1 | Room_Builder_16x16         | `public/assets/tilesets/limezu/Room_Builder_16x16.png`                                   | 76×113   | 8588  | **1**      |
| 2 | Room_Builder_Floors_16x16  | `public/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png` | 15×40 | 600   | **8589**   |
| 3 | Room_Builder_Walls_16x16   | `public/assets/tilesets/limezu/1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Walls_16x16.png`  | 32×40 | 1280  | **9189**   |
| 4 | Interiors_16x16            | `public/assets/tilesets/limezu/Interiors_16x16.png`                                       | 16×1064 | 17024 | **10469**  |

**Por qué cuatro y no dos** (decisión Día 4+):
- El maestro (8588 tiles) es enorme; buscar un suelo concreto a ojo es un
  suplicio. Los subfiles Floors (600) y Walls (1280) son el MISMO contenido
  recortado y etiquetado visualmente, así que registrarlos aparte nos
  permite calcular `id = firstgid + row*cols + col` leyendo directamente
  la imagen del subfile. **Esto es iteración de dev, no redundancia en
  runtime**: cada tile queda resuelto a un único `firstgid` por `.tmj`.
- El maestro sigue registrado (firstgid=1) para puertas, arcos, ventanas
  y cualquier cosa que no esté en los subfiles.
- Interiors queda al final para muebles (camas, sofás, neveras, etc.).

> Si algún día añadimos un tileset extra (por ejemplo `Outdoor_16x16` para
> escenas fuera del piso), su `firstgid` irá después del último registrado
> y habrá que editar `gen-tilemap.mjs` para añadirlo al array `TILESETS_DEF`.
> Los IDs ya asignados **no se renumeran jamás** — el orden del array
> `TILESETS_DEF` es también inmutable una vez hay IDs en producción.

---

## 3. Contrato de tile IDs (`scripts/tile-ids.json`)

**Los IDs de tile son contratos inmutables**. Una vez un suelo/puerta
apunta a ID X, nunca se cambia el significado de ese ID. Si queremos una
variante, se añade una clave nueva en `tile-ids.json`, no se remapea la
existente. Esto es crítico para el futuro desbloqueo de cosméticos.

Estructura del JSON:

```json
{
  "floors":  { "wood", "wood_dark", "tile", "carpet_pink", "carpet_purple", "stone", ... },
  "walls":   { "basic", ... },
  "doors":   { "door", "sliding", "arch", "main", "secret" },
  "unlocks": {
    "floor_neon":    <id>,     // ejemplo futuro
    "wall_graffiti": <id>
  }
}
```

Cuando María desbloquee un cosmético ("suelo neón"), se añade
`"floor_neon": <tile_id>` a `unlocks`, se referencia desde la UI de
customización, y punto. El `.tmj` base **no cambia**.

---

## 4. Arquitectura de customización (core del juego)

El juego separa **tres niveles** de estado visual del piso. Esto es lo
que evita que todo se rompa cuando añadamos cosméticos y moveables:

### Nivel 0 — Blueprint (inmutable)
- `src/game/data/floorplan.json`: habitaciones, puertas, spawn, interactables.
- `public/assets/maps/apartment.tmj`: generado por `gen-tilemap.mjs`.
- **Nunca se edita a mano en runtime.** Es el esqueleto del piso.

### Nivel 1 — Skin base (por perfil/savegame)
- Mapeo lógico "tipo de suelo → tile ID" leído desde `tile-ids.json`.
- Un perfil puede tener su propio `tile-ids-overrides.json` con overrides:
  ej. `{ "floors": { "wood": <nuevo_id> } }`.
- Cambiar un suelo desde el menú = patch al override, re-render.

### Nivel 2 — Customización libre (por tile)
- Estado Zustand/Supabase: `Record<"layer:x:y", tileId>`.
- Cuando María pone un cuadro o mueve un sofá, no se toca `.tmj`: se
  añade una entrada `"Furniture_Front:42:17": <tileId>`.
- Al entrar a la escena, Phaser pinta primero el `.tmj` base y luego
  aplica este diff sobre las capas correspondientes.

**Beneficio**: puedes regenerar `.tmj` desde `floorplan.json` las veces
que quieras (cambios estructurales), sin perder ninguna customización
del jugador.

### Nivel 3 — Interactables movibles
- Los objetos de `floorplan.json.interactables` son la posición **default**.
- Cada uno guarda opcionalmente una posición override en el perfil.
- "Mover el sofá" = set override `{ id: "sofa", x, y }`. Al recargar,
  el juego resuelve default + override.

Este esquema de tres capas es estándar en sandbox games (Stardew, Cozy
Grove) y nos da **todas las features** que pediste sin acoplamiento.

---

## 5. Directorios y nomenclatura

```
public/assets/
├── maps/
│   └── apartment.tmj        ← generado, no editar a mano
├── tilesets/
│   └── limezu/              ← pack completo LimeZu v41.4
│       ├── Room_Builder_16x16.png   ← MASTER (8588 tiles, firstgid 1)
│       ├── Interiors_16x16.png      ← MASTER (17024 tiles, firstgid 8589)
│       ├── 1_Interiors/             ← referencia visual (subfiles)
│       ├── 2_Characters/            ← Character Creator + premades
│       ├── 3_Animated_objects/      ← para animaciones
│       ├── 4_User_Interface_Elements/ ← HUD, menús
│       ├── 6_Home_Designs/          ← ejemplos prediseñados de LimeZu
│       └── Palettes/                ← paletas de color oficiales
├── sprites/
│   └── characters/
│       └── maria.png        ← pendiente: hoja 16×32 walker
└── ui/                      ← Modern UI (ya subido)
```

**Regla**: cualquier asset que uses en el juego entra por `public/assets/`
y se referencia con ruta absoluta web (`/assets/...`). El código nunca
importa imágenes directamente — las carga Phaser en `BootScene`.

---

## 6. Checklist cuando se añada un asset nuevo

- [ ] ¿Es 16×16 (tile) o 16×32 (sprite)? Si no, **rechazar o reescalar**.
- [ ] ¿Va al tileset maestro existente, o es uno nuevo? Si nuevo, calcular firstgid y añadirlo a `gen-tilemap.mjs`.
- [ ] ¿Se referencia con un ID estable en `tile-ids.json`? Si es cosmético desbloqueable, añadir a `unlocks`.
- [ ] ¿Tiene versión 32×32 / 48×48 también? Guardar en subcarpetas por si un futuro modo HD.
- [ ] ¿El `.tmj` base necesita cambiar? Casi siempre **no** — la customización va al estado de perfil, no al blueprint.

---

## 7. Character sprite de María (pendiente)

- Tamaño objetivo: **16×32 px** por frame, LimeZu walker layout
  (4 direcciones × N frames de animación).
- Placeholder actual en `ApartmentScene.ts`: rectángulo 10×22 rosa. Ya
  alineado con el tamaño final del sprite, solo habrá que cambiar el
  rectángulo por la animación cuando tengas el PNG exportado.
- Hitbox de colisión: **10×10 a los pies del sprite** (no el cuerpo
  entero). Esto permite solaparse con muebles por detrás y da sensación
  fake-3D.

---

Doc mantenido por Claude + Alex. Revisar y actualizar cuando se tome
cualquier decisión que afecte dimensiones, rutas de assets o contrato
de tile IDs.
