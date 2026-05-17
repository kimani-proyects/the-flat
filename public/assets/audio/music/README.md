# Música de los altavoces

Pega aquí los archivos `.mp3`, `.wav`, `.ogg` o `.m4a` que quieras que
sonen al pulsar E sobre los altavoces de la habitación de Alex.

Después de copiar los archivos, abre
`K:\TheFlat\src\game\systems\AudioBus.ts` y añade cada uno al array
`MUSIC_TRACKS`:

```ts
export const MUSIC_TRACKS: MusicTrack[] = [
  { file: 'mi-cancion.mp3', title: 'Mi canción', artist: 'Alex' },
  { file: 'otra.wav', title: 'Otra canción' },
];
```

`file` es el nombre del archivo (relativo a esta carpeta).
`title` y `artist` se muestran en el diálogo cuando suena.
`volume` (0-1) y `loop` (true/false) son opcionales.

**Nota**: el navegador no permite autoplay sin interacción del usuario,
por eso la música sólo arranca al pulsar E sobre los altavoces (no de
forma automática al cargar el juego).
