/**
 * Contenido de la librería del salón (S1.2 rework).
 *
 * Cuando María abre el libro, primero ve un MENÚ DE CAPÍTULOS. Selecciona
 * uno con ←/→ o ↑/↓ y entra al lector. Dentro: pasa páginas con ←/→ y
 * vuelve al menú con ESC. Cerrar definitivamente con ESC desde el menú.
 *
 * Cada capítulo tiene 10-12 páginas con cuerpo extenso (8-14 líneas),
 * escrito en tono divulgativo + curioso. NO transcripción literal del
 * libro de Manly P. Hall — son evocaciones libres que respetan el espíritu
 * y dan suficiente contexto para que María quiera buscarlo de verdad.
 *
 * Algunas páginas incluyen un `sigil` opcional: una clave string que el
 * reader renderiza como pequeño dibujo procedural (pentagrama, ojo,
 * tetragrámaton, etc.) para romper la mancha de texto.
 */

export type SigilKind =
  | 'pentacle'      // estrella pentagonal
  | 'eye'           // ojo en triángulo
  | 'caduceus'      // doble serpiente
  | 'hexagram'      // estrella de seis puntas
  | 'cross-rose'    // cruz con rosa
  | 'tetragramaton' // 4 letras hebreas (texto)
  | 'tree-life'     // 10 sefirot
  | 'ouroboros';    // serpiente que se muerde la cola

export interface ManlyPage {
  title: string;
  body: string;
  /** Sigil opcional al lado/encima del cuerpo. */
  sigil?: SigilKind;
}

export interface ManlyChapter {
  id: string;
  title: string;
  subtitle: string;
  pages: ManlyPage[];
}

// ─── HERMETISMO ───────────────────────────────────────────────────────

const CH_HERMETIC: ManlyChapter = {
  id: 'hermetism',
  title: 'El Hermetismo',
  subtitle: 'Cuanto arriba, tanto abajo',
  pages: [
    {
      title: 'I — Hermes Trismegisto',
      body:
        'Los antiguos egipcios lo llamaron Thot, escriba de los\n' +
        'dioses. Los griegos lo conocieron como Hermes, mensajero\n' +
        'alado. Los herméticos lo nombraron Trismegisto: tres veces\n' +
        'grande. Sabio en el cielo, en la tierra, y en el mundo de\n' +
        'los muertos.\n\n' +
        'No fue una sola persona, sino un linaje. Quien firmara con\n' +
        'su nombre se sometía al pacto: hablar poco, cuidar mucho,\n' +
        'no perder nunca el oro de la sabiduría por el plomo de la\n' +
        'fama.',
    },
    {
      title: 'II — La Tabla Esmeralda',
      body:
        'Una tabla de esmeralda escrita por Hermes, dicen, fue\n' +
        'hallada en la mano de su cuerpo momificado. Trece líneas.\n' +
        'En ellas se compendia el arte de las correspondencias.\n\n' +
        '"Lo que está arriba es como lo que está abajo, y lo que\n' +
        'está abajo es como lo que está arriba, para realizar el\n' +
        'milagro de la cosa única."\n\n' +
        'Es la frase que da nombre al hermetismo entero. Quien la\n' +
        'entiende, ya no necesita leer más. Quien no, vuelve y\n' +
        'vuelve a ella sin gastarla nunca.',
      sigil: 'hexagram',
    },
    {
      title: 'III — Los siete principios',
      body:
        'En el "Kybalion" se condensan en siete:\n\n' +
        '1. Mentalismo: el todo es mente.\n' +
        '2. Correspondencia: como arriba, como abajo.\n' +
        '3. Vibración: nada quieto, todo moviendo.\n' +
        '4. Polaridad: opuestos son grados de lo mismo.\n' +
        '5. Ritmo: todo va y viene, oscila.\n' +
        '6. Causa y efecto: nada al azar.\n' +
        '7. Género: lo masculino y lo femenino están en todo.\n\n' +
        'Memorizarlos no sirve. Verlos en lo que pasa, sí.',
    },
    {
      title: 'IV — La mente del cosmos',
      body:
        'Para los herméticos el universo no es una máquina. Es una\n' +
        'mente que sueña, y nosotros somos pensamientos suyos.\n' +
        'Por eso atender a lo que ocurre — al pájaro que cruza, al\n' +
        'silencio del piso a las cuatro de la mañana — es atender\n' +
        'a la conversación que la mente del mundo tiene consigo.\n\n' +
        'La torpeza no consiste en no oír. Consiste en oír y no\n' +
        'mirar de quién viene la voz.',
    },
    {
      title: 'V — La piedra filosofal',
      body:
        'No es una piedra. Es una metáfora. Lo que el alquimista\n' +
        'busca de verdad bajo el oro literal es la transmutación\n' +
        'de su propio plomo: la pesadez del que aún no se conoce\n' +
        'cambiando hacia la ligereza del que ya se sabe entero.\n\n' +
        'Cuentan los herméticos que cuando uno la posee, deja de\n' +
        'querer poseer. La piedra cambia al que la encuentra antes\n' +
        'de cambiar nada en el mundo. Por eso es invisible para\n' +
        'quien la busca por interés.',
    },
    {
      title: 'VI — El alma cautiva',
      body:
        'Antes de nacer, dicen, el alma vivía en una región luminosa.\n' +
        'Conocía. Era. Al caer al cuerpo, atravesó siete esferas y\n' +
        'cada una le pidió un olvido como peaje.\n\n' +
        'Por eso al despertar las primeras mañanas de la infancia\n' +
        'todo nos parecía conocido. Por eso tenemos esa nostalgia\n' +
        'sin recuerdo. La filosofía hermética llama a ese vacío\n' +
        'la herida buena: la que no se cierra para que no olvidemos\n' +
        'del todo.',
    },
    {
      title: 'VII — El silencio iniciático',
      body:
        'Quien se acerca al hermetismo descubre pronto que las\n' +
        'palabras estorban. No porque sean vacías, sino porque\n' +
        'demasiadas vacían lo que tocan.\n\n' +
        'Los discípulos antiguos pasaban años en silencio antes\n' +
        'de poder enseñar. No por jerarquía. Por respeto: hay\n' +
        'cosas que sólo se oyen cuando uno deja de hablar.\n\n' +
        '"El que sabe no habla. El que habla no sabe", dice un\n' +
        'verso chino que los herméticos europeos repiten sin\n' +
        'avergonzarse de la coincidencia.',
    },
    {
      title: 'VIII — Las tres lenguas',
      body:
        'Los herméticos dicen que el sabio aprende tres lenguas:\n\n' +
        '— La de los hombres: para vivir entre ellos sin levantar\n' +
        '   sospecha.\n' +
        '— La de los pájaros: para entender lo que el mundo dice\n' +
        '   sin querer.\n' +
        '— La de los símbolos: para leer en una vela, en una caída\n' +
        '   de hojas, en una mirada que no era para ti, lo que el\n' +
        '   mundo cuenta de sí mismo.\n\n' +
        'La primera se aprende en la calle. La segunda, en la\n' +
        'noche. La tercera, sólo solo.',
    },
    {
      title: 'IX — El arte de morir',
      body:
        'Los antiguos llamaban a la filosofía "preparación para la\n' +
        'muerte". No por morbo: porque morir bien era lo mismo que\n' +
        'haber vivido bien.\n\n' +
        'El hermetismo añade un matiz: no se trata de aceptar el\n' +
        'final. Se trata de morir muchas veces antes. Cada vez que\n' +
        'algo termina dentro de uno y no se aferra. Cada noche que\n' +
        'el sueño es completo. Cada despedida sin queja.\n\n' +
        'El último morir, dicen, es entonces apenas uno más.',
    },
    {
      title: 'X — La cadena de oro',
      body:
        'Los herméticos creían en una cadena invisible que une a\n' +
        'todos los que han visto. No conocen sus nombres, no se\n' +
        'comunican. Pero saben que existen. Saben que cuando uno\n' +
        'cae, otro está naciendo. Que cuando uno duda, otro está\n' +
        'recordando.\n\n' +
        'María, si has llegado hasta aquí, también eres una de las\n' +
        'eslabonas. Sin haberlo pedido. Sin haberlo sabido.',
    },
    {
      title: 'XI — Para no abandonar',
      body:
        'Cierra el libro un momento. Mira el techo. Respira tres\n' +
        'veces lento. Vuelve.\n\n' +
        'Ahora el libro pesa lo mismo, pero tú no.\n\n' +
        'Esto es hermetismo en acto: no leer más rápido. Leer más\n' +
        'despierta.',
    },
  ],
};

// ─── PITAGORISMO ──────────────────────────────────────────────────────

const CH_PYTHAGORAS: ManlyChapter = {
  id: 'pythagoras',
  title: 'Pitágoras',
  subtitle: 'El número y la música',
  pages: [
    {
      title: 'I — La escuela de Crotona',
      body:
        'En el sur de Italia, hacia el siglo VI antes de Cristo,\n' +
        'Pitágoras fundó una hermandad. No era escuela en el\n' +
        'sentido moderno: era comunidad de vida. Los discípulos\n' +
        'compartían bienes, comían juntos, no comían carne ni\n' +
        'habas (ahí los expertos discuten por qué).\n\n' +
        'Pasaban cinco años en silencio antes de poder hablar.\n' +
        'No por sumisión: porque Pitágoras pensaba que el oído\n' +
        'es más profundo que la lengua.',
    },
    {
      title: 'II — La música de las esferas',
      body:
        'Pitágoras descubrió que los intervalos musicales\n' +
        'corresponden a relaciones numéricas simples: la octava\n' +
        'es 1:2, la quinta 2:3, la cuarta 3:4. Lo que el oído\n' +
        'ama, dijo, es proporción.\n\n' +
        'Y desde ahí saltó: si la música es número, y los planetas\n' +
        'se mueven con regularidad, los planetas suenan.\n' +
        'Componen, según los pitagóricos, una sinfonía constante\n' +
        'que no oímos porque la oímos siempre — como no oyes el\n' +
        'silbido de tu sangre.',
    },
    {
      title: 'III — Los números santos',
      body:
        'Para Pitágoras los números no eran cantidad sino esencia.\n\n' +
        '— UNO: la unidad indivisible. Antes de toda diferencia.\n' +
        '— DOS: la dualidad. Lo que se separa de sí.\n' +
        '— TRES: la armonía. Lo que reconcilia el dos.\n' +
        '— CUATRO: la materia. Cuatro elementos, cuatro estaciones.\n' +
        '— DIEZ: la perfección. 1+2+3+4. Suma del cosmos.\n\n' +
        'Trabajaban con figuras llamadas "tetractys": diez puntos\n' +
        'en triángulo. Lo más sagrado que tenían.',
    },
    {
      title: 'IV — La regla de los tres tamices',
      body:
        'Cuentan que un discípulo se acercó a Pitágoras a contarle\n' +
        'algo de un amigo común. Pitágoras le interrumpió:\n\n' +
        '— "Lo que vas a decir, ¿es verdad?"\n' +
        '— "Bueno... me lo han contado."\n' +
        '— "¿Es bueno?"\n' +
        '— "No, al revés."\n' +
        '— "¿Es necesario que yo lo sepa?"\n' +
        '— "...la verdad, no."\n' +
        '— "Pues entonces no me lo cuentes."\n\n' +
        'Tres tamices: verdad, bondad, necesidad. Pasada cualquier\n' +
        'palabra por ellos, casi todas se quedan en el camino.',
    },
    {
      title: 'V — Las dos columnas',
      body:
        'En el templo pitagórico había dos columnas: una blanca,\n' +
        'una negra. Representaban a los discípulos en dos etapas:\n' +
        'los "acusmáticos", que aún sólo podían escuchar; y los\n' +
        '"matemáticos", que ya podían razonar y enseñar.\n\n' +
        'No era una jerarquía moral. Era un calendario interno.\n' +
        'Cada uno pasa por las dos columnas tantas veces como\n' +
        'aprende algo nuevo de verdad.',
    },
    {
      title: 'VI — La transmigración',
      body:
        'Pitágoras enseñaba que el alma no muere con el cuerpo.\n' +
        'Pasa a otro. Y a otro. Y a otro.\n\n' +
        'Una vez, dicen, vio en la calle a un hombre golpear a un\n' +
        'perro. Pitágoras se acercó y le dijo: "Para. Ese perro\n' +
        'es un viejo amigo mío. Reconozco su voz."\n\n' +
        'No se sabe si era cierto, ni si Pitágoras se lo creía.\n' +
        'Pero el hombre paró de pegar al perro. Y eso, para\n' +
        'Pitágoras, era lo único que importaba.',
    },
    {
      title: 'VII — El silencio como herramienta',
      body:
        'Cinco años sin hablar. Hoy parece imposible. Pero los\n' +
        'pitagóricos sabían algo: cuando uno calla, su mente\n' +
        'empieza a oír sus propios ruidos. Al principio son\n' +
        'insoportables. Después se aclaran. Detrás del ruido\n' +
        'mental hay un suelo más quieto.\n\n' +
        'Pitágoras llamaba a ese suelo "armonía interior". Sin\n' +
        'él, decía, ningún número, ninguna música, ningún amor\n' +
        'se sostiene de verdad.',
    },
    {
      title: 'VIII — El final',
      body:
        'La hermandad se extendió por el sur de Italia. Tuvieron\n' +
        'enemigos. Una noche un grupo prendió fuego a la casa\n' +
        'donde se reunían. Murieron casi todos. Pitágoras, dice\n' +
        'la leyenda, escapó pero se detuvo ante un campo de habas.\n' +
        'Sus reglas le prohibían pisarlas. Sus perseguidores lo\n' +
        'alcanzaron allí.\n\n' +
        'No se sabe si fue así. Lo que sí se sabe es que sus\n' +
        'enseñanzas sobrevivieron porque una alumna, Téano, las\n' +
        'mantuvo vivas.',
    },
    {
      title: 'IX — El número de tu casa',
      body:
        'Los pitagóricos dicen: cada cosa tiene un número que la\n' +
        'gobierna. Cada nombre, cada calle, cada día.\n\n' +
        'Tu casa tiene un número. La fecha de hoy es otra. Si\n' +
        'sumas hasta reducirlas a una sola cifra, descubres una\n' +
        'pista pequeña sobre lo que la gobierna.\n\n' +
        'No es magia. Es atención: mirar lo que ya estaba ahí.\n' +
        '11 + 5 + 26 = 42 → 4 + 2 = 6. El seis es el equilibrio,\n' +
        'la armonía, el cuidado del otro. Casualidad, sin duda.',
    },
    {
      title: 'X — Lo que queda',
      body:
        'Hoy Pitágoras se estudia como matemático. Su teorema lo\n' +
        'sabe cualquier escolar. Pocos saben que él se consideraba\n' +
        'sobre todo un sanador.\n\n' +
        'Recetaba música. Recetaba silencio. Recetaba dieta y\n' +
        'caminar despacio. Decía que los problemas del cuerpo\n' +
        'eran a veces problemas del alma desafinada.\n\n' +
        'Si tu día está raro, prueba: silencia la música un rato.\n' +
        'Camina por el piso despacio. A ver qué se aclara.',
    },
  ],
};

// ─── TAROT ────────────────────────────────────────────────────────────

const CH_TAROT: ManlyChapter = {
  id: 'tarot',
  title: 'El Tarot',
  subtitle: 'Veintidós cartas y un viaje',
  pages: [
    {
      title: 'I — El origen',
      body:
        'Nadie sabe cuándo apareció el Tarot. Algunos lo remontan\n' +
        'al antiguo Egipto, otros a los gitanos del Renacimiento\n' +
        'italiano, otros a la Cábala medieval. Probablemente todas\n' +
        'esas historias son ciertas a medias.\n\n' +
        'Lo que se sabe es que las primeras barajas pintadas a mano\n' +
        'aparecen en el siglo XV en Italia, como juego de la nobleza.\n' +
        'Sólo después se les añadió valor adivinatorio.\n\n' +
        'Hoy el Tarot es ante todo un espejo: muestra al que mira,\n' +
        'no al futuro.',
    },
    {
      title: 'II — Los Arcanos Mayores',
      body:
        'Veintidós cartas. Cada una un arquetipo. Juntos, forman\n' +
        'el Camino del Loco — un viaje que el alma hace siempre\n' +
        'por primera vez.\n\n' +
        'Empieza en el cero (El Loco), atraviesa las pruebas, los\n' +
        'amores, las caídas, los maestros, los miedos, las\n' +
        'liberaciones. Termina en el veintiuno (El Mundo) y vuelve\n' +
        'a empezar como Loco otra vez. No hay final.\n\n' +
        'Cada vez que sacas una carta, te toca el arquetipo en el\n' +
        'punto del viaje en el que estás ahora.',
    },
    {
      title: 'III — El Loco (0)',
      body:
        'Camina hacia un precipicio sin mirarlo. Lleva un atado\n' +
        'pequeño. Un perro le ladra a los pies. Sonríe.\n\n' +
        'No es ingenuidad. Es la confianza del que aún no ha sido\n' +
        'dañado por la previsión. El Loco no sabe que puede caer,\n' +
        'pero algo en él tampoco deja que caiga.\n\n' +
        'Cuando sale en una tirada: lo que viene es nuevo. No\n' +
        'tienes mapa. No te hace falta. Sólo no mires demasiado\n' +
        'al precipicio.',
    },
    {
      title: 'IV — El Mago (I)',
      body:
        'Sostiene en la mano una vara apuntando al cielo. Sobre\n' +
        'la mesa: una copa, una espada, un pentáculo, una vara.\n' +
        'Los cuatro elementos a su alcance.\n\n' +
        'Es el principio de la voluntad consciente. El Loco\n' +
        'caminaba sin saber. El Mago elige.\n\n' +
        'Cuando sale: tienes lo que necesitas. La pregunta no es\n' +
        'qué te falta. Es qué vas a hacer con lo que tienes.',
      sigil: 'caduceus',
    },
    {
      title: 'V — La Sacerdotisa (II)',
      body:
        'Sentada entre dos columnas: una blanca, una negra (¿te\n' +
        'suena?). Sostiene un libro a medio cerrar. Detrás de\n' +
        'ella, un velo cubre el agua.\n\n' +
        'Es lo callado. Lo que sólo se sabe sin haber sido\n' +
        'enseñado. La intuición que precede al pensamiento.\n\n' +
        'Cuando sale: deja que el silencio responda antes que la\n' +
        'razón. La cabeza llegará después. Esta carta es la del\n' +
        'cuerpo que ya sabía.',
    },
    {
      title: 'VI — La Emperatriz (III)',
      body:
        'Una mujer embarazada en un trono, rodeada de campos\n' +
        'verdes. Lleva una corona de doce estrellas.\n\n' +
        'Es la madre del mundo. La fecundidad — no sólo de hijos:\n' +
        'también de proyectos, de poemas, de comidas, de planes.\n\n' +
        'Cuando sale: lo que has plantado va a dar fruto. No\n' +
        'fuerces. Riega, espera, mira crecer.',
    },
    {
      title: 'VII — Los Enamorados (VI)',
      body:
        'Dos figuras, un ángel arriba, un sol detrás. No es solo\n' +
        'romance. Es elección.\n\n' +
        'En las barajas más antiguas el Loco aparecía entre dos\n' +
        'mujeres y debía elegir entre ellas — entre la virtud y\n' +
        'el placer. Después se simplificó al amor moderno, que\n' +
        'ya nadie distingue de la elección a secas.\n\n' +
        'Cuando sale: tienes que decidir. Y la decisión no es la\n' +
        'que crees. Mira otra vez.',
    },
    {
      title: 'VIII — La Torre (XVI)',
      body:
        'Una torre alta. Un rayo cae. Dos figuras se precipitan\n' +
        'al vacío. La corona de la torre vuela.\n\n' +
        'Es la carta más temida. Pero es buena. Lo que la torre\n' +
        'derriba estaba mal construido. La caída es la forma que\n' +
        'tiene la verdad de aparecer cuando la mentira ya no se\n' +
        'sostiene.\n\n' +
        'Cuando sale: algo va a romperse. No te resistas. Lo que\n' +
        'aguante después de la caída es lo que merecía la pena.',
    },
    {
      title: 'IX — La Estrella (XVII)',
      body:
        'Después de la Torre, la noche limpia. Una mujer desnuda\n' +
        'vierte agua en un río. Sobre ella, una gran estrella y\n' +
        'siete pequeñas.\n\n' +
        'Es la esperanza tranquila. La que llega cuando ya nada\n' +
        'queda por perder y por eso ya nada hay que defender.\n\n' +
        'Cuando sale: respiras hondo. La luz vuelve. No hay prisa.',
      sigil: 'pentacle',
    },
    {
      title: 'X — La Luna (XVIII)',
      body:
        'Dos torres bajo una luna llena. Un perro y un lobo aúllan.\n' +
        'Un cangrejo sale del agua.\n\n' +
        'Es el inconsciente, el sueño, la confusión. Las cosas no\n' +
        'son lo que parecen. Tampoco son lo contrario.\n\n' +
        'Cuando sale: no decidas hoy. Espera a que se haga de día\n' +
        'y mira otra vez. Lo de la noche es para soñar, no para\n' +
        'firmar contratos.',
    },
    {
      title: 'XI — El Mundo (XXI)',
      body:
        'Una bailarina dentro de una corona ovalada. En las cuatro\n' +
        'esquinas: un hombre, un águila, un toro, un león.\n\n' +
        'Es la culminación. El alma que ha completado el viaje.\n' +
        'Pero fíjate: la bailarina no está quieta. La culminación\n' +
        'no es llegar — es haber aprendido a danzar dentro del\n' +
        'círculo entero, sabiendo que el círculo se va a abrir\n' +
        'otra vez en cuanto vuelvas a ser Loco.\n\n' +
        'Cuando sale: lo has hecho. Y empieza otra vez.',
      sigil: 'ouroboros',
    },
  ],
};

// ─── CABALA ───────────────────────────────────────────────────────────

const CH_KABBALAH: ManlyChapter = {
  id: 'kabbalah',
  title: 'La Cábala',
  subtitle: 'El árbol y el nombre',
  pages: [
    {
      title: 'I — La tradición secreta',
      body:
        'La palabra "Cábala" significa, en hebreo, "lo que se\n' +
        'recibe". Es la enseñanza que se transmite de boca a\n' +
        'oído, no por escrito, durante siglos.\n\n' +
        'Hasta que en la Edad Media los sabios judíos de Provenza\n' +
        'y España se atrevieron a escribirla. Aparecieron entonces\n' +
        'el Sefer Yetzirá ("Libro de la formación") y el Zóhar\n' +
        '("Libro del esplendor"), los dos textos centrales.',
    },
    {
      title: 'II — El árbol de la vida',
      body:
        'La Cábala dibuja un árbol invertido: las raíces en el\n' +
        'cielo, las ramas hacia abajo. Tiene diez "sefirot" o\n' +
        'esferas. Cada una es un atributo de lo divino.\n\n' +
        'No son lugares, son MODOS. Maneras en que lo que llamamos\n' +
        'Dios se manifiesta hacia abajo. La copa del árbol toca\n' +
        'lo infinito. Las hojas, lo cotidiano.\n\n' +
        'Caminar el árbol — de abajo hacia arriba — es el viaje\n' +
        'que el cabalista propone al alma.',
      sigil: 'tree-life',
    },
    {
      title: 'III — Las diez sefirot',
      body:
        '1. Kéter (Corona) — el principio.\n' +
        '2. Jojmá (Sabiduría) — el destello.\n' +
        '3. Biná (Inteligencia) — la comprensión.\n' +
        '4. Jésed (Misericordia) — la generosidad.\n' +
        '5. Gevurá (Severidad) — el juicio.\n' +
        '6. Tiféret (Belleza) — la armonía.\n' +
        '7. Nétsaj (Eternidad) — el impulso.\n' +
        '8. Hod (Esplendor) — la forma.\n' +
        '9. Yesod (Fundamento) — el cauce.\n' +
        '10. Maljut (Reino) — el mundo.\n\n' +
        'Diez. La perfección pitagórica reaparece.',
    },
    {
      title: 'IV — Los veintidós caminos',
      body:
        'Entre las diez sefirot corren veintidós caminos, uno\n' +
        'por cada letra del alfabeto hebreo. Caminar uno es\n' +
        'pronunciar la letra correspondiente con el cuerpo.\n\n' +
        '(¿Veintidós? Sí. Igual que los Arcanos Mayores del Tarot.\n' +
        'No es casualidad. Hay quien dice que el Tarot fue una\n' +
        'forma cifrada de la Cábala para los goim — los no\n' +
        'judíos. La historia oficial lo niega. La oficiosa, no\n' +
        'tanto.)',
    },
    {
      title: 'V — El Tetragrámaton',
      body:
        'Las cuatro letras que no se pronuncian: YHVH. El nombre\n' +
        'inefable. Aparece muchas veces en la Torá pero nunca se\n' +
        'lee literal — los lectores judíos sustituyen por "Adonai"\n' +
        'o "Hashem" (el Nombre).\n\n' +
        'Por qué no se pronuncia: porque al pronunciar un nombre\n' +
        'se le quita un poco de su misterio. Y el nombre divino\n' +
        'es el último misterio que queda. Si se gasta, el mundo\n' +
        'se desnuda.',
      sigil: 'tetragramaton',
    },
    {
      title: 'VI — Tikún Olam',
      body:
        '"Reparar el mundo". Para los cabalistas el mundo está\n' +
        'roto desde el origen. Cuando lo divino se contrajo para\n' +
        'dar lugar a la creación, las vasijas que iban a contener\n' +
        'su luz no resistieron. Estallaron.\n\n' +
        'Los fragmentos de luz quedaron atrapados en la materia.\n' +
        'Cada acto justo, cada palabra amable, cada cuidado a un\n' +
        'animal, libera uno.\n\n' +
        'No vamos a salvar el mundo. Pero estamos liberando luz.',
    },
    {
      title: 'VII — La letra y la chispa',
      body:
        'Cada letra hebrea, según la Cábala, es un canal por\n' +
        'donde pasa la creación. La forma de la letra no es\n' +
        'arbitraria: es el dibujo de su función.\n\n' +
        'Alef (א): el silencio que precede al sonido. Bet (ב):\n' +
        'la casa, donde algo se contiene. Guimel (ג): el camello,\n' +
        'el que recorre. Y así las veintidós, una a una.\n\n' +
        'Los cabalistas pasaban años sólo con el alfabeto. No\n' +
        'memorizándolo. ESCUCHÁNDOLO.',
    },
    {
      title: 'VIII — Los setenta y dos nombres',
      body:
        'De tres versículos del Éxodo (14:19, 14:20, 14:21) se\n' +
        'extraen, por un método cabalístico complejo, setenta y\n' +
        'dos nombres divinos de tres letras cada uno.\n\n' +
        'Cada nombre, dicen, abre una puerta distinta. Una para\n' +
        'la sanación, otra para la abundancia, otra para el amor.\n\n' +
        'No los reproduzco aquí. No por superstición: porque\n' +
        'memorizarlos no sirve. Hay que recibirlos. Si te tocan,\n' +
        'lo sabrás.',
    },
    {
      title: 'IX — Las cuatro lecturas',
      body:
        'Los cabalistas leen la Torá en cuatro niveles, formando\n' +
        'el acrónimo PaRDeS ("paraíso"):\n\n' +
        '— Peshat: el sentido literal.\n' +
        '— Rémez: la alusión, lo que el texto sugiere.\n' +
        '— Derash: la interpretación moral.\n' +
        '— Sod: el secreto, lo místico.\n\n' +
        'Quien lee solo en peshat lee un libro. Quien lee en\n' +
        'sod lee el universo. Pero hay que pasar por los cuatro.\n' +
        'Saltarse niveles es no entender.',
    },
    {
      title: 'X — La Shejiná',
      body:
        'En la Cábala, Dios tiene una "presencia femenina":\n' +
        'la Shejiná. Es lo divino habitando entre nosotros.\n' +
        'Se separa del esposo (la cara masculina de Dios) cada\n' +
        'vez que el mundo se rompe. Vuelve a unirse cada vez\n' +
        'que algo se repara.\n\n' +
        'Así, cualquier acto de cuidado — encender una vela un\n' +
        'sábado, abrazar a alguien que llora, dejar comida a un\n' +
        'gato — es, técnicamente, una boda mística.',
    },
  ],
};

// ─── ALQUIMIA ─────────────────────────────────────────────────────────

const CH_ALCHEMY: ManlyChapter = {
  id: 'alchemy',
  title: 'La Alquimia',
  subtitle: 'Disuelve y coagula',
  pages: [
    {
      title: 'I — Más que oro',
      body:
        'La alquimia tiene mala fama: charlatanes que querían\n' +
        'fabricar oro a partir de plomo. La fama no es totalmente\n' +
        'falsa — los hubo. Pero los serios buscaban otra cosa.\n\n' +
        'Para ellos el plomo era símbolo: la pesadez del que aún\n' +
        'no se conoce. El oro era símbolo también: la luz del que\n' +
        'ya se sabe entero. La transmutación verdadera ocurría en\n' +
        'el alma del alquimista mientras manipulaba el horno.\n\n' +
        'El oro físico, si se daba, era un efecto secundario.',
    },
    {
      title: 'II — La Gran Obra',
      body:
        'Toda la alquimia se resume en cuatro palabras latinas:\n' +
        'SOLVE ET COAGULA. Disuelve y coagula. Rompe y une.\n\n' +
        'El alquimista toma una sustancia (o un alma), la lleva\n' +
        'al límite — calor, frío, soledad, presión — hasta que\n' +
        'se descompone en sus partes fundamentales. Luego las\n' +
        'recoge y las reúne en una forma nueva.\n\n' +
        'Lo que sale al otro lado no es lo que entró. Pero es\n' +
        'más cierto.',
    },
    {
      title: 'III — Las tres sustancias',
      body:
        'Los alquimistas hablaban de tres principios:\n\n' +
        '— SAL: el cuerpo, lo fijo, lo material.\n' +
        '— AZUFRE: el alma, lo que arde, lo que da carácter.\n' +
        '— MERCURIO: el espíritu, lo que comunica entre cuerpo y\n' +
        '   alma; lo veloz, lo elusivo.\n\n' +
        'Toda criatura — toda receta, todo proyecto, toda persona —\n' +
        'tiene los tres en proporción. La obra alquímica consiste\n' +
        'en equilibrarlos.',
    },
    {
      title: 'IV — Las cuatro fases',
      body:
        'Cuatro etapas, identificadas por colores:\n\n' +
        '— NIGREDO (negro): la disolución, la depresión inicial.\n' +
        '— ALBEDO (blanco): la purificación, el amanecer.\n' +
        '— CITRINITAS (amarillo): la iluminación, ya casi.\n' +
        '— RUBEDO (rojo): la unión final, el oro.\n\n' +
        'Hoy la psicología junguiana usa el mismo lenguaje. Jung\n' +
        'leía a los alquimistas y decía que ya conocían los procesos\n' +
        'de individuación que la psique humana atraviesa.',
    },
    {
      title: 'V — El Atanor',
      body:
        'El horno alquímico tenía un nombre: ATANOR. Calor lento,\n' +
        'sostenido, paciente. Lo que se cocina deprisa pierde su\n' +
        'esencia. La impaciencia quema el oro.\n\n' +
        'Por eso los alquimistas trabajaban en sótanos, durante\n' +
        'meses, a veces años. Sin poder explicar a nadie qué\n' +
        'hacían. Quien preguntara recibía sólo una sonrisa.\n\n' +
        'Si te suena, es porque conoces a alguien que está en una\n' +
        'fase nigredo larga.',
    },
    {
      title: 'VI — La piedra filosofal (otra vez)',
      body:
        'Ya hablamos de ella en el capítulo del Hermetismo. Aquí,\n' +
        'desde la alquimia, otro ángulo:\n\n' +
        'La piedra es la sustancia que, según los alquimistas,\n' +
        'culmina la Gran Obra. Tiñe el plomo en oro al contacto.\n' +
        'Cura las enfermedades. Prolonga la vida.\n\n' +
        'No se ha encontrado nunca. O sí, pero quien la encuentra\n' +
        'jamás la enseña — porque al encontrarla deja de querer\n' +
        'enseñarla. Esa es, dicen, su prueba.',
    },
    {
      title: 'VII — Los matrimonios químicos',
      body:
        'En los grabados alquímicos abundan las parejas: rey y\n' +
        'reina, sol y luna, rojo y blanco. Se besan. Se mezclan.\n' +
        'A veces uno mata al otro y los dos renacen.\n\n' +
        'Es el "matrimonio químico". Símbolo de la unión de\n' +
        'opuestos dentro del alquimista — su parte masculina y\n' +
        'femenina, su luz y su sombra.\n\n' +
        'Cualquier amor real es un poco esta operación. Se\n' +
        'reconoce porque sale de él gente cambiada.',
    },
    {
      title: 'VIII — La paciencia del laboratorio',
      body:
        'Una receta alquímica empieza así: "Toma este agua y\n' +
        'cocínala durante cuarenta días al fuego más suave que\n' +
        'puedas mantener. No abras el matraz. No mires dentro.\n' +
        'No hables de él con nadie."\n\n' +
        'Cuarenta días. Sin abrir. Sin mirar. Sin contar.\n\n' +
        'Quien aprende esa paciencia, ha aprendido alquimia.\n' +
        'Lo que salga del matraz es secundario.',
    },
    {
      title: 'IX — Los símbolos',
      body:
        'Los alquimistas escribían en código. No para esconder:\n' +
        'para proteger. Sabían que un saber puesto en lenguaje\n' +
        'literal pierde la mitad de su carga.\n\n' +
        'Sus textos están llenos de leones verdes, soles negros,\n' +
        'cuervos, pelícanos, dragones. Un manual de alquimia\n' +
        'parece un bestiario delirante.\n\n' +
        'Carl Jung pasó treinta años descifrándolos. Lo que\n' +
        'encontró está en sus libros. Si te pica la curiosidad,\n' +
        'empieza por "Mysterium Coniunctionis".',
    },
    {
      title: 'X — Final del capítulo',
      body:
        'La alquimia hoy ya no se practica con matraces. Pero\n' +
        'se practica.\n\n' +
        'Cada vez que alguien atraviesa una crisis, descompone\n' +
        'lo que era, y se rehace en algo más cierto, está\n' +
        'haciendo la Gran Obra. Cuarenta días, fuego suave, sin\n' +
        'abrir el matraz.\n\n' +
        'El saber alquímico vive en cualquiera que sepa esperar\n' +
        'sin saber qué espera.',
      sigil: 'cross-rose',
    },
  ],
};

export const MANLY_CHAPTERS: ManlyChapter[] = [
  CH_HERMETIC,
  CH_PYTHAGORAS,
  CH_TAROT,
  CH_KABBALAH,
  CH_ALCHEMY,
];

/** Compatibilidad con código antiguo. */
export function pickManlyChapter(): ManlyChapter {
  return MANLY_CHAPTERS[Math.floor(Math.random() * MANLY_CHAPTERS.length)];
}
