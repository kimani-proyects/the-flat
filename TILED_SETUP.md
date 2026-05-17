# Tiled + LimeZu — setup del Día 4

Esta guía cubre cómo dejar los assets en su sitio y abrir el piso en Tiled
para repintarlo con los tiles reales de LimeZu. No es obligatorio hacerlo
hoy — la escena de Phaser funciona con placeholders hasta que quieras
subir el nivel visual.

---

## TL;DR (5 pasos)

1. Instala **Tiled** (gratis): https://www.mapeditor.org/ (versión ≥ 1.10).
2. Copia `Room_Builder_16x16.png` e `Interiors_16x16.png` de tu zip de
   LimeZu a `public/assets/tilesets/limezu/`.
3. Copia los sprites de Character Creator a `public/assets/sprites/characters/`
   (al menos `maria.png`).
4. Ejecuta `npm run gen-tilemap` para generar el esqueleto del piso.
5. Abre `the-flat.tiled-project` en Tiled y ya puedes editar
   `public/assets/maps/apartment.tmj`.

---

## 1. Instalar Tiled

Descarga desde [mapeditor.org](https://www.mapeditor.org/). En Windows el
instalador .exe va perfecto. Alternativas: itch.io (donación opcional) o
Steam (mismo precio, soporte al dev). Cualquier versión ≥ 1.10 vale.

Al abrirlo, ve a `File → Open Project…` y selecciona
`the-flat.tiled-project` en la raíz del proyecto. Eso le dice a Tiled dónde
vive `public/assets/`.

---

## 2. Instalar los tilesets de LimeZu

Dentro del zip de LimeZu Modern Interiors v41.4 buscas las dos imágenes
maestras (normalmente a 16×16):

```
Modern_Interiors_v41/
├── 1_Interiors/
│   └── 16x16/
│       ├── Room_Builder_16x16.png   ← copia ésta
│       └── Theme_Sorter_16x16/
│           └── Interiors_16x16.png  ← y ésta
└── ...
```

> Los nombres pueden variar entre versiones de LimeZu. Si los tuyos son
> distintos (por ejemplo `Room_Builder_free_16x16.png`), renómbralos a
> los nombres que espera el código o actualiza las rutas en
> `src/game/scenes/BootScene.ts`.

Cópialas a:

```
public/assets/tilesets/limezu/
├── Room_Builder_16x16.png
└── Interiors_16x16.png
```

---

## 3. Instalar los sprites de Character Creator

LimeZu Character Creator te da un editor donde montas a tu personaje y
exportas un PNG con las animaciones. Para María exporta una hoja de
sprites y cópiala a:

```
public/assets/sprites/characters/
└── maria.png   ← hoja de animaciones de María
```

(Alex, gatos y UI los abordamos en Días 5-8. Por ahora basta con María.)

---

## 4. Generar el esqueleto del piso

Desde la raíz del proyecto:

```bash
npm run gen-tilemap
```

Esto lee `src/game/data/floorplan.json` (el floor plan v2) y genera
`public/assets/maps/apartment.tmj` con:

- Capa **Floor**: suelos por habitación (con tile IDs placeholder).
- Capa **Walls**: paredes en los bordes de cada sala.
- Capa **Furniture_Back** / **Furniture_Front**: vacías, para que tú
  pintes los muebles por detrás/delante del personaje.
- Capa **Doors**: marcadores de puertas (no colisionan).
- Capa **Collisions**: clon de Walls para que Phaser la use como capa
  de colisión.
- Grupo **Objects**: spawn de María + todos los objetos interactivos
  (PC, cama, nevera, fogones, espejo, bañera, telescopio, etc.) con
  coordenadas exactas.

Si más adelante cambias algo en `floorplan.json` (mueves una puerta,
agrandas el baño, etc.), vuelves a correr `npm run gen-tilemap` y el .tmj
se regenera. **Cuidado:** eso sobrescribe el .tmj, así que si ya pintaste
muchos tiles encima, perderás el trabajo. Recomendación: toca
`floorplan.json` sólo cuando sea un cambio estructural.

---

## 5. Editar en Tiled

Abre `apartment.tmj` desde el panel de proyecto de Tiled.

**Primer paso — repintar suelos con los tiles reales de LimeZu:**

1. En el panel "Tilesets" (abajo a la derecha) verás `Room_Builder_16x16`
   y `Interiors_16x16`. Si aparecen rotos, haz doble click en el tileset
   y pulsa "Edit Tileset" → verifica la ruta de la imagen.
2. Selecciona la capa **Floor** en el panel "Layers".
3. Click en una habitación con la herramienta "Bucket Fill" (la lata de
   pintura). Elige un tile de suelo del tileset (por ejemplo, madera
   clara) y click dentro de una habitación — rellena toda el área.
4. Repite por cada habitación con su suelo correspondiente (baño con
   baldosa, María con moqueta rosa, etc.).

**Segundo paso — paredes reales:**

1. Selecciona la capa **Walls**.
2. Usa el "Stamp Brush" con los tiles de pared de LimeZu. Puedes pintar
   esquinas, ventanas, rodapiés.
3. Tip: LimeZu incluye piezas de "Wall Builder" con esquinas, tes,
   cruces. Con la herramienta "Terrain Brush" de Tiled automatizas el
   dibujo de paredes en L sin esfuerzo.

**Tercer paso — muebles:**

1. En la capa **Furniture_Back** pintas los muebles que quedan por
   detrás del personaje (armarios pegados a la pared, estanterías).
2. En **Furniture_Front** los que quedan por delante (sofá, mesa del
   centro, cosas con las que te cruzas andando).
3. La distinción permite un fake-3D: el personaje se dibuja entre ambas
   capas, dando sensación de profundidad.

**Cuarto paso — colisiones:**

La capa **Collisions** se genera con las paredes automáticamente, pero
puedes añadir más colisiones (muebles bloqueantes) poniendo cualquier
tile en ella. Phaser sólo mira "¿hay tile?" para decidir si colisiona.

**Quinto paso — objetos interactivos:**

El grupo **Objects** ya trae los interactables del floorplan (PC, cama,
nevera, etc.). Si quieres mover uno, arrástralo. Si quieres añadir uno
nuevo, usa la herramienta "Insert Rectangle" y dale un `type` con alguno
de los valores permitidos (enum `InteractableType` en el proyecto).

---

## 6. Cargar el .tmj en Phaser

Ya está hecho. `src/game/scenes/BootScene.ts` hace:

```ts
this.load.image('tiles-room-builder', '/assets/tilesets/limezu/Room_Builder_16x16.png');
this.load.image('tiles-interiors',    '/assets/tilesets/limezu/Interiors_16x16.png');
this.load.tilemapTiledJSON('apartment-map', '/assets/maps/apartment.tmj');
```

Si los PNGs no están (aún), la escena sigue funcionando con los
rectángulos de colores que ya ves en `/game`. Cuando estén, Phaser los
cargará automáticamente y en el siguiente paso (Día 5) los conectamos a
la escena real reemplazando el render de rects por un tilemap Phaser.

---

## Estructura final esperada

```
K:\TheFlat/
├── the-flat.tiled-project      ← abrir en Tiled
├── public/assets/
│   ├── tilesets/limezu/
│   │   ├── Room_Builder_16x16.png
│   │   └── Interiors_16x16.png
│   ├── sprites/characters/
│   │   └── maria.png
│   └── maps/
│       └── apartment.tmj       ← generado, editable en Tiled
├── scripts/
│   └── gen-tilemap.mjs         ← regenera el .tmj
└── src/game/
    ├── data/
    │   ├── floorplan.json      ← fuente única (v2)
    │   └── floorplan.ts
    └── scenes/
        └── ApartmentScene.ts   ← render actual (placeholders)
```

---

## Troubleshooting

- **"Tileset image not found"** — el .tmj busca los PNGs en
  `public/assets/tilesets/limezu/`. Verifica los nombres exactos.
- **Cambié floorplan.json y se me rompió el dibujo** — normal, el .tmj
  se regeneró. Mejor: edita muebles sólo en Tiled (no en el JSON);
  reserva el JSON para cambios estructurales.
- **Tiled dice que las dimensiones del tileset están mal** — al abrir
  por primera vez, haz click derecho sobre el tileset en el panel,
  "Edit Tileset", y Tiled autodetecta el tamaño real del PNG. Guarda.

Cualquier cosa rara, me dices y lo ajustamos.
