# The Flat — Deploy Guide

Guía paso a paso para verificar build local, subir a GitHub, y publicar
en Vercel para que María lo pueda abrir desde cualquier sitio.

---

## 0. Pre-flight check

Antes de hacer nada, verifica que el código compila localmente.

```powershell
# en la raíz del proyecto K:\TheFlat
cd K:\TheFlat
npm install
npm run build
```

Si `npm run build` falla con errores TypeScript, **NO subas nada todavía** —
arregla los errores primero. Si pasa con warnings, está bien.

Smoke test rápido:

```powershell
npm run dev
# abre http://localhost:3000 → comprueba que el juego carga
```

---

## 1. Subir a GitHub

### Primera vez (repo nuevo)

```powershell
cd K:\TheFlat

# Comprueba que .gitignore protege los secretos antes de inicializar
type .gitignore | findstr secrets.local
# Debe imprimir: src/game/data/secrets.local.ts

# Inicia git
git init
git branch -M main

# Stage + commit
git add .
git commit -m "Initial commit — The Flat MVP"

# Crea el repo en github.com (privado recomendado).
# Luego conecta tu repo local:
git remote add origin https://github.com/<tu-usuario>/the-flat.git
git push -u origin main
```

### Updates posteriores

```powershell
cd K:\TheFlat
git add .
git commit -m "Describe el cambio aquí"
git push
```

Vercel detectará el push automáticamente y desplegará la nueva versión
(si lo tienes conectado — siguiente sección).

---

## 2. Desplegar en Vercel

### Primera vez

1. Ve a https://vercel.com/new
2. Conecta tu cuenta de GitHub si no lo has hecho.
3. Importa el repo `the-flat`.
4. **Framework Preset**: Next.js (Vercel lo detecta solo).
5. **Build Command**: `npm run build` (default OK).
6. **Output Directory**: `.next` (default OK).
7. **Environment Variables** — sección crítica:

   - `NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase (si la usas)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key
   - Las puedes copiar de tu `.env.local`

   **Si no usas Supabase aún**, déjalas vacías — el juego funciona en
   modo local-only.

8. **Deploy**. Espera unos 2-3 minutos.
9. Vercel te dará una URL tipo `the-flat-xxx.vercel.app`. Esa es la URL
   pública que María puede abrir desde cualquier navegador.

### Custom domain (opcional)

Si quieres una URL bonita tipo `theflat.alex.es`:

1. Vercel → Project → Settings → Domains → Add Domain.
2. Sigue las instrucciones para apuntar tu DNS al CNAME que te da Vercel.

---

## 3. Secretos sensibles

### Tomodachi Switch serial

El serial REAL del Tomodachi Life vive en `src/game/data/secrets.local.ts`
y **NO se commitea jamás** (está en `.gitignore`).

Eso significa que **Vercel NO tendrá acceso al serial real** a menos que
hagas una de estas dos cosas:

**Opción A (recomendada): variable de entorno**

1. En Vercel → Project → Settings → Environment Variables, añade:
   - `NEXT_PUBLIC_TOMODACHI_SERIAL` = `TUCODIGO16CARACTERES`
2. Modifica `src/game/data/secrets.ts` para leer también de env:

   ```ts
   const envSerial = typeof process !== 'undefined'
     ? (process.env.NEXT_PUBLIC_TOMODACHI_SERIAL ?? null)
     : null;
   const realSerial = envSerial ?? null;
   // ...resto del loader
   ```

3. Redeploy. El serial real estará disponible en build sin tocar Git.

**Opción B (rápido y sucio): edita Vercel build con secrets.local.ts**

NO recomendado porque expone el serial en el bundle JS final.

### Supabase

Las claves de Supabase ya van por env vars en Vercel. No commitees
`.env.local`.

---

## 4. Workflow diario para updates

Cuando arregles un bug o añadas una feature:

```powershell
cd K:\TheFlat

# 1. Comprueba que compila local
npm run build

# 2. Si todo OK, commit + push
git add .
git commit -m "Fix: TOC-TOC nivel 2 tolerancia proporcional"
git push

# 3. Vercel autodesploy. Ve a tu dashboard de Vercel para ver el progreso.
# 4. Una vez verde, refresca theflat.vercel.app — la nueva versión está viva.
```

Si quieres ver el log de build de Vercel:
- Vercel → Project → Deployments → click en el último.

---

## 5. Troubleshooting

### `npm run build` falla con TS errors
- El error de `CatSystem.ts` con propiedades faltantes en `CatRuntime`
  es PRE-EXISTENTE y no rompe el build (warnings).
- Si sale otro error nuevo, lo arreglamos antes de subir.

### Vercel muestra "Build Failed"
- Mira el log. Lo más común: variable de entorno faltante.
- Otras veces: `secrets.local.ts` se commiteó por error → quita del repo:
  ```powershell
  git rm --cached src/game/data/secrets.local.ts
  git commit -m "Remove secrets.local.ts from repo"
  git push
  ```

### "Failed to load resource: 404" para los assets
- Verifica que `public/assets/...` está commiteado y subido.
- LimeZu sprites, audio mp3, fotos de calendar, etc., todos deben
  estar dentro de `public/`.

### El juego carga pero el PC María no muestra el serial Tomodachi
- Falta `NEXT_PUBLIC_TOMODACHI_SERIAL` en Vercel env vars.
- O `secrets.local.ts` no se cargó (modo demo).

---

## 6. Versionado sugerido

Antes de cada release importante, etiqueta:

```powershell
git tag -a v1.0.0 -m "MVP listo para María"
git push --tags
```

Así puedes volver a versiones anteriores si algo se rompe.

---

## 7. Quick reference

| Comando | Para qué |
|---------|----------|
| `npm install` | Instala dependencias (1ª vez o al cambiar package.json) |
| `npm run dev` | Servidor local en http://localhost:3000 |
| `npm run build` | Build de producción (verifica TS + optimiza assets) |
| `npm run lint` | Linter (opcional pre-commit) |
| `git push` | Sube cambios → Vercel autodespliega |

---

Feliz cumpleaños, María. Que disfrutes el regalo.
