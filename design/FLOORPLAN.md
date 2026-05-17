# Floor plan del piso — v2

> v2 = ampliamos todo, abrimos cocina-salón, terraza con acceso por dos puntos,
> habitación secreta más grande, y eliminamos el hueco muerto de la v1.
> Todo se mide en **tiles de 16×16 px** (LimeZu Modern Interiors).

## Qué cambia desde v1

1. **Open plan cocina-salón.** Desaparece la pared que los separaba. Ahora es un
   único espacio abierto con una isla de cocina (kitchen island) como
   separador visual. Estilo cocina americana.
2. **Todo más grande.** Aprovechamos el hueco muerto de la v1 y expandimos:
   salón, baño, cocina, habitación de Alex y habitación secreta.
3. **Terraza conectada por dos sitios.** Puerta corredera hacia la cocina
   (útil para sacar bebidas) y otra hacia el salón (el clásico sofá→terraza).
4. **Habitación secreta 8 × 8** (antes 6 × 6). Más espacio para el Cuarto de la
   Conspiración: pared con recortes, mesa central, mapa de Sevilla, etc.
5. **Sin espacio muerto.** La planta rellena los 48 × 32 tiles enteros
   (salvo paredes).

## Visión global v2

```
    x=0          14       20             34         48
  y=0 ┌────────────────────┬───────────────────────────┐
     │                     │                           │
     │                     │       OPEN PLAN           │
     │      TERRAZA        │   ┌──────────┐            │
     │      20 × 14        │   │  COCINA  │   SALÓN    │
     │   (plantas,         │   │  14 × 14 │  14 × 14   │
     │    vistas Sevilla,  │   │          │            │
     │    telescopio)      │   └──[isla]──┘            │
 y=14├──────────┬──────────┼────────────────┬──────────┤
     │          │          │                │          │
     │  BAÑO    │          │                │ ┌──────┐ │
     │  14 × 6  │          │   HAB ALEX     │ │SECRE-│ │
 y=20├──────────┤ ENTRADA  │    22 × 18     │ │  TA  │ │
     │          │ 12 × 18  │  (PC, cama,    │ │ 8×8  │ │
     │ HAB      │ (pasillo │   Nala,        │ │(8×8) │ │
     │ MARÍA    │  + hub,  │   escritorio)  │ └──────┘ │
     │ 14 × 12  │  zapatero│                │          │
     │ (PC,     │  perche- │                │          │
     │  cama,   │  ro)     │                │          │
  y=32└──────────┴──────────┴────────────────┴──────────┘
                      ▲
         Puerta principal (triple código)
```

## Dimensiones v2

| Zona             | Posición (x, y) | Tamaño (tiles) | Tamaño (px) | Δ vs v1      |
|------------------|-----------------|----------------|-------------|--------------|
| Terraza          | (0, 0)          | 20 × 14        | 320 × 224   | +100 tiles   |
| Open plan — Cocina | (20, 0)       | 14 × 14        | 224 × 224   | +36 tiles    |
| Open plan — Salón  | (34, 0)       | 14 × 14        | 224 × 224   | +56 tiles    |
| Baño             | (0, 14)         | 14 × 6         | 224 × 96    | +20 tiles    |
| Hab María        | (0, 20)         | 14 × 12        | 224 × 192   | −24 tiles    |
| Entrada/Pasillo  | (14, 14)        | 12 × 18        | 192 × 288   | +144 tiles   |
| Hab Alex         | (26, 14)        | 22 × 18        | 352 × 288   | +172 tiles   |
| Hab Secreta      | (36, 22)        | 8 × 8          | 128 × 128   | +28 tiles    |

**Total:** 1.536 tiles (planta entera ocupada, sin hueco muerto).

> Nota: Hab María pierde 24 tiles respecto a v1 pero sigue siendo amplia
> (14×12 = 168). A cambio se gana un pasillo/entrada mucho más cómodo y una
> habitación de Alex con espacio real para el escritorio + cama + pasillo
> hacia la Secreta.

## Flujo de puertas v2

```
Exterior
   │ (puerta triple código, sur de Entrada)
   ▼
Entrada ───────────► Open Plan (Cocina + Salón, sin pared)
   │                     │        │
   │                     │        └──► Terraza (puerta corredera sur)
   │                     │
   │                     └──► Terraza (puerta corredera norte, desde cocina)
   │
   ├──► Baño (puerta cerrada)
   ├──► Hab María
   └──► Hab Alex ──► [pared falsa, puzzle PC] ──► Hab Secreta
```

Reglas v2:

- **Entrada = hub principal.** Conecta con Baño, Hab María, Hab Alex y
  Open Plan (a través de un arco sin puerta).
- **Open Plan = un solo espacio.** Entre Cocina y Salón no hay pared ni
  puerta. Una **isla de cocina** marca el límite visual y funcional. Los
  gatos pueden cruzar libremente.
- **Terraza ↔ Open Plan:** dos puertas correderas de cristal. Una al sur
  de la zona Cocina y otra al sur de la zona Salón. Permite flujo circular
  (entras por un lado y sales por otro) que ayuda al overcooked mini-game
  y al ambiente de fiesta.
- **Baño ↔ Entrada:** puerta cerrada (privacidad).
- **Hab María, Hab Alex:** puertas cerradas, se abren interactuando.
- **Hab Secreta:** pared falsa detrás del escritorio de Alex. Sólo se
  abre tras el puzzle del PC.

## Dónde viven los gatos (v2)

- **Haku (negro):** libre. Suele estar en zonas altas: estantería del
  salón, isla de cocina, telescopio de la terraza. Durante tormentas
  desaparece.
- **Kero (naranja):** circula entre Hab María y la zona de Cocina del open
  plan. Ruta predefinida cruzando el pasillo.
- **Nala:** Hab Alex por defecto. Si Alex está spawneado, le sigue por
  todo el piso con corazoncitos.

## Ventanas y luz natural

- **Terraza:** exterior, luz directa.
- **Open plan (cocina):** ventana sobre el fregadero (pared norte).
- **Open plan (salón):** ventana grande al lado del sofá (pared norte y/o
  este). Da la sensación amplia del espacio abierto.
- **Baño:** ventana pequeña con cristal opaco.
- **Hab María:** ventana con escritorio/PC debajo.
- **Hab Alex:** ventana con escritorio/PC debajo (el escritorio tapa
  parcialmente la entrada a la Secreta).
- **Entrada/Pasillo:** sin ventanas.
- **Hab Secreta:** sin ventanas (obviamente).

## Consideraciones de cámara (v2)

Viewport sigue siendo 30 × 17 tiles. Con piso 48 × 32:

- Cámara en María → ve media habitación + baño + parte del pasillo.
- Cámara en Entrada (centro) → se asoma al open plan al norte y al pasillo
  completo.
- Cámara en zona Cocina del open plan → ve cocina + isla + principio del
  salón + terraza al sur. **Esto es clave para el overcooked**: todo el
  espacio cocinable cabe en una sola toma.
- Cámara en Hab Alex → habitación entera + trozo del pasillo.

## Overcooked mini-game (preparación)

El open plan se diseñó pensando en el mini-juego de cocina cooperativo:

- **Cocina (14 × 14):** espacio para fogones, nevera, fregadero, mesa de
  preparación. Puedes poner estaciones de trabajo en forma de U o L.
- **Isla central:** actúa como "bar de entrega" — aquí se dejan los platos
  listos. Mecánica natural para un overcooked.
- **Salón como comedor:** la mesa del comedor está en la zona salón.
  Flujo natural: cocinas → isla → mesa.
- **Terraza cerca:** se puede sacar un mini-evento de barbacoa en la
  terraza usando la puerta directa cocina→terraza.

## Puerta principal (triple código)

Sur de la Entrada, en x=18-22 (centrada). Estilo puerta reforzada con
teclado numérico. Cuando María introduce el código correcto por primera
vez, Alex recibe una notificación (no se lo dice aún, pero es un evento
registrable en admin).

## Qué decidir para la v3 (si hace falta)

1. **Tamaño/forma de la isla de cocina:** ¿barra recta de 6 tiles, en L,
   o isla cuadrada central? Afecta al flujo del overcooked.
2. **Puerta terraza-cocina:** ¿puerta corredera o arco abierto sin puerta?
3. **Ventana del salón:** ¿pared norte (hacia terraza) o pared este
   (hacia fuera)?
4. **Hab Secreta — pared falsa:** ¿por dónde se abre? ¿tras el escritorio,
   tras la cama, tras una estantería?

Si te vale este plano tal cual, pasamos a Tiled. Si quieres ajustar algo,
dímelo y saco v2.1.
