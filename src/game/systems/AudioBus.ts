/**
 * AudioBus — sistema simple de música ambiente (S2.4).
 *
 * El usuario coloca archivos .mp3 o .wav en
 *   `public/assets/audio/music/`
 * y los nombres se listan en `MUSIC_TRACKS` abajo. Al pulsar E sobre los
 * altavoces, se elige una pista al azar y se reproduce con un HTMLAudio
 * simple (volumen ajustable, loop opcional).
 *
 * Se evita usar la API de audio de Phaser para que el browser permita
 * autoplay sólo tras una interacción del usuario (la pulsación de E).
 *
 * RUTA DE ARCHIVOS
 * ─────────────────────────────────────────────────────────────────────
 * Pega tus mp3 / wav en:
 *
 *   K:\TheFlat\public\assets\audio\music\
 *
 * (cualquiera de estos formatos: .mp3, .wav, .ogg, .m4a)
 *
 * Y añade su nombre al array `MUSIC_TRACKS` debajo. La carga es lazy —
 * los tracks no se descargan hasta que se pulsa play.
 */

export interface MusicTrack {
  /** Filename relativo a /assets/audio/music/. */
  file: string;
  /** Título que se muestra en el HUD cuando suena. */
  title: string;
  /** Artista opcional. */
  artist?: string;
  /** Volumen 0-1. Default 0.5. */
  volume?: number;
  /** ¿Loop? Default true. */
  loop?: boolean;
}

/**
 * Tracks disponibles. RELLENA AQUÍ con tus archivos:
 *
 *   { file: 'mi-cancion.mp3', title: 'Mi canción', artist: 'Alex' },
 *
 * Si dejas el array vacío, los altavoces seguirán existiendo pero no
 * sonará nada (el handler te dirá "no hay música cargada").
 */
export const MUSIC_TRACKS: MusicTrack[] = [
  { file: '01_Chicago.mp3', title: 'Chicago', artist: 'Michael Jackson' },
  { file: '02_GetOnTheFloor.mp3', title: 'Get on the Floor', artist: 'Michael Jackson' },
  { file: '03_WorkinDayAndNight.mp3', title: 'Workin\' Day & Night', artist: 'Michael Jackson' },
  { file: '04_UniverseOfLove.mp3', title: 'Universe of Luv', artist: 'Jaafar Jackson' },
  { file: '05_ExFactor.mp3', title: 'Ex-Factor', artist: 'Lauryn Hill' },
  { file: '06_E85.mp3', title: 'E85', artist: 'Don Toliver' },
  { file: '07_5to10.mp3', title: '5 to 10', artist: 'Don Toliver' },
  { file: '08_Fallin.mp3', title: 'Fallin\'', artist: 'Chris Brown' },
  { file: '09_NobodysBusiness.mp3', title: 'Nobody\'s Business', artist: 'Rihanna ft. CB' },
  { file: '10_HolyGhost.mp3', title: 'Holy Ghost', artist: 'Omah Lay' },
  { file: '11_Soweto.mp3', title: 'Soweto', artist: 'Omah Lay' },
  { file: '12_Victory Lap.mp3', title: 'Victory Lap', artist: 'Fred Again...' },
];

type AudioListener = () => void;

class AudioBusImpl {
  private audio: HTMLAudioElement | null = null;
  private currentTrack: MusicTrack | null = null;
  private loopMode = false;
  private listeners = new Set<AudioListener>();

  /** Suscríbete a cambios (play / pause / next / stop). */
  subscribe(fn: AudioListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  isPlaying(): boolean {
    return !!(this.audio && !this.audio.paused);
  }
  isPaused(): boolean {
    return !!(this.audio && this.audio.paused);
  }
  isLoop(): boolean {
    return this.loopMode;
  }
  getCurrent(): MusicTrack | null {
    return this.currentTrack;
  }

  play(trackIdx?: number): MusicTrack | null {
    if (typeof window === 'undefined') return null;
    if (MUSIC_TRACKS.length === 0) return null;
    const idx =
      trackIdx !== undefined && trackIdx >= 0 && trackIdx < MUSIC_TRACKS.length
        ? trackIdx
        : Math.floor(Math.random() * MUSIC_TRACKS.length);
    const track = MUSIC_TRACKS[idx];
    this.stop(true); // sin notificar — vamos a notificar en bloque
    try {
      this.audio = new Audio('/assets/audio/music/' + track.file);
      this.audio.volume = track.volume ?? 0.5;
      this.audio.loop = this.loopMode || (track.loop ?? false);
      // Auto-next al acabar si NO está en loop.
      this.audio.addEventListener('ended', () => {
        if (!this.audio?.loop) this.next();
      });
      this.audio.play().catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[AudioBus] play() rejected:', err);
      });
      this.currentTrack = track;
      this.notify();
      return track;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[AudioBus] failed to load track', track.file, err);
      this.audio = null;
      this.currentTrack = null;
      this.notify();
      return null;
    }
  }

  pause(): void {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
      this.notify();
    }
  }
  resume(): void {
    if (this.audio && this.audio.paused) {
      this.audio.play().catch(() => {});
      this.notify();
    }
  }
  togglePlayPause(): void {
    if (!this.audio) {
      if (this.currentTrack) {
        const idx = MUSIC_TRACKS.indexOf(this.currentTrack);
        this.play(idx >= 0 ? idx : undefined);
      } else {
        this.next();
      }
      return;
    }
    if (this.audio.paused) this.resume();
    else this.pause();
  }
  toggleLoop(): void {
    this.loopMode = !this.loopMode;
    if (this.audio) this.audio.loop = this.loopMode;
    this.notify();
  }

  stop(quiet = false): void {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch {
        /* ignore */
      }
      this.audio = null;
    }
    this.currentTrack = null;
    if (!quiet) this.notify();
  }

  next(): MusicTrack | null {
    if (MUSIC_TRACKS.length === 0) return null;
    if (MUSIC_TRACKS.length === 1) return this.play(0);
    let nextIdx = Math.floor(Math.random() * MUSIC_TRACKS.length);
    if (this.currentTrack) {
      const curIdx = MUSIC_TRACKS.indexOf(this.currentTrack);
      while (nextIdx === curIdx) {
        nextIdx = Math.floor(Math.random() * MUSIC_TRACKS.length);
      }
    }
    return this.play(nextIdx);
  }
}

/** Singleton — toda la app comparte un solo AudioBus. */
export const AudioBus = new AudioBusImpl();
