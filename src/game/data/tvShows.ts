/**
 * Contenido para la TV del salón (S1, Día 10).
 *
 * Cuando María enciende la TV y se sienta en el sofá, se reproduce un
 * "episodio" — un array largo de líneas con personaje. SPACE/ENTER avanza
 * línea a línea. ESC se levanta y deja la tele puesta.
 *
 * Cada `show` tiene varios `episodes`. Al sentarse, se elige episodio
 * random. La idea es 5+ minutos de contenido de fondo si quieres estar
 * sentada un rato.
 *
 * NO son transcripciones literales — son evocaciones que riman con el
 * tono de la serie/peli. Para evitar problemas de copyright + para que
 * el ritmo encaje con el typewriter del juego.
 */

export interface TvLine {
  speaker: string;
  text: string;
}

export interface TvEpisode {
  title: string;
  lines: TvLine[];
}

export interface TvShow {
  id: string;
  /** Color principal del show — bandera del título + canal. */
  color: string;
  title: string;
  episodes: TvEpisode[];
}

/**
 * Mapa de color por personaje. Si un speaker no aparece aquí, se usa el
 * color del show. Mantenemos paleta saturada para que se LEA por encima
 * de cualquier suelo del piso.
 */
export const SPEAKER_COLORS: Record<string, string> = {
  // ─── South Park ───────────────────────────────────────────────
  CARTMAN: '#ef4444',   // rojo gorra
  KYLE: '#22c55e',      // verde gorrito
  STAN: '#3b82f6',      // azul
  KENNY: '#f97316',     // naranja parka
  BUTTERS: '#fde047',   // amarillo suave
  RANDY: '#a3a3a3',     // gris adulto
  SHARON: '#f472b6',    // rosa mamá
  TOWELIE: '#5eead4',   // toalla cyan
  // ─── Shrek ────────────────────────────────────────────────────
  SHREK: '#84cc16',     // verde ogro
  BURRO: '#d6d3d1',     // gris burrito
  FIONA: '#fb923c',     // naranja pelo
  FARQUAAD: '#7c2d12',  // marrón malote
  // ─── Bob's Burgers ────────────────────────────────────────────
  BOB: '#dc2626',       // rojo cocina
  LINDA: '#a855f7',     // morado
  TINA: '#3b82f6',      // azul
  GENE: '#fbbf24',      // amarillo
  LOUISE: '#ec4899',    // rosa orejas conejito
  // ─── Rick & Morty ─────────────────────────────────────────────
  RICK: '#67e8f9',      // cyan pelo
  MORTY: '#fde047',     // amarillo camiseta
  JERRY: '#86efac',     // verde claro
  BETH: '#fb7185',      // rosa
  // ─── Narrador / risas ────────────────────────────────────────
  NARRADOR: '#fbbf24',
  PÚBLICO: '#94a3b8',
  ANUNCIO: '#f43f5e',
};

export function getSpeakerColor(speaker: string, fallback: string): string {
  return SPEAKER_COLORS[speaker.toUpperCase()] ?? fallback;
}

// ─── SOUTH PARK ───────────────────────────────────────────────────────

const SP_E1: TvEpisode = {
  title: 'Cartman tiene un plan',
  lines: [
    { speaker: 'CARTMAN', text: 'Tíos, tengo un plan brutal.' },
    { speaker: 'KYLE', text: 'No, Cartman.' },
    { speaker: 'CARTMAN', text: 'Pero si todavía no lo he dicho.' },
    { speaker: 'KYLE', text: 'No hace falta.' },
    { speaker: 'STAN', text: 'A ver, ¿qué es?' },
    { speaker: 'CARTMAN', text: 'Vamos a montar un imperio de cheesy poofs.' },
    { speaker: 'KENNY', text: '*mffhh mfff!*' },
    { speaker: 'STAN', text: 'Kenny dice que ya lo intentamos.' },
    { speaker: 'CARTMAN', text: 'Esta vez es diferente. Esta vez tengo BLOCKCHAIN.' },
    { speaker: 'KYLE', text: 'Te juro que te voy a empotrar.' },
    { speaker: 'CARTMAN', text: '¡Mamá! ¡Kyle me está amenazando!' },
    { speaker: 'STAN', text: 'Cartman, tienes 10 años.' },
    { speaker: 'CARTMAN', text: 'Y tengo más visión que toda esta ciudad.' },
    { speaker: 'KENNY', text: '*mfff hhh!*' },
    { speaker: 'STAN', text: 'Kenny tiene razón. Esto va a acabar mal.' },
    { speaker: 'CARTMAN', text: 'Pues a mí me va a hacer rico, JUDÍO.' },
    { speaker: 'KYLE', text: 'TE VOY A MATAR.' },
    { speaker: 'STAN', text: 'Y otra vez, lo mismo.' },
    { speaker: 'CARTMAN', text: 'Respeta mi autoridad, hippie.' },
    { speaker: 'KENNY', text: '*mfff!!*' },
    { speaker: 'STAN', text: 'Vámonos.' },
    { speaker: 'KYLE', text: 'Vámonos.' },
    { speaker: 'CARTMAN', text: 'TIOS. TÍOS. ¡VOLVED!' },
    { speaker: 'CARTMAN', text: '...joder.' },
  ],
};

const SP_E2: TvEpisode = {
  title: 'Randy descubre algo',
  lines: [
    { speaker: 'RANDY', text: 'Sharon. SHARON.' },
    { speaker: 'SHARON', text: '...qué.' },
    { speaker: 'RANDY', text: 'He descubierto algo INCREÍBLE.' },
    { speaker: 'SHARON', text: 'Ay, no.' },
    { speaker: 'RANDY', text: 'El bourbon... el bourbon es vino tinto.' },
    { speaker: 'SHARON', text: 'No.' },
    { speaker: 'RANDY', text: '¡Lo es! Tiene uvas y todo.' },
    { speaker: 'SHARON', text: 'Eso es vino. Eso ES vino.' },
    { speaker: 'RANDY', text: 'Pero metido en un BARRIL.' },
    { speaker: 'SHARON', text: 'Voy a llamar a tu madre.' },
    { speaker: 'RANDY', text: 'Voy a montar un negocio.' },
    { speaker: 'SHARON', text: 'No.' },
    { speaker: 'RANDY', text: 'Tegridy Bourbon.' },
    { speaker: 'SHARON', text: 'Que NO.' },
    { speaker: 'RANDY', text: 'Esto va a salvar el rancho.' },
    { speaker: 'SHARON', text: 'El rancho lo HUNDISTE TÚ.' },
    { speaker: 'RANDY', text: 'Y ahora lo voy a salvar. Es CIRCULARIDAD, Sharon.' },
    { speaker: 'SHARON', text: 'Me voy a la cama.' },
    { speaker: 'RANDY', text: '¡SHARON, VENTE A CATAR!' },
    { speaker: 'RANDY', text: '...se ha ido.' },
    { speaker: 'RANDY', text: 'Towelie. ¿Tú qué opinas?' },
    { speaker: 'TOWELIE', text: 'Coleguita, no te olvides la toalla.' },
  ],
};

const SP_E3: TvEpisode = {
  title: 'Butters hace un amigo',
  lines: [
    { speaker: 'BUTTERS', text: '¡Hola!' },
    { speaker: 'BUTTERS', text: '¿Eres mi nuevo mejor amigo?' },
    { speaker: 'BUTTERS', text: 'Yo es que no tengo muchos.' },
    { speaker: 'BUTTERS', text: 'Bueno, ninguno.' },
    { speaker: 'BUTTERS', text: 'Mi padre dice que soy un pequeño desastre.' },
    { speaker: 'BUTTERS', text: 'Pero no en plan malo, ¿eh?' },
    { speaker: 'BUTTERS', text: 'En plan, "qué desastre, monín".' },
    { speaker: 'BUTTERS', text: '...creo.' },
    { speaker: 'BUTTERS', text: '¿Quieres venir a casa?' },
    { speaker: 'BUTTERS', text: 'Tengo galletas.' },
    { speaker: 'BUTTERS', text: 'Mi madre las hizo ayer.' },
    { speaker: 'BUTTERS', text: 'Bueno, las compró.' },
    { speaker: 'BUTTERS', text: 'Pero las puso en un plato.' },
    { speaker: 'BUTTERS', text: 'Y eso CUENTA.' },
    { speaker: 'BUTTERS', text: '...vale, te dejo.' },
    { speaker: 'BUTTERS', text: 'Pero si te aburres, ya sabes.' },
    { speaker: 'BUTTERS', text: 'Casa Stotch. Avisa.' },
    { speaker: 'BUTTERS', text: '¡Cuídate, amigo árbol!' },
  ],
};

// ─── SHREK ───────────────────────────────────────────────────────────

const SHREK_E1: TvEpisode = {
  title: 'En la ciénaga',
  lines: [
    { speaker: 'SHREK', text: 'Los ogros somos como las cebollas.' },
    { speaker: 'BURRO', text: '¿Apestáis?' },
    { speaker: 'SHREK', text: 'NO.' },
    { speaker: 'BURRO', text: '¿Hacéis llorar?' },
    { speaker: 'SHREK', text: 'Tenemos CAPAS, Burro. Capas.' },
    { speaker: 'BURRO', text: 'Ah, capas. Como los pasteles.' },
    { speaker: 'SHREK', text: '...no como los pasteles.' },
    { speaker: 'BURRO', text: 'A todo el mundo le gustan los pasteles.' },
    { speaker: 'SHREK', text: 'Los OGROS no somos pasteles.' },
    { speaker: 'BURRO', text: 'Tampoco le gustáis a la gente.' },
    { speaker: 'BURRO', text: 'Por la cosa esa de las capas.' },
    { speaker: 'SHREK', text: 'Burro.' },
    { speaker: 'BURRO', text: 'Sí.' },
    { speaker: 'SHREK', text: 'Cállate.' },
    { speaker: 'BURRO', text: 'Vale.' },
    { speaker: 'BURRO', text: '...' },
    { speaker: 'BURRO', text: 'Pero tú me has dicho que somos amigos.' },
    { speaker: 'SHREK', text: 'Eso fue HACE DOS HORAS, BURRO.' },
    { speaker: 'BURRO', text: 'Las amistades duran toda la vida.' },
    { speaker: 'BURRO', text: 'Como los pasteles.' },
    { speaker: 'SHREK', text: '*suspira hondo*' },
  ],
};

const SHREK_E2: TvEpisode = {
  title: 'El castillo de Farquaad',
  lines: [
    { speaker: 'BURRO', text: 'Tío. ¿Has visto qué castillo tan GRANDE?' },
    { speaker: 'SHREK', text: 'Sí.' },
    { speaker: 'BURRO', text: 'Y qué pequeño está compensando.' },
    { speaker: 'SHREK', text: 'Burro, eres más listo de lo que pareces.' },
    { speaker: 'BURRO', text: '¡GRACIAS!' },
    { speaker: 'BURRO', text: '¡Espera, eso es un cumplido al revés!' },
    { speaker: 'SHREK', text: 'Lo es.' },
    { speaker: 'BURRO', text: 'TÍO.' },
    { speaker: 'SHREK', text: '*entrando al castillo*' },
    { speaker: 'FARQUAAD', text: 'Caballeros. Es la hora de los héroes.' },
    { speaker: 'FARQUAAD', text: 'Algunos de vosotros moriréis.' },
    { speaker: 'FARQUAAD', text: 'Pero es un sacrificio que estoy dispuesto a hacer.' },
    { speaker: 'BURRO', text: 'Este tío.' },
    { speaker: 'BURRO', text: 'Qué malo es.' },
    { speaker: 'SHREK', text: 'Sí.' },
    { speaker: 'BURRO', text: '¡Y qué bajito!' },
    { speaker: 'SHREK', text: 'Eso ya lo dijiste.' },
    { speaker: 'BURRO', text: 'Pero es que ES.' },
    { speaker: 'FARQUAAD', text: '¡Atrapadlos!' },
    { speaker: 'BURRO', text: 'Shrek. Shrek. SHREK.' },
    { speaker: 'SHREK', text: 'CORRE, BURRO.' },
  ],
};

const SHREK_E3: TvEpisode = {
  title: 'Fiona se transforma',
  lines: [
    { speaker: 'FIONA', text: 'No me mires.' },
    { speaker: 'SHREK', text: '...estás verde.' },
    { speaker: 'FIONA', text: 'YA LO SÉ.' },
    { speaker: 'SHREK', text: 'Pero verde-verde. Como yo.' },
    { speaker: 'FIONA', text: 'Es un hechizo. De noche soy esto.' },
    { speaker: 'SHREK', text: 'A mí me pareces guapa.' },
    { speaker: 'FIONA', text: '...¿qué?' },
    { speaker: 'SHREK', text: 'Que. Me pareces. Guapa.' },
    { speaker: 'FIONA', text: 'Pero soy un OGRO.' },
    { speaker: 'SHREK', text: 'Y yo.' },
    { speaker: 'FIONA', text: '...ya.' },
    { speaker: 'BURRO', text: '*aparece de la nada*' },
    { speaker: 'BURRO', text: '¡QUÉ MOMENTO!' },
    { speaker: 'BURRO', text: '¡QUÉ FOTOGRAMA!' },
    { speaker: 'SHREK', text: 'BURRO.' },
    { speaker: 'BURRO', text: 'Vale, me piro. Pero esto se cuenta luego, ¿eh?' },
    { speaker: 'BURRO', text: 'Capítulo nuevo. Pasteles.' },
    { speaker: 'FIONA', text: '¿Pasteles?' },
    { speaker: 'SHREK', text: 'No preguntes.' },
  ],
};

// ─── REGISTRO ────────────────────────────────────────────────────────

// ─── BOB'S BURGERS ────────────────────────────────────────────────────

const BB_E1: TvEpisode = {
  title: 'El especial del día',
  lines: [
    { speaker: 'BOB', text: 'El especial de hoy: la hamburguesa "estoy harto".' },
    { speaker: 'LINDA', text: '¡Esa es buena, Bobby!' },
    { speaker: 'TINA', text: 'Papá. He escrito una historia.' },
    { speaker: 'BOB', text: 'Ahora no, Tina.' },
    { speaker: 'TINA', text: 'Trata sobre caballos. Y zombis.' },
    { speaker: 'GENE', text: '¡ZOMBI CABALLO!' },
    { speaker: 'LOUISE', text: 'Mejor: zombi-caballo-presidente.' },
    { speaker: 'LINDA', text: 'A mí me gusta cómo suena.' },
    { speaker: 'BOB', text: 'No me gusta cómo suena nada de esto.' },
    { speaker: 'TINA', text: 'Empieza así: "era una mañana cualquiera..."' },
    { speaker: 'GENE', text: '¡Y entonces ZOMBI CABALLO!' },
    { speaker: 'TINA', text: 'Gene. NO está en la primera línea.' },
    { speaker: 'LOUISE', text: 'Debería estarlo. Engancha más.' },
    { speaker: 'BOB', text: '¿Hay algún cliente? ¿alguno? ¿uno solo?' },
    { speaker: 'LINDA', text: 'Hay uno. Pero está dormido.' },
    { speaker: 'BOB', text: 'Genial.' },
    { speaker: 'TINA', text: 'Papá. Aún quedan 14 páginas.' },
    { speaker: 'BOB', text: '*suspira*' },
  ],
};

const BB_E2: TvEpisode = {
  title: 'Louise vs. el barrio',
  lines: [
    { speaker: 'LOUISE', text: 'He decidido tomar el barrio.' },
    { speaker: 'LINDA', text: 'Cariño, tienes nueve años.' },
    { speaker: 'LOUISE', text: 'Por eso mismo nadie me ve venir.' },
    { speaker: 'TINA', text: 'Yo te apoyo. Pero pacíficamente.' },
    { speaker: 'GENE', text: 'Yo te apoyo. Pero con sintetizador.' },
    { speaker: 'LOUISE', text: 'Necesito infantería, no banda sonora.' },
    { speaker: 'BOB', text: 'Necesitas hacer los deberes.' },
    { speaker: 'LOUISE', text: 'Los deberes son una conspiración del estado.' },
    { speaker: 'BOB', text: 'No, los deberes son matemáticas.' },
    { speaker: 'LOUISE', text: 'Exacto.' },
    { speaker: 'LINDA', text: '¡Esa frase la voy a apuntar!' },
    { speaker: 'TINA', text: '"Los deberes son matemáticas". *taquigrafía*' },
    { speaker: 'GENE', text: '*riff de sintetizador triunfal*' },
    { speaker: 'BOB', text: 'Esta familia me mata.' },
  ],
};

// ─── RICK & MORTY ─────────────────────────────────────────────────────

const RM_E1: TvEpisode = {
  title: 'Aventura interdimensional',
  lines: [
    { speaker: 'RICK', text: 'Morty. *eructo* Morty.' },
    { speaker: 'MORTY', text: '¿S-sí, Rick?' },
    { speaker: 'RICK', text: 'Tienes que ayudarme con una cosa.' },
    { speaker: 'MORTY', text: 'Ay no.' },
    { speaker: 'RICK', text: 'Aún no he dicho qué es.' },
    { speaker: 'MORTY', text: 'Pero ya he visto cómo acaba.' },
    { speaker: 'RICK', text: 'Eso es porque te VIVO el futuro, Morty.' },
    { speaker: 'RICK', text: 'En el 90% de las realidades, hoy es martes.' },
    { speaker: 'MORTY', text: 'Eso no me ayuda.' },
    { speaker: 'JERRY', text: '¡Hola, familia!' },
    { speaker: 'RICK', text: 'Jerry, vete.' },
    { speaker: 'JERRY', text: '¡Pero acabo de llegar!' },
    { speaker: 'RICK', text: 'En el 90% de las realidades, Jerry, ya te has ido.' },
    { speaker: 'MORTY', text: 'Esto es muy triste, Rick.' },
    { speaker: 'RICK', text: 'La existencia es muy triste, Morty.' },
    { speaker: 'RICK', text: 'Vamos a la nave. *eructo*' },
  ],
};

// ─── REGISTRO ────────────────────────────────────────────────────────

export const TV_SHOWS: TvShow[] = [
  {
    id: 'south-park',
    color: '#ef4444',
    title: 'South Park',
    episodes: [SP_E1, SP_E2, SP_E3],
  },
  {
    id: 'shrek',
    color: '#84cc16',
    title: 'Shrek (la peli, otra vez)',
    episodes: [SHREK_E1, SHREK_E2, SHREK_E3],
  },
  {
    id: 'bobs-burgers',
    color: '#dc2626',
    title: "Bob's Burgers",
    episodes: [BB_E1, BB_E2],
  },
  {
    id: 'rick-morty',
    color: '#67e8f9',
    title: 'Rick & Morty',
    episodes: [RM_E1],
  },
];

/** Elige show + episodio random. */
export function pickRandomTvEpisode(): { show: TvShow; episode: TvEpisode } {
  const show = TV_SHOWS[Math.floor(Math.random() * TV_SHOWS.length)];
  const episode = show.episodes[Math.floor(Math.random() * show.episodes.length)];
  return { show, episode };
}
