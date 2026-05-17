# NEXT SESSION — S2 plan

Recibido feedback con screenshots. Resumen y plan de ejecución.

## Problemas detectados

1. **Sprites 48×48 demasiado grandes**
   - Fridge / oven / kitchen-sink / microwave / TV se ven enormes
     respecto al player (16×16) y al tilemap.
   - Hay versiones 16×16 y 32×32 en las carpetas
     `3_Animated_objects/16x16` y `3_Animated_objects/32x32`.
   - **Decisión**: bajar a **16×16** (alineado con TILE_SIZE). Sólo
     usar 32×32 para muebles realmente grandes (cama, sofá, bañera).

2. **Animación constante en loop = "casa de bruja"**
   - Todo gira/pestañea sin parar.
   - **Decisión**: cambiar a modelo **STATIC + ANIM-ON-INTERACT**.
     - Por defecto, sprite congelado en frame 0.
     - Al pulsar E sobre el mueble, anim juega 1-2 ciclos y vuelve a
       frame 0.
     - Excepciones: **TV** mantiene anim mientras está ON. Vela
       (decoración) puede mantener llama. El resto, quieto.

3. **Libro: texto se sale del marco + sigilo encima del texto**
   - El cuerpo de página excede el alto del rectángulo.
   - Sigilo se posiciona sobre el body en algunas páginas.
   - **Decisión**:
     - Subir altura del libro a 260-280 px.
     - Body con `wordWrap` ajustado al ancho real menos 60 px de
       margen.
     - Sigilo en zona dedicada al pie de página (cy + PH/2 - 70),
       NUNCA superpuesta al body.
     - Detectar overflow: si el body es muy largo, partirlo en dos
       sub-páginas internas dentro del mismo "page" lógico, navegables
       con flechas (sin afectar al pageNum visible).
     - Considerar: ALGUNAS páginas con texto LARGO + sigilo deberían
       tener el sigilo en página separada (ornamento de transición).

4. **TV bocadillo se sale por arriba del viewport**
   - cy=56 + banner en y=16 está demasiado arriba.
   - Banner rojo se corta.
   - **Decisión**: bajar bocadillo a cy=90, banner en y=40. Margen
     superior del viewport ~30 px reservado.

5. **Falta vida en habitaciones (Alex, María, entrada, terraza, etc.)**
   - PCs, camas, sofás, wardrobes, plantas, percheros, mesitas, etc.
   - **Decisión**: usar `1_Interiors/Theme_Sorter_Singles` que tiene
     CADA objeto como PNG separado. Más fácil que extraer regiones de
     spritesheets grandes.
     - Subcarpetas: `2_LivingRoom_Singles`, `4_Bedroom_Singles`,
       `12_Kitchen_Singles`, `3_Bathroom_Singles`, `1_Generic_Singles`,
       etc. Cada PNG es un mueble individual estático.
     - Crear nuevo sistema `StaticFurnitureRenderer` que carga PNGs
       individuales y los pinta como imágenes simples (no anims).
     - Puede compartir hitbox con el `FurnitureRenderer` actual.

## Plan de ejecución S2

### S2.1 — Arquitectura sprites (1ª prioridad)

- [ ] Bajar `FurnitureRenderer` a sprites 16×16 (cambiar load paths a
  `3_Animated_objects/16x16/spritesheets/...`).
- [ ] Implementar modo `staticByDefault: true` en `FurnitureSpec`:
  - Carga frame 0 al spawn.
  - Método `playOneShot()` que reproduce N ciclos y vuelve a 0.
  - TV mantiene `loop: true` (excepción).
- [ ] Wire en handlers: cuando E sobre fridge → `furniture.playOneShot('fridge')`
  durante el flavor dialog. Igual para washbasin, mirror, bathtub, etc.
- [ ] Probar visualmente: foto a foto que cada mueble está en escala.

### S2.2 — StaticFurnitureRenderer (vida en casa)

- [ ] Crear nuevo sistema que carga PNGs de
  `Theme_Sorter_Singles` como imágenes (no spritesheet).
- [ ] Definir lista por habitación de muebles a colocar (con tile
  position + rotation/flip si el sprite mira al lado equivocado):
  - **Salón**: sofá orientado N (mirando a TV), mesita café, libreria
    grande, lámpara de pie, cuadro pared, planta esquina.
  - **Cocina**: encimera continua, mesa grande con sillas, cafetera,
    estantes con tazas.
  - **Habitación María**: cama con dosel, tocador, armario, cuadros,
    alfombra, mesilla, lámpara.
  - **Habitación Alex**: cama doble, mesa con monitor, silla gaming,
    estantería con figuras, póster, alfombra.
  - **Baño**: toallero, espejo (ya está), cabinet (ya), ducha curtain.
  - **Entrada**: perchero (sustituir por arcón si no hay sprite),
    paragüero, alfombra bienvenida, planta.
  - **Terraza**: telescopio (ya), sillón exterior, plantas, mesita.
  - **Habitación secreta**: caja fuerte (ya), PC raro, escotilla
    (ya), alfombra ritual con sigilo.
- [ ] Hitboxes para cada uno (1×1, 1×2, 2×1 según pieza).
- [ ] Asegurar Z-order: muebles tras player cuando player está delante.

### S2.3 — Libro fix

- [ ] Subir altura panel libro a 280 px.
- [ ] Reorganizar body: dejar 90 px de margen inferior libre para
  sigilo cuando exista; si no hay sigilo, body usa todo el espacio.
- [ ] Detectar overflow: medir `pageBody.height` después de setText;
  si > maxHeight, partir en sub-páginas (intercaladas con `1.a, 1.b`
  en el pageNum, o paginar el body internamente).
- [ ] Sigilo en posición fija al pie, separado del body.
- [ ] Test: que ningún capítulo tenga texto cortado.

### S2.4 — TV bocadillo fix

- [ ] cy = 90, banner y = 40.
- [ ] Acortar título si excede el ancho del banner.
- [ ] Verificar que ESC apaga la TV (al levantarse, llamar
  `setTvOn(false)` además de cortar el bocadillo).

### S2.5 — Misc

- [ ] Escape hatch ya está locked (S1.2). Verificar que se ve el
  diálogo correcto.
- [ ] Audit: cuando el player atraviesa el espejo (anchor wall), no
  hay colisión, correcto. Pero asegurar que el sprite pinta DETRÁS del
  player si player está en el mismo eje Y o por delante.

## Reglas de orientación de sprites (fenshui)

LimeZu suele dibujar muebles "desde arriba" (top-down con leve
perspectiva). Algunos miran al sur, otros al norte. Para que la
escena "fluya":

- Sofá: mira hacia la TV → ajustar orientación según posición de TV.
  En este floorplan TV está al norte (y=1) y sofá al sur (y=7), así
  que el sofá debe mirar al **norte**. Si el PNG mira al sur, usar
  flipY (no soportado nativo en Phaser para sprites, alternativa: usar
  un PNG con la orientación correcta).
- Cama María: mira al techo (norte) si la pared es sur. Cabecera
  contra muro.
- Cama Alex: idem, cabecera contra muro.
- PC: en escritorio mirando al usuario (sentado mirando al sur).
- Espejo: cuelga del muro NORTE del baño.
- Bañera: contra esquina, normalmente con el grifo al fondo.
- Nevera: contra muro NORTE de cocina, puerta abriendo al SUR.
- Cocina: encimera continua a lo largo del muro NORTE.

Estas reglas hay que aplicarlas al colocar cada mueble — no es
suficiente con poner el sprite, hay que verificar que la orientación
del PNG cuadra con la disposición del piso.

## Cosas que NO hacer en S2

- No tocar minijuegos (Wordle / Trilero / Tinder ya OK).
- No tocar gatos (FSM ya estable).
- No tocar single-instance (ya OK).
- No empezar con PC María todavía — primero la casa tiene que tener
  vida visual.

## Después de S2

S3 (Día 11): PC María (escritorio + apps Regalos/Multimedia/Notas).
S4 (Día 12): Hacking PC Alex → escape hatch unlocks.
S5 (Día 13): Hatch lobby + sala cumple multiplayer.
S6 (Día 14): polish + audio + splash.

Cumple es el 11/05/2026. Hoy 06/05. Quedan 5 días.
