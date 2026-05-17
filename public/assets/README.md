# `public/assets/` — assets de The Flat

Todo lo que Phaser carga en runtime vive aquí. `public/` se sirve tal cual en
`/assets/...` (Next.js expone la carpeta como raíz estática).

## Estructura

```
public/assets/
├── tilesets/
│   └── limezu/
│       ├── Room_Builder_16x16.png   ← paredes, suelos, puertas
│       └── Interiors_16x16.png      ← muebles, deco
├── sprites/
│   ├── characters/   ← LimeZu Character Generator (maria.png, alex.png)
│   └── cats/         ← Haku, Kero, Nala
├── ui/               ← LimeZu Modern UI (HUD, botones, dialog boxes)
├── audio/
│   ├── music/        ← lo-fi por zona
│   └── sfx/          ← maullidos, cocina, puertas, etc.
└── maps/
    └── apartment.tmj ← mapa de Tiled, generado desde scripts/gen-tilemap.mjs
```

## Nombres esperados

El código de Phaser (ver `src/game/scenes/BootScene.ts`) espera rutas
concretas. Si renombras un archivo, actualiza también la key en el
`preload()`. Los nombres de LimeZu suelen ser `Room_Builder_16x16.png` y
`Interiors_16x16.png` — si los tuyos son distintos, renombra al instalar.

## Instalación de tilesets

Ver [`/TILED_SETUP.md`](../../TILED_SETUP.md) en la raíz.

## Por qué `public/` y no `src/`

`src/` pasa por webpack. `public/` se sirve tal cual. Para PNGs grandes y
JSON de tilemap es más rápido y no se empaquetan dentro del bundle.
