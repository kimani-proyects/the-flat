# THE FLAT - Project Context

## What is this?
A pixel art top-down cozy game built as a birthday gift for María (May 11, 2026). Created by Alex.
The game looks like a single-player cozy apartment sim but is secretly online — Alex can connect invisibly to observe, trigger events, jumpscares, or spawn as a visible character.

## Stack
- **Frontend/App**: Next.js 14+ (App Router, TypeScript, Tailwind)
- **Game Engine**: Phaser 3 (integrated as Next.js component)
- **Backend/DB**: Supabase (Auth, PostgreSQL, Realtime WebSockets, Storage)
- **State Management**: Zustand
- **Hosting**: Vercel (free tier)
- **Assets**: LimeZu Modern Interiors v41.4, Modern UI, Character Generator, 2D Pixel Art Cat Sprites

## Project Location
`K:\TheFlat`

## Design Philosophy
**"Keep it Cutre"** — The UI style intentionally varies by context/room/minigame. Text RPG with portraits as base, Project Zomboid-style fonts for survival moments, Animal Crossing bubbles for casual. The inconsistency IS the charm.

## Game Overview

### Intro Sequence (solo primera partida)
1. Fake LoL match in progress. María (Jinx/Lux/Syndra main, Emerald 4) is dead, waiting for respawn
2. Surrender vote appears. Regardless of María's choice, teammates vote YES dramatically
3. Dialogue: "Vaya mierda..." — fade to black
4. Next morning: letter with keys → "The Flat" —A, with an address + código de 6 dígitos (DD·MM·AA del cumple)

Tras ver la intro una vez, el flag `introPlayed` se persiste (Zustand + localStorage, key `theflat:progress`). En arranques posteriores se salta directamente al HUB.

### HUB — El Rellano del Bloque
Scene intermedia entre Intro y Apartment. Arquitectura multi-usuario pensada desde el principio: aunque este juego es el regalo de María, el rellano está diseñado para escalar — en el futuro, cada persona a la que regale el juego tendrá su propia puerta numerada (2A, 2B, 2C, 2D…) y su propio piso detrás. Un único build, múltiples destinatarios.

**Nota multi-avatar (importante para Día 13-14):** el sistema de Character Generator que se implementará en el armario (`wardrobe`, customización por capas: cabeza, pelo, ropa, accesorios) NO es un sistema aislado para María. Está pensado para reciclarse como creador de avatar del HUB cuando haya multi-sesión. Cada destinatario que se conecte tendrá su propio avatar persistido server-side (associated to player_id), que se renderizará tanto en el Hub (entrando a su puerta) como dentro de su piso. Esto significa que el componente de customización debe diseñarse desacoplado de María — recibe un `player_id` o un `avatar_config` y pinta. La API del armario en el piso y la API del avatar-creator del Hub son la misma. Así evitamos duplicar trabajo en el futuro.

- Visualmente: rellano de bloque andaluz antiguo, 4 puertas visibles, azulejo cutre, luz fluorescente parpadeante sobre la puerta de María (2B).
- Solo la puerta 2B es jugable. Las otras son decorativas / "dark" / future work.
- Interacción: acercarse a 2B + E → se abre un keypad popup (6 dígitos). Valida contra `APARTMENT_CODE` (por ahora constante `'110526'` = 11·05·26, cumple de María). Cuando sea multi-user, el código será per-player y se generará server-side.
- Primera vez: un hint "De la carta que te dejó A" aparece 9s para pistar el código.
- Al acertar: `markApartmentEntered()` + fade → ApartmentScene.
- En visitas posteriores esperamos saltar el keypad con un session-token, pero el keypad sigue disponible como fallback (TBD Día 9 con Supabase).

### Entrada al piso (después del HUB)
Al entrar, las habitaciones (cocina, baño, hab. María, hab. Alex, terraza) arrancan TODAS bloqueadas. En lugar de un tile de puerta convencional, cada acceso está tapiado por un "muro" temático (cada uno con estética propia — electrónico futurista, piedra antigua, moderno minimalista, etc.). Cada muro hospeda un minijuego de desbloqueo. Al resolverlo, el muro se retira y la habitación queda desbloqueada permanentemente (`unlockRoom()` en el PROGRESS store). "Entrada" y "Salón" son open plan y siempre accesibles desde el arranque.

### Puerta principal — funcional bidireccional
La puerta principal del piso (interactable `front-door`, antes `keypad`) es el portal Hub ↔ Apartment:
- **Salida**: dentro del piso, María se acerca a la puerta y pulsa E → mini-diálogo + fade → HubScene.
- **Re-entry desde Hub**: si ya entró al piso alguna vez (`apartmentEverEntered === true`), pulsar E en la 2B salta el keypad y entra directo. Implementa el "session token" del GDD original sin necesitar Supabase aún (basta el flag persistido en localStorage).
- El keypad interno desaparece como puzzle del piso (el código se introduce solo en el Hub, una vez).

### The Apartment (7 Zones)
All zones are fully customizable (drag & drop furniture/decoration using Modern Interiors assets).

1. **Entrada/Pasillo** — Front door (where Alex spawns visible), coat rack, shoe rack
2. **Salón** — Social hub. TV+console (minigame hub: arcade, board games, 1-2 players). Sofa (sit together), shelf (collectibles), window (day/night cycle view)
3. **Habitación de María** — Gamer+cozy vibe. PC (shop, exclusive minigames, sync events with Alex), diary (progress tracker), mirror (change look), bed (random night events)
4. **Habitación de Alex** — Similar to María's. PC hides access to secret room. Fully customizable EXCEPT the secret door area
5. **Secret Room (La Conspiración)** — Accessed via complex puzzle on Alex's PC. Fixed showroom (not customizable). Conspiracy aesthetic: newspaper clippings, red strings, maps with pins. Themes: esoterismo, secret societies, Demiurgo, Loosh. Mix of serious and humor. Hidden second puzzle reveals personal message from Alex to María
6. **Cocina** — Cooking system (solo or coop Overcooked-style when Alex is spawned). Recipe book, progressive unlocks. Kero tries to steal ingredients
7. **Baño** — Mirror (quick look change), bathtub (relax mode), steamed mirror (Alex can leave messages), random items in cabinet
8. **Terraza** — Sevilla panorama with day/night+weather. Plant system (real lifecycle, die if neglected). Clothesline (rain micro-event). Two chill chairs. Telescope (constellation minigame)

### Day/Night + Weather
- Synchronized with real Sevilla, Spain time
- Weather from API: sunny, cloudy, rain, storm
- Affects lighting, cat behavior, plant watering, music tone

### Three Cats
- **Haku (black)** — Mystic NPC. Roams freely. Gives cryptic hints, reacts to events. "Ojos de Haku" mechanic: eyes glow near secrets. Alex can trigger this from admin
- **Kero (orange)** — Tamagotchi system (hunger, affection, play, sleep). Lives in María's room + kitchen. Steals cooking ingredients. Blocks PC keyboard sometimes
- **Nala** — Lives in Alex's room. Follows Alex everywhere when he spawns (with pixel hearts). Ignores María dramatically when Alex is present. Subtle "Alex detector": ears twitch when Alex is invisible nearby

### Online System
María doesn't know the game is online. Discovery is gradual or Alex decides when to reveal.

**Alex's modes:**
- **Invisible**: observe, trigger events, manipulate world, leave clues
- **Spawned**: walks in through front door, interacts, plays minigames with María
- **NPC disguised**: appears as mysterious character with scripted dialogue

### Admin Dashboard (separate web page)
- **Observe**: minimap with María's position, current room, session stats
- **Instant events**: toggle lights, change music, insert sounds, move objects, jumpscares (3 intensity levels), control cat behavior, write on steamed mirror, leave notes in drawers, spawn mysterious objects
- **World modification**: add/remove items, update shop catalog, add recipes, plant surprise plants on terraza
- **Spawn controls**: spawn/despawn buttons, invisible toggle

### PC Sync Events (both on their in-game PCs)
- Cutre Chat: pixel art real-time chat
- PvP minigames: hacker battle, mutual quiz, coop puzzles
- Synchronized events: watch pixel "movie" on TV, special weather events, special cat appearances
- Cinema mode: sit on sofa together, TV shows shared animations

### Economy
- **Cutrecoins**: earned from minigames, daily tasks, cat care, cooking. Spent in shop (María's PC) on furniture, decoration, cosmetics
- **Achievement unlocks**: special items from completing challenges (can't be bought)
- **IRL gifts** (SEPARATE system, doesn't affect gameplay):
  - 2-3 codes: Steam games, Shein, etc. Hidden in specific locations
  - 3 experience tickets: Karts+bowling (found in sofa), Cine+palomitas (TV cinema mode), Escapada de finde (telescope constellation)

### Music & Audio
- Base: lo-fi chill, varies by zone
- Dynamic: changes with time of day + weather
- Events: Alex can change music or insert specific sounds from admin
- Key moments: real music (songs they both like)
- Each cat has unique sounds

### Saving
- Automatic cloud save (Supabase) — constant
- Everything persists: furniture positions, cat states, plant lifecycle, progress, events history
- Cliente-side: dos slices Zustand
  - `useGameStore` (SESSION, ephemeral): currentRoom, cutrecoins de sesión, alexMode
  - `useProgressStore` (PROGRESS, persisted localStorage `theflat:progress` v1): introPlayed, unlockedRooms[], apartmentEverEntered. Caché del progreso para que el cliente decida routing sin esperar a Supabase y para que la intro/keypad no se repitan si la red falla.

## Development Roadmap (22 days)

### Week 1 (Apr 19-27): Foundations
- Days 1-2: Next.js + Phaser + Supabase setup, auth, deploy
- Days 3-4: Tilesets prep, tilemap in Tiled, load in Phaser, María sprite
- Days 5-6: Object interaction system, dialogue system, base UI, system anchors
- Day 7: IntroScene (LoL cutre) + HubScene (rellano + keypad) + routing por `introPlayed`
- Day 7.5: Muros temáticos bloqueando habitaciones (cada uno hospeda un minijuego de unlock)
- Day 8: 3 gatos AI básica (Haku roam, Kero tamagotchi en cocina/María, Nala en hab. Alex)

### Week 2 (Apr 28 - May 4): Core Systems
- Days 9-10: Realtime sync, admin dashboard, invisible mode, spawn system
- Days 11-12: Admin events panel, jumpscares, cat control, notes system
- Days 13-14: Drag & drop decoration, shop, diary, mirror; **Character Generator del armario diseñado desacoplado para reciclarse como creador de avatar multi-usuario en el Hub**
- Day 15: Day/night cycle, weather system, dynamic lighting

### Week 2 (Apr 28 - May 4): Cats + PC + Cozy Core
- Day 9: minijuegos por gato (Tinder Cat Nala, Wordle Haku, Where's Kero) + Compartir Momento Kero + Rythm Acariciar Nala + cooldowns + 3 regalos IRL + app Regalos en PC María (canje download PNG)
- Days 10-11: Sistema operativo del PC María (ventanasnp, apps modulares, escritorio cozy)
- Day 12: Hacking PC Alex → desbloquea hatch a habitación secreta (mini-juego coding)
- Days 13-14: Cozy core (inventario objetos físicos + mover muebles drag&drop + decoración)
- Day 15: Multiplayer base (crear PJ + persistencia avatar + entrar al rellano como invitado/propietario)

### Week 3 (May 5-11): Multiplayer + Polish + Lobby
- Days 16-17: Console arcade hub (TV + 2-3 mini arcades coop sofá/remoto) + cooking system
- Day 18: Terraza panorama + plants (riego diario, mueren si descuidas)
- Day 19: Polish gatos (Haku admin invisible paranormal + lofi dark, Nala cockblocker/crush ranking, witching hour 3am)
- Day 20: Sala de Conspiración + Hatch lobby (cada casa tiene escape hatch que lleva al HUB COMPARTIDO entre casas — sirve de lobby multiplayer; la habitación secreta tras hacking se vuelve la entrada al hub conspirativo con tablones, teorías, etc.)
- Day 21: SONOTEX (audio bus + todos los sonidos del juego)
- Day 22: QA + deploy

## Key Technical Decisions
- Phaser 3 runs inside a Next.js component (not iframe)
- Supabase Realtime for all Alex↔María sync
- Zustand for client-side game state, dividido en SESSION + PROGRESS (este último persistido)
- Tiled editor for tilemap creation
- Cloud save on every significant state change
- Admin dashboard is a separate Next.js route (/admin) with its own auth
- HUB multi-usuario desde el día 1: cada futuro destinatario tendrá su puerta (2A/2B/…) con su propio `APARTMENT_CODE`. Por ahora el código está hard-coded a `'110526'` en `gameStore.ts`; cuando se haga multi-user pasará a server-side asociado al player.
- Character Generator (Día 13-14) diseñado desde el inicio como módulo desacoplado: misma API en el armario (customización dentro del piso) y en el Hub (creación de avatar al conectarse). Recibe `avatar_config` y pinta — no asume que el sujeto sea María.
- Setup de personajes centralizado en `src/game/systems/CharacterSetup.ts` (`setupMaria` idempotente). Ambas escenas (HubScene y ApartmentScene) lo invocan; la idempotencia evita que el cambio de escena invalide los frames cacheados por las animaciones globales (bug observado: crash `sourceSize null` al `sprite.play` tras Hub→Apartment).
- Habitaciones unlockables como tipo de primera clase (`UnlockableRoom`): cocina, baño, hab. María, hab. Alex, terraza. "entrada" y "salón" siempre abiertas.
- Interactables del floorplan = system anchors fijos (TV+console, fridge+stove, telescope, PC, bed, etc.). Cada uno hospeda un minijuego o sistema. NO son customizables — la decoración (drag & drop) va en sistema separado (Día 13-14) con tablas Supabase dedicadas.
- Filosofía "cutre consciente": estética intencionalmente heterogénea por contexto/escena. Aceptado como feature, no como bug.
- **Plataforma: PC ONLY**. El juego se diseña 100% para teclado (WASD movimiento, E interacción, teclas específicas por minijuego). NO hay plan de soporte móvil/táctil — María juega exclusivamente en su laptop. Esto simplifica decisiones de UI (no hace falta hit-area mínima 44px, no hay layout responsive condicional, los hints muestran teclas literales como "F = nudillo izq").
- **Render pixel-art**: viewport interno 480×270, escalado a la ventana con integer scaling cuando posible. `pixelArt: true` + `roundPixels: true` para evitar blur al escalar. NO se usa antialias.
- **Tipografía pixel (Día 8.5 — completado)**: Silkscreen cargada via `next/font/google` en `layout.tsx` (inlineada en build, sin request runtime). BootScene espera `document.fonts.ready` antes de pasar a la siguiente escena (con timeout defensivo de 1500ms). Presets centralizados en `src/game/systems/TextStyle.ts`: `S.header()`, `S.dialog()`, `S.body()`, `S.hint()`, `S.prompt()`, `S.speaker()` — cada uno acepta override puntual `{ color, bold, italic, align, wordWrap, lineSpacing, fontSize }`. Paleta limitada en `COLORS` (yellow / alex teal / maria pink / success green / error red / textBeige / textBrown / gray). FONT_STACK = `"'Silkscreen', monospace"` con fallback inmediato. Migración hecha en: DialogSystem, MinigameIntroPanel, InteractionSystem, ApartmentScene HUD, IntroScene, HubScene, los 5 minijuegos. Pendiente migración a presets puros en los minijuegos (ahora usan FONT_STACK pero con tamaños ad-hoc).
- **Portraits (Día 8.5)**: sistema de retratos para diálogos en `src/game/systems/Portraits.ts`. Cada speaker key ('maria', 'alex', futuros 'kero'/'haku'/'nala') tiene un crop **16×24** (cabeza + hombros, antes 16×16 sólo cráneo) extraído de la sprite sheet del personaje, registrado como frame `__portrait` dentro de la texture (idempotente). DialogSystem extendido: `show(pages, { speaker, portrait })` muestra un cuadro **36×52** a la izquierda con cabeza+hombros escalado 2×, y desplaza speaker/text a la derecha. El nombre del speaker se colorea automáticamente según quién hable (Alex teal, María pink, otros yellow). Si `portrait` se omite pero `speaker` está, intenta match por `speaker.toLowerCase()`. Si no hay portrait registrado, se cae a "sólo texto". `Portraits.register(scene)` se llama en ApartmentScene.create antes del DialogSystem. Para Día 8 (gatos), añadir `kero/haku/nala` al objeto `DEFS` cuando los sprites se carguen en BootScene.
- **Tipografía — fix it.8.5b**: `document.fonts.ready` puede resolver ANTES de que la fuente real (.woff2) termine de descargar — en Chromium, ready se cumple cuando el CSS @font-face se parsea, no cuando el binario llega. Fix: usar `document.fonts.load('14px Silkscreen')` (con `bold 14px` también) en BootScene, que devuelve promise cuando la fuente está REALMENTE disponible para pintar. Timeout defensivo subido a 3s. Refuerzo extra: aplicar `font-family: var(--font-silkscreen), 'Silkscreen', monospace` al `body` en globals.css para forzar al navegador a descargar la fuente desde el primer render.
- **DialogSystem panel (Día 8.5)**: altura 56→70 para acomodar Silkscreen 11px y portrait 36×36. Posiciones del speaker/text se desplazan dinámicamente cuando hay portrait. Word wrap se recalcula según el ancho restante. Al cerrar, el portrait se destruye y se resetean posiciones base.
- **3 gatos AI — base montada (Día 8) + personalidades cerradas (Día 19 polish)**:
  - **KERO** (tamagochi, autista fumador de otra vida): panel con 3 barras HAMBRE/SUEÑO/AMOR (basic Día 19). Hambre baja con tiempo → comer en fridge restaura. Sueño baja → cama Kero restaura. Amor sube con caricias (E). Animaciones idle "raras" (mira al techo, paraliza 5s, etc.) — narrativa "fumador de otra vida".
  - **HAKU** (el único que habla, nacido viernes 13): único gato con typewriter dialog. Conoce estado de REGALOS-EXPERIENCIA IRL — hint sutil de si quedan ("aún hueles a algo que no has descubierto") o están todos ("ya está, María"). MODO ADMIN INVISIBLE: cuando Alex conectado como admin invisible (futura feature), Haku es el ÚNICO NPC que lo ve. Sigue al admin, lo mira, diálogos paranormales ("hay alguien aquí. lo huelo.") + SFX lofi dark mientras habla (Día 18 SONOTEX). Easter egg: si la fecha del cliente es viernes 13 IRL, Haku tiene cumpleaños → diálogo especial.
  - **NALA** (la putona enamorada de Alex): sigue a Alex cuando conectado a 2-3 tiles. Detalles pendientes de elegir de la lista de 7 ideas (cockblocker, crush ranking en panel, rechaza a María si Alex conectado, roba sitio en sofá, reactiva al móvil de Alex, TV con prota masculino, roza-piernas).
  - Trigger spawn: cinemática única cuando los 5 muros estén KO. María se congela, cámara cuts a puerta principal, 3 gatos entran en single-file (Kero → Haku → Nala). Tras spawn quedan persistentes (`catsSpawned` en gameStore).

**Arquitectura Día 8 + iter polish — gatos AI (it.8c rework)**:
- **Convención unificada de sprites**: cada animación es UN PNG strip horizontal de N frames 32×32, vista lateral derecha. Flip X para mirar izquierda. Up/down se renderizan con el mismo sprite lateral (gato siempre visto de lado). Texture key: `<catId>-<animName>` (ej. `kero-walk`).
- **Animaciones canónicas** (CatAnimations.ts las registra todas las que existan, fail-safe): idle / walk / sprint / playful / eat / drink / purr / sleep / stretch / meow / groom. Frame rates ajustados por anim (idle 4fps, walk 8fps, sprint 14fps, sleep 2fps, etc). `stretch` y `meow` no loopean (puntuales).
- Sprite animado opcional vs procedural: si `<catId>-idle` existe registrada, Cat usa `Phaser.Sprite`. Si no, fallback Graphics procedural. Día 8c: sólo Kero tiene PNGs (idle/walk/sprint cargados). Haku/Nala procedural hasta tener PNGs propios.
- **FSM por gato (vida propia, NO tamagochi)**: cada gato tiene `state: CatState` (uno de los 11 anims). CatSystem llama a `pickStateFor(catId, hour, ctx)` cada vez que se cumple la duración del state actual (`STATE_DURATION_MS`). `pickStateFor` usa pesos por banda horaria (`GLOBAL_SCHEDULE`) modificados por `personality.modifyWeights` y elige random ponderado. Resultado: cada gato camina/come/duerme/etc CUANDO QUIERE según su personalidad — María no controla nada.
- **Lock al interactuar**: cuando se abre el menú del gato, `cat.setFrozen(true)` para que el gato se quede inmóvil mientras el menú está abierto. ApartmentScene también congela al player via `catSystem.isMenuOpen()`.
- `CatPersonalities.ts` define por gato: pool de diálogos (generic + byActivity + easterEgg), override de actividad sobre el schedule global, y check de easter egg.
  - **Kero** (autista fumador): override hambriento 7-11 (ACTIVE), siesta gorda 14-17 (LAZY). Easter egg: 16:20-16:25 (4:20) → diálogo "huele a hierba".
  - **Haku** (habla, viernes 13): override noctámbulo 22-2 (ACTIVE). Easter egg: viernes 13 IRL → diálogos "mi día" + modo tenebre escena (overlay rojizo + vignette negro + bg cámara casi negro).
  - **Nala** (putona): override ACTIVE permanente si Alex conectado. Easter egg: mirada fija de María >5s sin moverse cerca de Nala → "te guiña un ojo".
- Tracking de "mirada fija Nala" en CatSystem.update(): `nalaStareSinceMs` se setea cuando María está cerca y no se mueve, se resetea si se mueve o tras interactuar.
- `setAlexConnected(bool)` en CatSystem para que Día 19 (cuando Alex tenga sesión real) lo conecte y Nala pase a walk/sprint constante (lo busca).
- **CatMenu** (`src/game/systems/CatMenu.ts`): panel modal por gato. `showCatMenu(scene, opts) → Promise<CatMenuChoice>`. Opciones: `talk` (diálogo), `play` (minijuego — Día 13+), `gift` (regalo IRL — Día 13+), `close`. Navegación con flechas/WS, SPACE/ENTER selecciona, ESC cierra. Portrait + nombre + subtítulo (state actual del gato: "comiendo", "ronroneando"...).
- **Sin tamagochi**: los gatos viven con FSM autónoma. Los regalos IRL se desbloquean ganando minijuegos (1 por gato).

**Día 9 — Minijuegos por gato + regalos IRL** (cerrado para arrancar):
- **Haku**: 4 opciones en menú: hablar / acariciar / preguntar (Haku te dice cuántos regalos te quedan por desbloquear, hint sutil) / Wordle. Wordle es el clásico — pool ~500-1000 palabras 5 letras es, seed por fecha YYYY-MM-DD, 6 intentos, feedback verde/amarillo/gris, cooldown 24h.
- **Kero**: 3 opciones: acariciar / Where's Kero (escenarios estilo Where's Waldo, varios Keros escondidos para clickear antes de timeout, cooldown 24h) / Compartir un momento (mini cinemática cozy: María se sienta junto a Kero, luz cálida, partículas, mini corazones rosa flotando entre las cabecitas, texto sutil narrativo. Sin gameplay, sin cooldown).
- **Nala**: 3 opciones: acariciar / Tinder Cat / Rythm Acariciar.
  - **Tinder Cat**: app pixel-art tipo Tinder dentro del minijuego. Pool ~25 gatos pixel-art generados procedural, cada uno con 2-3 "fotos" + nombre absurdo + edad + bio chistosa. Personalidades variadas (heterobásico, LGTBQ+, gato perfecto, hippie, edgelord, influencer 17k MeowGram, pijo Sotogrande, místico, comunista, facha "croquetas españolas", racista/homófobo SUTIL desde el respeto — humor negro tipo Tinder real, María tiene ese humor). Swipe ← / → o A/D. Si match → chat scripteado (María "escribe" pero las respuestas del gato siguen guion según personalidad, independiente del input real). Sin cooldown, replayability natural por pool grande. Sin regalo (entretenimiento puro).
  - **Rythm Acariciar**: 8-16 puntos rítmicos en barra horizontal, SPACE en cada uno. Si fallas → cooldown 12h. Si clavas todo perfecto la primera vez → desbloquea el regalo IRL. Después → libre.

**Regalos IRL — alineados temáticamente**:
- **Haku** (sabio sofisticado) → **Cena en restaurante**. Ticket directo, canjeable.
- **Nala** (romántica) → **Escapada de fin de semana**. Ticket directo, canjeable.
- **Kero** (misterioso) → **Ticket misterioso con código en reverso**. NO es canjeable como los otros — en la app Regalos del PC María, este ticket tiene un botón "voltear" que muestra un código alfanumérico. María tiene que LLEVAR el código al PC de Alex para usarlo. Es la primera pieza narrativa del puzzle (relacionado con hacking puerta secreta / sala conspiración).

**Canje regalo IRL — App "Regalos" en PC María** (no inventario flotante, decisión: PC sólo, más diegético):
1. Ganar minijuego primera vez → cuadro narrativo "ha aparecido un sobre".
2. Nueva app "Regalos" en PC María. Tickets como cards visuales bonitas; los aún-no-desbloqueados como silueta gris (intriga).
3. Click ticket → panel arte + descripción + botón "Canjear".
4. Formulario: fecha preferida, persona invitada (default Alex), comentarios.
5. Submit → canvas compone PNG con datos sobre arte base → **descarga automática al PC del jugador** (`download` attribute en `<a>`).
6. Persistencia: `redeemedGifts: Record<GiftId, RedemptionData>` en store. El ticket queda marcado como canjeado pero re-descargable.

**Cooldowns**:
- Minijuegos principales con regalo (Wordle, Where's Kero, Rythm Nala): 24h tras completar (gane o pierda).
- Tinder Cat (sin regalo): sin cooldown.
- Rythm Nala (con regalo): 12h SÓLO si fallas. Si clavas → libre.
- Botones extra ambientales (Compartir Momento Kero): sin cooldown.

**Decisiones futuras importantes** (notas para retomar):
- Sistema de inventario (Día 13-14): para objetos físicos del piso, NO los tickets (esos van a app PC).
- Customización drag&drop muebles: Día 13-14 (cozy core).
- Multiplayer (Día 15): crear PJ + persistencia avatar + entrar como invitado/propietario por puerta. El rellano se vuelve servidor compartido.
- Hatch a HUB COMPARTIDO (Día 20): cada casa tiene escape hatch que lleva al lobby multi entre casas. Sala de Conspiración (tras hackear puerta secreta desde PC Alex en Día 12) se vuelve entrada al hub conspirativo.
- Hacking puerta secreta (Día 12): mini-juego "coding" en PC Alex. La primera pieza es introducir el código del ticket misterioso de Kero (Día 9). Después, mecánica coding propia para el unlock final.

**SO compartido — un motor, tres skins**:
- **PC María** (mueble en hab. María): skin escritorio cozy con apps personales (Regalos, notas, fotos, browser, música).
- **PC Alex** (mueble en hab. Alex): mismo SO, skin distinto. Apps propias (introducir código del ticket misterioso de Kero, hacking puerta secreta, herramientas admin si el usuario logueado como Alex está conectado).
- **TV/Consola salón**: mismo SO en "modo consola" — skin minimal tipo Switch/Steam Deck. Menú visual para elegir arcade games. Soporte 1p/2p coop o pvp según el juego.

**Alex como personaje admin in-game** (sustituye consola admin externa):
- Cuando un usuario logueado como Alex entra al rellano/casa, tiene poderes especiales in-game.
- Confirmados: invisibilidad para María (Haku es el ÚNICO que lo ve y reacciona — diálogos paranormales + lofi dark).
- Otros poderes a definir: editar piso ajeno (mover muebles, dejar objetos), plantar notas, encender/apagar luces, etc.
- Acceso a sus poderes desde su PC (apps admin) y/o atajos de teclado in-game cuando es admin.

**Terraza — telescopio panorámico**:
- Telescopio interactuable lleva a sub-escena pixel-art con paisajes de Sevilla.
- Detecta hora local del cliente: 4 fondos pixel art (amanecer / mañana / tarde / noche).
- Clima opcional (decisión: usar OpenWeatherMap free tier para Sevilla, ES) — overlay encima del fondo: lluvia / sol / nubes / niebla. Fallback simulado por estación si la API falla.
- ESC sale del telescopio.

**Plantas — simple cozy**:
- Una acción: regar (E sobre la planta).
- Si pasan X días sin regar → muere (sprite mustio).
- Si muere → la maceta queda vacía, María puede replantar otra (catálogo simple de semillas).
- Sin barras de stats, sin fertilizantes. Cozy puro.
- **Pathfinding tile-a-tile (4-conexión)**: el gato sólo se mueve a tiles ADYACENTES walkable. Cuando llega, asignamos otro adyacente. Evita atravesar paredes en diagonal. Hay sesgo 60% de continuar la dirección previa para que el wander parezca paseo continuo.
- **Schedule de actividad por hora real** (`Date.getHours()` cliente, refresh cada minuto):
  - 00-05 ASLEEP (frozen, sólo decoran). 03-04 FRENZY breve (witching hour).
  - 05-07 LAZY · 07-10 ACTIVE · 10-13 IDLE · 13-16 LAZY (siesta).
  - 16-18 IDLE · 18-20 ACTIVE · 20-22 FRENZY · 22-24 IDLE.
  - Cada activity tiene `speedPxPerFrame` y `wanderInterval` distintos. Día 19 polish añadirá overrides per-cat.

- `src/game/entities/Cat.ts` — entidad por gato. Sprite procedural (Graphics) con cuerpo+cabeza+cola+ojos+sombra. Cada gato tiene `bodyColor / shadeColor / eyeColor` distintivos: Kero naranja+ojos negros, Haku blanco+ojos turquesa, Nala gris+ojos dorados. NameTag flotante visible sólo en proximidad. Movimiento por `step()` hacia `targetTile`, facing left/right por dx, redibujo automático al cambiar facing.
- `src/game/systems/CatSystem.ts` — orquesta los 3 gatos. Spawn cerca de front-door (tile 19,30). Wander aleatorio cada 2-5s en radio de 3 tiles, evitando paredes via `isWallTile`. Registra interactables virtuales `cat-kero/haku/nala` en InteractionSystem que SE MUEVEN con el gato (vía `updateExtraPosition` añadido en it.8). Handler único `'cat'` resuelve qué gato leyendo `interactable.id`. Diálogos placeholder por gato (Día 19 los reemplaza).
- Cinemática: `playEntranceCinematic()` hace fade-out 220ms, spawn los 3 (puerta principal, single-file con stagger), fade-in 380ms, lanza evento `cats:cinematic-line` que la escena padre captura para mostrar diálogo "Han entrado tres gatos. ...vale." con portrait María. `onCinematicStart/End` callbacks permiten a la escena congelar/liberar al player.
- Trigger en runtime: cuando se desbloquea el 5º muro, `LockedWallSystem` emite evento `wall:unlocked`. ApartmentScene lo captura y dispara la cinemática sin esperar al re-entry.
- Persistencia: `catsSpawned: boolean` en `useProgressStore`. Primera vez = cinemática. Re-entradas = spawn directo silencioso. Reset progreso (Ctrl+Shift+R) limpia el flag.
- Día 19 polish montará personalidades sobre esta base sin tocar el spawn ni el wander base.
- **Dev tools (ApartmentScene)** — quitar antes de release. Cambiados a F-keys porque Ctrl+Shift+R/U/C los intercepta el navegador (refresh forzado, view-source, devtools) antes que Phaser. F2/F9/F10 están libres. Implementados con `window.addEventListener('keydown')` con cleanup en scene shutdown:
  - `F2`  reset TODO el progreso (intro + unlocks + cats) + restart.
  - `F9`  unlock las 5 habitaciones + reset cats + restart (dispara cinemática).
  - `F10` reset SOLO catsSpawned + restart (re-ver cinemática sin perder unlocks).
- **Convención controles globales**: `WASD/flechas` movimiento, `E` interacción, `SPACE` y `ENTER` AMBOS válidos para avanzar diálogos / confirmar pop-ups (DialogSystem y MinigameIntroPanel los aceptan ambos por defecto), `ESC` aborta minijuego/diálogo. Cada minijuego tiene sus teclas propias de gameplay (1/2/3 en PPT, F/J en TOC-TOC, A+L/S+K/D+J en CHOCOLATE, A/D + SPACE en LOCKPICK, SPACE en STUCKDOOR).
- **MinigameIntroPanel**: todos los minijuegos abren con un pop-up tutorial (`src/game/minigames/_shared/MinigameIntroPanel.ts`). Función única `showMinigameIntro(scene, { title, description, controls })` que devuelve `Promise<boolean>` (true si confirma, false si ESC). Los textos NO desvelan mecánicas avanzadas — sólo lo necesario para arrancar. Por ejemplo, el de PPT no menciona "entrar en la mente"; el de Chocolate no menciona los timings exactos.
- **PPT mecánica "entrar en la mente"** (mecánica OCULTA — `TIES_NEEDED=3`): para CERRAR el set, María necesita 3 victorias Y 3 EMPATES contra Alex. El contador de empates NO se muestra en UI — María tiene que descubrirlo sola o por hints escalados que Alex suelta tras perder sets. Si llega a game point sin los empates, Alex activa "🧠 estoy en tu mente" → la jugada de María se hijack-ea con el counter perfecto y la pierde (refactor it.5: cada animación tiene un `onComplete` callback explícito en lugar de delayedCalls paralelos que se pisaban con `phase==='mindDialog'` y dejaban el set atascado tras el hijack). Cuando María consigue su 3er empate → halos verde (correcta) y rojos (incorrectas) sobre las opciones + badge `🧠 estás en su mente`. Las pistas en frases de Alex son SUTILES ("qué pereza tengo hoy" = piedra, "voy fino, ¿eh?" = papel, "snip snip" = tijera). Hints entre sets escalan en 6 niveles; intento 6 rompe la 4ª pared con la pista directa. Intentos 5+ usan wait largo (5.5s) para que se lea bien.
- **Lockpick — bug fix it.5**: completar un cuarto cerraba el juego entero. Causa: `quarterFill` no se reseteaba inmediatamente y el `tick` re-disparaba `quarterCompleted` cada frame durante los 280ms de transición al siguiente cuarto. Fix: flag `inQuarterTransition=true` al inicio de `quarterCompleted` que bloquea el tick hasta que `startNewQuarter` se ejecute. Tolerance subida de 8°→12° (sin proximity hint, 8° era too tight para encontrar el sweet spot).
- **Lockpick mecánica ganzúas it.6**: 2 ganzúas (no 3). Cada una tiene un LIFETIME finito de 3.5s de SPACE pulsado, NO regenera. Se consume mientras presionas SPACE — esté o no en el sweet spot. Si presionas en sweet spot avanza el cuarto; si fuera, drena. Romper la 1ª ganzúa → cuadro María random ("no me jodas, menos mal que tenía otra") + continúa con cuarto en progreso. Romper la 2ª → game over con cuadro María frustración random con palabrota ("joder, joder. me cago en la cerradura."). El cuadro de María es modal (bloquea tick), se cierra con SPACE/ENTER o auto-fallback a 3.5s. Slight buff: QUARTER_FILL_MS 700→600, drain mult 1.5→1.0 (al ritmo del fill, no más rápido).
- **PPT it.6 — sin replay**: al perder el set NO se reinicia automáticamente. Aparece el hint de Alex como cuadro `showMindDialog` y al cerrarlo el minijuego termina con `success=false`. María vuelve a interactuar con la pared cuando quiera. El `setAttempt` se persiste en variable módulo (`persistentSetAttempt`) que sobrevive entre intentos del minijuego dentro de la misma sesión del navegador, así los hints siguen escalando. Al ganar el set se resetea. Tiempos del cuadro de hint son adaptativos (~45ms por carácter, mín 2.2s, máx 8s) y el panel del cuadro escala su altura según líneas + wrap del texto.
- **IntroPanel tamaños it.6**: subidos description 8→10px, controls 7→9px, hint 7→9px. Panel pasa de 280×170 a 320×200 para acomodar. Es un parche temporal hasta Día 8.5 (BitmapFont real), pero ya es legible a 4× scale en pantalla completa.
- **DialogSystem — respaldo nativo SPACE/ENTER (it.5)**: Phaser reusa Keys por keycode entre escenas/sistemas. Si un minijuego crea `addKey('SPACE')` con captureEnabled, puede interferir con el listener Phaser del DialogSystem. Solución: además de la Key Phaser, DialogSystem escucha `window.addEventListener('keydown', ...)` con dedupe por timestamp (gap < 60ms = duplicado). Garantiza que SPACE y ENTER siempre avancen el diálogo independientemente de lo que hagan los minijuegos.
- **Patrón cleanup minijuegos**: TODO objeto creado con `scene.add.*()` debe guardarse en una propiedad de instancia para destruirlo en cleanup. NUNCA llamar `keyboard.removeKey()` — Phaser reusa la Key con la apartment scene y romperíamos WASD. Sólo `removeAllListeners()`. Para Colliders: destruir SIEMPRE antes que el StaticGroup que referencian (si no, world.update siguiente crashea con "Cannot read properties of undefined (reading 'size')").
