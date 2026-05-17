# PLAN_NEXT — Día 7.5 Iteración 4

Documento de continuación. Lee esto primero al retomar — resume el estado y la cola de cambios pendientes acordados con alex.

## Estado actual (cerrado en iteración 3)

- Infraestructura de muros (`LockedWallSystem`) funcionando. Fix del crash collider huérfano aplicado en iteración 2.
- 5 minijuegos vivos: Chocolate, Knock (TOC-TOC), RPS (PPT), Lockpick, StuckDoor.
- Dev tool `Ctrl+Shift+R` en ApartmentScene resetea progreso + reinicia escena.
- Knock: leak F/J de labels arreglado.
- Chocolate v3: memoria muscular sin red. Cualquier fallo cierra. 3 niveles con tiempo total decreciente (12/8/5 s). Ya iba bien.
- PPT v3: implementaba "Alex te dice qué saca" — DESCARTADO en favor de v4 (ver tareas).
- Plan tipografía documentado en CONTEXT.md → tarea #72 (Día 8.5).
- SONOTEX → tarea #69 (Día 18).

## Cola de cambios acordados (próximo prompt)

Hacer EN ESTE ORDEN. Cada uno tiene tarea con detalle completo:

### 1. Fix crítico PPT — bug "gana el perdedor" (#73)
One-liner. `mariaWon = mariaMove !== null && mariaMove === BEATS[scriptMove]`.
Resuelve antes que nada porque el rework de PPT v4 hereda este código.

### 2. PPT v4 — mecánica "entrar en la mente" (#74)
Rework completo. Detalle clave:
- Para ganar set: 3 wins + 2 empates obligatorios.
- Si María llega a game point sin los 2 empates → Alex entra en autowin perpetuo (gana cada ronda eligiendo lo que vence a María) hasta que María consiga los empates.
- Si María consigue los 2 empates → halo verde sobre opción correcta + halos rojos sobre las otras (María sigue eligiendo manual, pero ya con la pista visual).
- Pistas SUTILES en frases de Alex (no obvias como "voy con la roca").
- Hints entre sets escalan; intento 4 = 4ª pared con pista directa.
- Cuadros diálogo: "Hah, acabo de entrar en tu mente 🧠" / "Gracias Alex, ahora estoy en tu mente."

### 3. Chocolate v4 — feedback bailongo (#75)
- Quitar ✓/▶.
- Acierto: sílaba VERDE permanente + efecto bailongo cumulativo (sway/wave sutil sobre las verdes acumuladas, sensación flow).
- Fallo: sílaba ROJA + SHAKE DURO breve, luego cierra.
- Convertir canción en array de Texts individuales por sílaba (grid con wrap).

### 4. Lockpick v3 — 4 cuartos secuenciales (#80)
- Rellenar 4 cuartos del cilindro secuencialmente, cada uno con sweet spot propio.
- Cuando llenas un cuarto → siguiente sweet spot se reaaleatoriza.
- SPACE en sweet spot → barra avanza.
- SPACE FUERA → ganzúa salud baja Y barra del cuarto actual RETROCEDE (drain).
- Sin SPACE → ni avanza ni retrocede.
- QUITAR el "click dot" amarillo de proximidad (daba demasiada pista).
- 3 ganzúas. Si se rompen → fallo, todos los sweet spots se reaaleatorizan al volver.
- 1 nivel solo (no L1/L2/L3). Tolerancia 8°. Pick health 320ms (mantener).
- Visual: cilindro como pie chart segmentado. Cuartos llenos verdes. Cuarto activo parpadea. KCHACK al completar los 4.

### 5. StuckDoor v2 — más profundidad (#76)
- Zona verde MUEVE entre tirones (no centrada siempre).
- Cursor SPEED sube con cada acierto (no sólo con cada fallo).
- BACKSLIDE: fallar quita 1 acierto acumulado (no resetea a 0).
- Animación visual del player María tirando (mini-shake sprite).
- Texto narrativo del estado de la puerta: "rígida → cediendo → casi → ¡SE ABRE!"
- Mantener SPACE-only.

### 6. MinigameIntroPanel — tutorial pre-minijuego (#79)
Nuevo componente compartido en `src/game/minigames/_shared/MinigameIntroPanel.ts`.
Pop-up ANTES de cada minijuego con título + descripción breve + controles + "SPACE/ENTER para empezar". ESC = abortar.

Textos (NO desvelar mecánicas avanzadas):
- PPT: "Es un piedra papel o tijeras. Vence a Alex para abrir." (NO empates ni "entrar en mente")
- CHOCOLATE: "Choco choco la la — juego de memoria muscular. 3 niveles. Sólo una PRO del chocolala podrá abrir esta habitación."
- TOC-TOC: "Escucha el patrón y replícalo. F = nudillo izq, J = nudillo der."
- LOCKPICK: "Encuentra el ángulo correcto con A/D. Mantén SPACE para girar. Cuidado con romper las ganzúas."
- STUCKDOOR: "Tira con timing. Pulsa SPACE cuando el cursor esté en la zona verde."

API: `showIntro(scene, { title, description, controls }): Promise<boolean>` — true si confirma, false si ESC.
Cada runner llama showIntro al principio antes del setup real.

### 7. Unificar control avance — SPACE + ENTER (#78)
Ambas teclas válidas en TODOS los diálogos/menús. Auditar:
- DialogSystem.ts
- MinigameIntroPanel (nuevo)
- IntroScene
- HubScene keypad
- Cualquier minijuego que espere confirmación
Hints UI siguen mostrando SPACE como primario. E sigue siendo "interactuar".

### 8. Auditoría cleanup minijuegos (#77)
Pasada sistemática por TODOS los minijuegos:
- Buscar `this.scene.add.text/rectangle/circle/graphics(...)` SIN guardar referencia → leak garantizado.
- Verificar que TODOS los timers (delayedCall, addEvent) se .remove() en cleanup.
- Verificar que TODOS los tweens activos sobre objetos del minijuego se .killTweensOf() en cleanup.
- Verificar cleanup llamado en TODAS las rutas de salida: success, fail, abort.
- Smoke test manual: entrar a cada minijuego, ESC, verificar que NO queda visual en pantalla.

## Tareas más adelante (NO Día 7.5)

- #58 Día 8 — gatos AI (Haku / Kero / Nala) + cinemática puerta principal cuando los 5 muros KO.
- #72 Día 8.5 — Tipografía pixel + presets en `TextStyle.ts`.
- #69 Día 18 — SONOTEX (audio).
- #48 Día 13-14 — Customización (decoración drag&drop).
- #50 — Smoke test diálogo multipágina.

## Nota técnica importante

NO usar `keyboard.removeKey()` en el cleanup de los minijuegos — Phaser reutiliza la misma instancia de Key que ApartmentScene tiene para WASD. Quitarla rompe el movimiento del player al cerrar el minijuego. Sólo `removeAllListeners()` en las Keys que el minijuego añadió listeners.

NO destruir un `Phaser.Physics.Arcade.StaticGroup` antes de destruir el `Collider` que lo referencia — `world.update` siguiente crashea con "Cannot read properties of undefined (reading 'size')". Patrón aplicado en LockedWallSystem.crumbleWall: `playerCollider.destroy()` ANTES del `staticGroup.destroy()`.
