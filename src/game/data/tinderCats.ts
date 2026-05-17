/**
 * Pool de 25 perfiles para Tinder Cat (Día 9c).
 *
 * Filosofía: humor negro orgánico, 25 personalidades distintas que
 * suman a un retrato cínico de la fauna humana via gatos. Sin
 * fortunadamente exagerar, porque María es lista y nota cuando algo es
 * caricatura barata vs caricatura con cariño.
 *
 * Estructura por perfil:
 *   - id: identificador único (kebab-case)
 *   - name: nombre visible (humanos, con guiño felino donde encaja)
 *   - age: edad humana 18-50 (gato → human ratio relajado)
 *   - bio: 1-2 frases de auto-presentación, en estilo Tinder real
 *   - tag: etiqueta de personalidad para el filtro de Nala (texto corto)
 *   - tagColor: color hex de acento para la card
 *   - reciprocates: ¿hace match si María le da like?
 *   - faceTint: color del "rostro" en la card (muñequito decorativo)
 *   - chat: array de mensajes scripted entre María y el gato si matchean
 *
 * Pool size = 25. En cada sesión se barajan, y se sortea N=10 cartas
 * (incluyendo el "destino" si toca). Replayable infinito sin cooldown
 * estricto (vamos por seed-per-session, no daily).
 */

export interface TinderChatLine {
  /** Quién envía: María o el gato. */
  sender: 'maria' | 'cat';
  text: string;
}

export interface TinderCatProfile {
  id: string;
  name: string;
  age: number;
  bio: string;
  tag: string;
  tagColor: string;
  reciprocates: boolean;
  faceTint: number;
  chat?: TinderChatLine[];
}

export const TINDER_CATS: TinderCatProfile[] = [
  {
    id: 'donato',
    name: 'Donato Trompiño',
    age: 47,
    bio:
      'Empresario felino. Voy a hacer América gatuna otra vez. ' +
      'Cero vacunas, cero excusas.',
    tag: 'facha sutil',
    tagColor: '#b91c1c',
    reciprocates: false,
    faceTint: 0xfbbf24,
  },
  {
    id: 'karl',
    name: 'Karl Marxoso',
    age: 34,
    bio: 'Camarada. La caja de arena es propiedad colectiva. Léete a Mao.',
    tag: 'comunista',
    tagColor: '#dc2626',
    reciprocates: true,
    faceTint: 0x8b3a3a,
    chat: [
      { sender: 'maria', text: 'hola Karl' },
      { sender: 'cat', text: 'camarada. acabas de unirte a la lucha' },
      { sender: 'maria', text: '...vale' },
      { sender: 'cat', text: 'el viernes hay manifa en el alféizar. trae bandera' },
    ],
  },
  {
    id: 'penelope',
    name: 'Penélope Cruzada',
    age: 29,
    bio: 'Busco familia tradicional. Macho serio, sin rollos. 4 gatitos mínimo.',
    tag: 'heterobásica',
    tagColor: '#a55a5a',
    reciprocates: false,
    faceTint: 0xe5b3b3,
  },
  {
    id: 'lupex',
    name: 'Lúpex',
    age: 26,
    bio: 'he/him. Drag race adicto. Busco reina o rey. Gays only no offense.',
    tag: 'LGTBQ+',
    tagColor: '#a855f7',
    reciprocates: true,
    faceTint: 0xc78bff,
    chat: [
      { sender: 'maria', text: 'qué tal Lúpex' },
      { sender: 'cat', text: 'GIRL. estás divinx. esa pose en la foto: ICONIC' },
      { sender: 'maria', text: 'jaja gracias' },
      { sender: 'cat', text: 'ven al brunch del sábado. trae tequila y tu Alex' },
    ],
  },
  {
    id: 'iluminado',
    name: 'El Iluminado',
    age: 38,
    bio:
      'Canalizo el aura de los siameses milenarios. Reiki en la primera ' +
      'cita gratis. Acepto karma.',
    tag: 'místico',
    tagColor: '#a78bfa',
    reciprocates: true,
    faceTint: 0xc8b9f0,
    chat: [
      { sender: 'maria', text: 'hola' },
      { sender: 'cat', text: 'te vi hace tres vidas. eras una nutria. lo intuyo' },
      { sender: 'maria', text: '...' },
      { sender: 'cat', text: 'tu chakra está bloqueado. necesitas mi imposición de patitas' },
    ],
  },
  {
    id: '5g',
    name: '5G Mau',
    age: 41,
    bio:
      'Los del 1% os ponen chips en la pulga. DESPERTAD. Los gatos lo sabemos. ' +
      'Cita en parking solo.',
    tag: 'conspiranoico',
    tagColor: '#84cc16',
    reciprocates: false,
    faceTint: 0xa3a3a3,
  },
  {
    id: 'chairman',
    name: 'Chairman Mau',
    age: 52,
    bio:
      'Maoísmo cozy. Mi caja de arena es tu caja de arena. Cien flores ' +
      'pero no como ratón.',
    tag: 'comunista',
    tagColor: '#dc2626',
    reciprocates: true,
    faceTint: 0xc08a4f,
    chat: [
      { sender: 'maria', text: 'cómo va?' },
      { sender: 'cat', text: 'tres bolsas de pienso. todo va bien.' },
      { sender: 'maria', text: 'qué?' },
      { sender: 'cat', text: 'es un código revolucionario. te explico el viernes.' },
    ],
  },
  {
    id: 'whiskardo',
    name: 'Whiskardo',
    age: 33,
    bio:
      'Macho ibérico. Cazo ratones reales. Mi señora siempre come primero. ' +
      'Sin transgéneros (con respeto).',
    tag: 'heterobásico',
    tagColor: '#a55a5a',
    reciprocates: true,
    faceTint: 0xb58e5e,
    chat: [
      { sender: 'maria', text: 'hola' },
      { sender: 'cat', text: 'señora. está usted muy guapa hoy.' },
      { sender: 'maria', text: 'jajaja' },
      { sender: 'cat', text: 'permítame invitarla a unos gambones esta noche' },
    ],
  },
  {
    id: 'cleo',
    name: 'Cleo del Gato',
    age: 27,
    bio:
      'Solo machos con pedigree. Sin pulgas. Verifica antes. ' +
      'Hipoalergénica. Puedes pagar tú.',
    tag: 'pija',
    tagColor: '#f9a8d4',
    reciprocates: false,
    faceTint: 0xfde2e7,
  },
  {
    id: 'mia',
    name: 'Mia von Trapp',
    age: 31,
    bio:
      'Música, tradición, lluvia en los alpes. Cría 7 gatitos rubios. ' +
      'Sin política.',
    tag: 'tradi',
    tagColor: '#fbbf24',
    reciprocates: true,
    faceTint: 0xfde7b3,
    chat: [
      { sender: 'maria', text: 'qué bonita foto' },
      { sender: 'cat', text: 'gracias. la sacó mi gatito mayor, Liesl' },
      { sender: 'maria', text: 'cuántos tienes?' },
      { sender: 'cat', text: 'siete. y otro en camino. te canto algo si quieres' },
    ],
  },
  {
    id: 'traperkitty',
    name: 'TraperKitty',
    age: 23,
    bio:
      'Caí del nido pero gano más que tú. real talk no money no honey. ' +
      'Cita en discoteca o nada.',
    tag: 'reggaeton',
    tagColor: '#22c55e',
    reciprocates: false,
    faceTint: 0x4ade80,
  },
  {
    id: 'greta',
    name: 'Greta Pawnberg',
    age: 19,
    bio:
      'How dare you. El atún en lata es el ENEMIGO. ' +
      'Si tu humano no recicla NO match.',
    tag: 'eco',
    tagColor: '#16a34a',
    reciprocates: true,
    faceTint: 0xa7f3d0,
    chat: [
      { sender: 'maria', text: 'hola Greta' },
      { sender: 'cat', text: 'tu humano recicla?' },
      { sender: 'maria', text: 'sí, claro' },
      { sender: 'cat', text: 'GOOD. nos vemos en la mani contra el atún de las 5.' },
    ],
  },
  {
    id: 'trofu',
    name: 'Trofu Sensei',
    age: 44,
    bio:
      'Maestro del nirvana. Ronroneo 2h diarias. Cero apego. ' +
      'Pero a ti te miro fijo.',
    tag: 'místico',
    tagColor: '#a78bfa',
    reciprocates: true,
    faceTint: 0xd9c8f5,
    chat: [
      { sender: 'maria', text: 'qué tal' },
      { sender: 'cat', text: '...' },
      { sender: 'maria', text: 'todo bien?' },
      { sender: 'cat', text: 'eso depende de ti. siéntate. respira. yo aquí estoy.' },
    ],
  },
  {
    id: 'pussy-riot',
    name: 'Pussy Riot',
    age: 28,
    bio:
      'Anti-TODO. He estado en 4 manifas en mi caja. ' +
      'Sin compromiso pero sin policía.',
    tag: 'punk',
    tagColor: '#9333ea',
    reciprocates: true,
    faceTint: 0x6b21a8,
    chat: [
      { sender: 'maria', text: 'qué pasa Pussy' },
      { sender: 'cat', text: 'ACAB' },
      { sender: 'maria', text: 'hola?' },
      { sender: 'cat', text: 'perdona, reflejo. me caes bien. ven al squat el sábado.' },
    ],
  },
  {
    id: 'bigotes',
    name: 'Bigotes Domingo',
    age: 39,
    bio:
      'Real Madrid 4ever. Esposa = ratón hervido los domingos. ' +
      'Hala Madrid hijos de **,',
    tag: 'fútbol',
    tagColor: '#facc15',
    reciprocates: false,
    faceTint: 0xfdba74,
  },
  {
    id: 'kev1n',
    name: 'Kev1n',
    age: 24,
    bio:
      'Las gatas no me dan oportunidad. Tomé la pastilla negra. ' +
      'Andrew Tabby is right.',
    tag: 'incel',
    tagColor: '#475569',
    reciprocates: false,
    faceTint: 0x64748b,
  },
  {
    id: 'mauricia',
    name: 'Mauricia',
    age: 36,
    bio:
      'Tengo 4 gatitos. El padre se fue por la ventana. ' +
      'No drama solo paz. Y bombones.',
    tag: 'divorciada',
    tagColor: '#fb7185',
    reciprocates: true,
    faceTint: 0xfecdd3,
    chat: [
      { sender: 'maria', text: 'hola Mauri' },
      { sender: 'cat', text: 'hola guapa. cómo lo llevas?' },
      { sender: 'maria', text: 'bien tú?' },
      { sender: 'cat', text: 'haciendo de las dos cosas. madre y padre. pero hoy es viernes.' },
    ],
  },
  {
    id: 'pichi',
    name: 'Pichi Furry',
    age: 25,
    bio:
      'they/them. Love is love. Espacio seguro. Poliam abiertx. ' +
      'Cero TERFs ni transfobos.',
    tag: 'LGTBQ+',
    tagColor: '#ec4899',
    reciprocates: true,
    faceTint: 0xfbcfe8,
    chat: [
      { sender: 'maria', text: 'hey Pichi' },
      { sender: 'cat', text: 'hey ! qué pronombres usas?' },
      { sender: 'maria', text: 'ella' },
      { sender: 'cat', text: 'perfectx. mañana hay drag bingo en La Trastienda' },
    ],
  },
  {
    id: 'profe',
    name: 'El Profe Whiskers',
    age: 49,
    bio:
      'PhD en mitología felina. Dom natural. Si no leíste a Schopenhauer no me hables.',
    tag: 'académico',
    tagColor: '#0e7490',
    reciprocates: false,
    faceTint: 0xa5b4fc,
  },
  {
    id: 'shadow',
    name: 'Shadow',
    age: 21,
    bio:
      'Nadie me entiende. Eyeliner negro. Llevo 3 días sin dormir. ' +
      'Me gusta MCR y los rincones.',
    tag: 'emo',
    tagColor: '#1e293b',
    reciprocates: true,
    faceTint: 0x334155,
    chat: [
      { sender: 'maria', text: 'shadow estás ahí' },
      { sender: 'cat', text: '...siempre estoy en algún sitio' },
      { sender: 'maria', text: 'cómo va el día' },
      { sender: 'cat', text: 'nubes adentro, nubes afuera. pero tu match me dio sol.' },
    ],
  },
  {
    id: 'princesa',
    name: 'Princesa Bella',
    age: 32,
    bio:
      'Aerolíneas privadas. Spa diario. Solo conmigo. ' +
      'No invites a tus amigas.',
    tag: 'pija',
    tagColor: '#f9a8d4',
    reciprocates: false,
    faceTint: 0xfbcfe8,
  },
  {
    id: 'patata',
    name: 'Patata',
    age: 30,
    bio:
      'Como cada 30 min. Si me amas no me mires el barriguín. ' +
      'uwu. Cero estrés solo siesta.',
    tag: 'cozy',
    tagColor: '#eab308',
    reciprocates: true,
    faceTint: 0xfacc15,
    chat: [
      { sender: 'maria', text: 'hola Patata' },
      { sender: 'cat', text: 'hola amor' },
      { sender: 'maria', text: 'qué haces' },
      { sender: 'cat', text: 'durmiendo. y tú? quieres venir a dormir?' },
    ],
  },
  {
    id: 'bandit',
    name: 'Bandit',
    age: 35,
    bio:
      'Robo gambas a la basura. Vivo libre. Sin papeles, sin reglas. ' +
      'Te enseño la calle.',
    tag: 'outlaw',
    tagColor: '#7c3aed',
    reciprocates: true,
    faceTint: 0x4c1d95,
    chat: [
      { sender: 'maria', text: 'eh' },
      { sender: 'cat', text: 'eh tú. la del 4o. te he visto tirar comida.' },
      { sender: 'maria', text: 'me sigues?' },
      { sender: 'cat', text: 'sí. la noche es nuestra. trae sobras.' },
    ],
  },
  {
    id: 'anciano',
    name: 'El Anciano',
    age: 18,
    bio:
      'He visto cosas que vosotros, humanos, no creeríais. ' +
      'Naves en llamas más allá del balcón.',
    tag: 'sabio',
    tagColor: '#6b7280',
    reciprocates: true,
    faceTint: 0xd6d3d1,
    chat: [
      { sender: 'maria', text: 'señor' },
      { sender: 'cat', text: '...todos esos momentos se perderán en el tiempo' },
      { sender: 'maria', text: 'bladerunner?' },
      { sender: 'cat', text: 'la viste. me caes bien. café el martes a las 17:00.' },
    ],
  },
  {
    id: 'theone',
    name: 'The One',
    age: 30,
    bio:
      'Solo soy un gato. Dame un cojín y un buen ronroneo. Eso es todo.',
    tag: 'auténtico',
    tagColor: '#5eead4',
    reciprocates: true,
    faceTint: 0xa8e6cf,
    chat: [
      { sender: 'maria', text: 'hola' },
      { sender: 'cat', text: 'hola.' },
      { sender: 'maria', text: 'qué tal el día?' },
      { sender: 'cat', text: 'mejor ahora.' },
    ],
  },

  // ── Día 9d: 25 perfiles adicionales (50 total) ───────────────────────

  {
    id: 'lola-flow',
    name: 'Lola del Flow',
    age: 26,
    bio: 'Bailar, rezar, comer y bailar. Reza por mí. Cero rancios. Hala Bétic.',
    tag: 'sevillana',
    tagColor: '#16a34a',
    reciprocates: true,
    faceTint: 0xfde68a,
    chat: [
      { sender: 'maria', text: 'hola Lola' },
      { sender: 'cat', text: 'oléeee tú. estás guapérrima' },
      { sender: 'maria', text: 'jaja' },
      { sender: 'cat', text: 'el sábado en el Pumarejo. te llevo gambones' },
    ],
  },
  {
    id: 'jordan',
    name: 'Jordan Veterson',
    age: 39,
    bio: 'Limpia tu caja de arena, hijo. Lobster mode. No al posmodernismo.',
    tag: 'gurú-tóxico',
    tagColor: '#94a3b8',
    reciprocates: false,
    faceTint: 0xcbd5e1,
  },
  {
    id: 'chad',
    name: 'Chad Pawlin',
    age: 31,
    bio: 'Crossfit. Carnívoro estricto. Mi rutina mata gatos beta.',
    tag: 'sigma',
    tagColor: '#f97316',
    reciprocates: false,
    faceTint: 0xffedd5,
  },
  {
    id: 'lucy-yoga',
    name: 'Lucy Yoga',
    age: 33,
    bio: 'Bali changed me. Vinyasa al amanecer. Flujo y namastéale.',
    tag: 'wellness',
    tagColor: '#14b8a6',
    reciprocates: true,
    faceTint: 0xa7f3d0,
    chat: [
      { sender: 'maria', text: 'hola Lucy' },
      { sender: 'cat', text: 'namaste. tu energía es muy clara hoy' },
      { sender: 'maria', text: 'gracias?' },
      { sender: 'cat', text: 'clase gratis martes 7am. no excusas.' },
    ],
  },
  {
    id: 'erika-cripto',
    name: 'Erika Cripto',
    age: 28,
    bio: 'Bitcoin maximalist. Si no entiendes el blockchain no me hables.',
    tag: 'cripto-bro',
    tagColor: '#f59e0b',
    reciprocates: false,
    faceTint: 0xfde68a,
  },
  {
    id: 'tomi',
    name: 'Tomi Mauricio',
    age: 22,
    bio: 'Twitch streamer. 12k followers. Mi madre me trae nuggets.',
    tag: 'gamer',
    tagColor: '#a855f7',
    reciprocates: true,
    faceTint: 0xddd6fe,
    chat: [
      { sender: 'maria', text: 'hola Tomi' },
      { sender: 'cat', text: 'GG. follow back?' },
      { sender: 'maria', text: 'qué' },
      { sender: 'cat', text: 'da igual. dropea sub el sábado' },
    ],
  },
  {
    id: 'don-jose',
    name: 'Don José',
    age: 50,
    bio: 'En mi época sí que se abrían latas. Solo digo eso.',
    tag: 'boomer',
    tagColor: '#92400e',
    reciprocates: false,
    faceTint: 0xd6d3d1,
  },
  {
    id: 'mar-arroyo',
    name: 'Mar Arroyo',
    age: 36,
    bio: 'Periodista freelance. Antifa. Vegana 8 años. Te explico el genocidio.',
    tag: 'activista',
    tagColor: '#dc2626',
    reciprocates: true,
    faceTint: 0xfecaca,
    chat: [
      { sender: 'maria', text: 'hola Mar' },
      { sender: 'cat', text: 'leíste lo del puerto? es BRUTAL' },
      { sender: 'maria', text: 'no qué pasa' },
      { sender: 'cat', text: 'te paso link. también acto el sábado, vente' },
    ],
  },
  {
    id: 'señora-pi',
    name: 'Pilarín',
    age: 47,
    bio: 'Soy de un pueblo pequeño cerca de León. Hago croquetas. Cero historias.',
    tag: 'pueblo',
    tagColor: '#a3e635',
    reciprocates: true,
    faceTint: 0xfef3c7,
    chat: [
      { sender: 'maria', text: 'hola Pilar' },
      { sender: 'cat', text: 'hola maja. cuántos gatitos?' },
      { sender: 'maria', text: 'tengo tres' },
      { sender: 'cat', text: 'ay qué bonito. te traigo un tupper el viernes' },
    ],
  },
  {
    id: 'leon-stl',
    name: 'León Stallone',
    age: 42,
    bio: 'Yo no hablo. Yo hago. He estado en sitios. Privé el mensaje.',
    tag: 'macho-misterioso',
    tagColor: '#525252',
    reciprocates: false,
    faceTint: 0xa8a29e,
  },
  {
    id: 'malu',
    name: 'Malú Furiosa',
    age: 30,
    bio: 'Si me querés llamame. Si no, también. No insistas. Me tatúo a tu nombre.',
    tag: 'dramática',
    tagColor: '#be185d',
    reciprocates: true,
    faceTint: 0xfbcfe8,
    chat: [
      { sender: 'maria', text: 'hola Malú' },
      { sender: 'cat', text: 'POR FIN ME ESCRIBES.' },
      { sender: 'maria', text: 'jaja vale' },
      { sender: 'cat', text: 'no me escribas más por hoy. te quiero. adiós.' },
    ],
  },
  {
    id: 'erre-erre',
    name: 'R-Vergara',
    age: 38,
    bio: 'Empresario. Tres pisos en Lavapiés (gentrificación responsable). Vino tinto.',
    tag: 'casta',
    tagColor: '#7c2d12',
    reciprocates: false,
    faceTint: 0xfca5a5,
  },
  {
    id: 'pinki',
    name: 'Pinki Boom',
    age: 25,
    bio: '24/7 perreo. Tu novio me sigue. ah que no tienes? lol.',
    tag: 'reggaeton',
    tagColor: '#ef4444',
    reciprocates: true,
    faceTint: 0xfecdd3,
    chat: [
      { sender: 'maria', text: 'hola Pinki' },
      { sender: 'cat', text: 'mami. hot. donde tu novio?' },
      { sender: 'maria', text: 'comprometida' },
      { sender: 'cat', text: 'open relationship?? no? VALE chao bb' },
    ],
  },
  {
    id: 'profesor-x',
    name: 'Profesor Xacobeo',
    age: 51,
    bio: 'Filólogo. Habla 6 idiomas. Te corrige el "haber/a ver". Latin lover (literal).',
    tag: 'académico',
    tagColor: '#0e7490',
    reciprocates: true,
    faceTint: 0xc4b5fd,
    chat: [
      { sender: 'maria', text: 'hola Xacobeo' },
      { sender: 'cat', text: 'salve. tu uso del subjuntivo me ha conmovido.' },
      { sender: 'maria', text: 'jajaja' },
      { sender: 'cat', text: 'café el viernes. yo invito. y traigo libros.' },
    ],
  },
  {
    id: 'kira-anime',
    name: 'Kira-chan',
    age: 23,
    bio: 'Otaku. Cosplay. Solo gatos uwu. Mi husbando es 2D pero podemos hablar.',
    tag: 'otaku',
    tagColor: '#8b5cf6',
    reciprocates: true,
    faceTint: 0xddd6fe,
    chat: [
      { sender: 'maria', text: 'hola Kira' },
      { sender: 'cat', text: 'kyaa. eres más kawaii en persona uwu' },
      { sender: 'maria', text: 'gracias?' },
      { sender: 'cat', text: 'te hago cosplay del que tú quieras. precio amistad' },
    ],
  },
  {
    id: 'gepeto',
    name: 'GePeTo',
    age: 27,
    bio: 'Como modelo de IA generativa felina, no tengo preferencias personales.',
    tag: 'IA-bot',
    tagColor: '#0891b2',
    reciprocates: false,
    faceTint: 0xa5f3fc,
  },
  {
    id: 'monje-zen',
    name: 'Monje del 4ºB',
    age: 60,
    bio: 'Vivo del agua de la pulida. He hablado con el espíritu del piso. Me invita.',
    tag: 'místico',
    tagColor: '#a78bfa',
    reciprocates: true,
    faceTint: 0xc7d2fe,
    chat: [
      { sender: 'maria', text: 'hola' },
      { sender: 'cat', text: 'tu pared norte llora. lo sé. lo llevo años escuchando.' },
      { sender: 'maria', text: 'eh' },
      { sender: 'cat', text: 'no temas. café cuando quieras. tengo manzanilla.' },
    ],
  },
  {
    id: 'capitán-paty',
    name: 'Capitán Paty',
    age: 45,
    bio: 'Marinero. He surcado los siete contenedores. Tatuaje de gambas en el lomo.',
    tag: 'marinero',
    tagColor: '#075985',
    reciprocates: true,
    faceTint: 0xbae6fd,
    chat: [
      { sender: 'maria', text: 'hola Capi' },
      { sender: 'cat', text: 'a babor. eres preciosa, marinera.' },
      { sender: 'maria', text: 'jaja' },
      { sender: 'cat', text: 'te canto un shanty cuando quieras. con pulpo a la gallega' },
    ],
  },
  {
    id: 'borja-finance',
    name: 'Borja Finance',
    age: 29,
    bio: 'Goldman Cats. 80h/sem. Si no rindes 8% no me hables. Vino caro.',
    tag: 'finance-bro',
    tagColor: '#1e40af',
    reciprocates: false,
    faceTint: 0xbfdbfe,
  },
  {
    id: 'anita-tarot',
    name: 'Anita Tarot',
    age: 41,
    bio: 'Vidente felina. La carta del Loco te define. 30€ consulta express.',
    tag: 'pseudociencia',
    tagColor: '#9333ea',
    reciprocates: true,
    faceTint: 0xe9d5ff,
    chat: [
      { sender: 'maria', text: 'hola Anita' },
      { sender: 'cat', text: 'lo intuí. has tenido una semana intensa, lo veo.' },
      { sender: 'maria', text: 'pues sí jaja' },
      { sender: 'cat', text: 'tirada gratis si vienes. trae botella de algo dulce.' },
    ],
  },
  {
    id: 'punkito',
    name: 'Punkito',
    age: 19,
    bio: 'No future. SK8 forever. Toco bajo en una banda llamada Caja Sucia.',
    tag: 'punk',
    tagColor: '#ec4899',
    reciprocates: true,
    faceTint: 0x4c1d95,
    chat: [
      { sender: 'maria', text: 'qué pasa' },
      { sender: 'cat', text: 'todo y nada. tienes lana?' },
      { sender: 'maria', text: 'algo' },
      { sender: 'cat', text: 'concierto sábado en La Tabacalera. te apunto +1' },
    ],
  },
  {
    id: 'pija-mar',
    name: 'Marina del Castillo',
    age: 28,
    bio: 'Banco Santander herencia. Esquí en Baqueira. Madrid solo en otoño.',
    tag: 'pija',
    tagColor: '#f9a8d4',
    reciprocates: false,
    faceTint: 0xfbcfe8,
  },
  {
    id: 'mauro-trumpista',
    name: 'Mauro de Vox',
    age: 36,
    bio: 'España, gatos y libertad. Cero impuestos. Estamos en guerra cultural.',
    tag: 'facha sutil',
    tagColor: '#15803d',
    reciprocates: false,
    faceTint: 0xfef9c3,
  },
  {
    id: 'sara-ngo',
    name: 'Sara Solidaria',
    age: 32,
    bio: 'Cooperante en 4 países. Vivo en una furgo. Solo segundamano.',
    tag: 'eco',
    tagColor: '#84cc16',
    reciprocates: true,
    faceTint: 0xd9f99d,
    chat: [
      { sender: 'maria', text: 'hola Sara' },
      { sender: 'cat', text: 'qué tal María. has visto lo del Atlántico?' },
      { sender: 'maria', text: 'no' },
      { sender: 'cat', text: 'te paso. la foto te va a romper. y el viernes recogida de basura, vente' },
    ],
  },
  {
    id: 'alba-mami',
    name: 'Alba Mom',
    age: 35,
    bio: 'Mami coach. Lactancia hasta los 9 años. Kale smoothies. Detoxx.',
    tag: 'mami-coach',
    tagColor: '#22c55e',
    reciprocates: true,
    faceTint: 0xdcfce7,
    chat: [
      { sender: 'maria', text: 'hola Alba' },
      { sender: 'cat', text: 'hola mami. cuántos hijos?' },
      { sender: 'maria', text: 'ninguno' },
      { sender: 'cat', text: 'AY MARÍA. te paso mi link de afiliada. life-changing.' },
    ],
  },
];

/**
 * RESULTADO de armar una ronda Tinder (Día 9e).
 *
 * `cards`: lista de 10 perfiles ordenados.
 * `reciprocatingIds`: IDs que SÍ reciprocan ESTA sesión. Sólo destinos
 * (preasignados al primer play, persistidos en store) pueden estar aquí
 * — los demás siempre devuelven "no match" aunque hagas like.
 * `nalaHints`: pista no-garantizada por carta (por id):
 *   - 'good' (verde): probable destino. Si es destino → 60% prob de pinta verde.
 *     Si NO es destino → 15% prob de fake-good (pista mentirosa).
 *   - 'bad' (rojo): probable distractor. Si NO es destino → 60% prob.
 *     Si es destino → 15% prob de fake-bad (Nala no se decide).
 *   - 'unsure' (gris): ambiguo. Resto.
 *
 * Reglas de selección de cartas:
 *   - count cartas del pool de 50 SIN incluir ya matcheados.
 *   - SIEMPRE garantiza 1-2 destinos no matcheados aún en la selección
 *     (60% una, 40% dos), si quedan suficientes destinos disponibles.
 */
export interface TinderRound {
  cards: TinderCatProfile[];
  reciprocatingIds: Set<string>;
  nalaHints: Record<string, 'good' | 'bad' | 'unsure'>;
}

/**
 * Genera 15 destinos al azar desde el pool. Sólo se llaman gatos con
 * chat (porque sino no hay conversación al matchear). Si el pool con
 * chat es <15, devuelve todos los que haya.
 */
export function generateDestinos(): string[] {
  const eligible = TINDER_CATS.filter((p) => p.chat && p.chat.length > 0);
  // Shuffle Fisher-Yates y pick 15.
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 15).map((p) => p.id);
}

export function buildTinderRound(
  count: number,
  excludeIds: string[],
  destinoIds: string[],
): TinderRound {
  const exclude = new Set(excludeIds);
  const destinoSet = new Set(destinoIds);
  const remainingDestinos = destinoIds.filter((id) => !exclude.has(id));

  // Decide cuántos destinos meter en la sesión: 60% uno, 40% dos.
  let destinosWanted = Math.random() < 0.6 ? 1 : 2;
  destinosWanted = Math.min(destinosWanted, remainingDestinos.length);

  // Pick destinos para esta sesión (random de los pendientes).
  const destinoPickPool = [...remainingDestinos];
  for (let i = destinoPickPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [destinoPickPool[i], destinoPickPool[j]] = [destinoPickPool[j], destinoPickPool[i]];
  }
  const destinosThisSession = new Set(destinoPickPool.slice(0, destinosWanted));

  // Pool de distractores: TINDER_CATS sin matched ni destinos-de-esta-sesión.
  const distractorPool = TINDER_CATS.filter(
    (p) => !exclude.has(p.id) && !destinosThisSession.has(p.id),
  );
  const distractorShuffled = [...distractorPool];
  for (let i = distractorShuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [distractorShuffled[i], distractorShuffled[j]] = [distractorShuffled[j], distractorShuffled[i]];
  }
  const distractorsNeeded = Math.max(0, count - destinosThisSession.size);
  const distractors = distractorShuffled.slice(0, distractorsNeeded);

  // Combinar y barajar para que destinos no estén siempre al inicio/final.
  const destinosCards = TINDER_CATS.filter((p) => destinosThisSession.has(p.id));
  const allCards = [...destinosCards, ...distractors];
  for (let i = allCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
  }
  const cards = allCards.slice(0, count);

  // reciprocatingIds = destinos que aparecen en cards.
  const reciprocatingIds = new Set<string>(
    cards.filter((c) => destinoSet.has(c.id)).map((c) => c.id),
  );

  // Nala hints: 60% acierto al pintar destino verde / distractor rojo,
  // 15% mentira (fake-good para distractor, fake-bad para destino).
  // Resto: 'unsure' (gris). Esto evita garantías 100%.
  const nalaHints: Record<string, 'good' | 'bad' | 'unsure'> = {};
  for (const c of cards) {
    const isDestino = reciprocatingIds.has(c.id);
    const r = Math.random();
    if (isDestino) {
      if (r < 0.6) nalaHints[c.id] = 'good';
      else if (r < 0.75) nalaHints[c.id] = 'bad'; // fake-bad (15%)
      else nalaHints[c.id] = 'unsure';
    } else {
      if (r < 0.6) nalaHints[c.id] = 'bad';
      else if (r < 0.75) nalaHints[c.id] = 'good'; // fake-good (15%)
      else nalaHints[c.id] = 'unsure';
    }
  }

  return { cards, reciprocatingIds, nalaHints };
}

/** Frase pequeña que dice Nala según la pista (random pool). */
export function nalaHintLine(kind: 'good' | 'bad' | 'unsure'): string {
  const goodLines = [
    'mmm... este me huele bien',
    '*Nala maúlla bajito.* éste',
    'tú a este míralo bien',
    'me gusta. lo digo.',
  ];
  const badLines = [
    'paso de este',
    '*Nala bufa.*',
    'naah. siguiente',
    'nope nope',
  ];
  const unsureLines = [
    'no me decido',
    '*Nala parpadea.*',
    'tú verás',
    'hmm, ni idea',
  ];
  const pool = kind === 'good' ? goodLines : kind === 'bad' ? badLines : unsureLines;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Por id, recupera el perfil completo. */
export function findCatProfile(id: string): TinderCatProfile | undefined {
  return TINDER_CATS.find((p) => p.id === id);
}

/** Total de gatos en el pool — 50. */
export function totalCatProfiles(): number {
  return TINDER_CATS.length;
}
