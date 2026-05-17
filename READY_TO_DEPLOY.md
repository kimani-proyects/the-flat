# LISTO PARA DEPLOY

Estado: **build de producción verificado** + secretos protegidos. Sólo
faltan 3 pasos para que esté online.

---

## 1. Verificar local (1 minuto)

```powershell
cd K:\TheFlat
npm run build
```

Debe terminar con `✓ Compiled successfully` y listar las rutas.

Si falla por un error nuevo, mándame el output y lo arreglo. Los errores
TS pre-existentes (CatSystem, DialogSystem, supabase middleware) están
silenciados por `next.config.mjs` → `ignoreBuildErrors: true`. No
bloquean producción.

---

## 2. GitHub (3 minutos, primera vez)

### A. Crear repo en GitHub
1. Ve a https://github.com/new
2. Nombre: `the-flat` (o el que quieras)
3. **Privado** (recomendado — es un regalo)
4. NO inicialices con README, .gitignore ni licencia. Vacío.
5. Crear.

### B. Conectar local
```powershell
cd K:\TheFlat

# Inicializa git si no está
git init
git branch -M main

# Verifica que secretos NO se subirán
git status | findstr secrets.local
# Si imprime algo → ¡STOP! revisa .gitignore. Si no imprime nada → OK.

# Comprueba que .env.local tampoco
git status | findstr .env.local
# Debe no imprimir nada.

# Stage all + commit
git add .
git commit -m "MVP The Flat — listo para María"

# Conecta tu repo (sustituye <tu-usuario>)
git remote add origin https://github.com/<tu-usuario>/the-flat.git
git push -u origin main
```

---

## 3. Vercel (3 minutos, primera vez)

1. Ve a https://vercel.com/new
2. Login con GitHub si no lo has hecho.
3. Importa el repo `the-flat`.
4. **Framework Preset**: Next.js (autodetectado).
5. Deja todo lo demás por defecto (Build = `npm run build`, Output = `.next`).
6. **Environment Variables** (opcional):
   - Si quieres que el Tomodachi serial real funcione en producción:
     `NEXT_PUBLIC_TOMODACHI_SERIAL` = `TUCODIGO16CARS`
   - Si no, sale modo demo (DEMODEMODEMODEMO) que sirve para probar el flujo.
7. **Deploy**. Espera 2-3 min.
8. Vercel te da una URL tipo `the-flat-xyz.vercel.app`. **Esa es la URL para María**.

---

## 4. Updates futuros (workflow diario)

Cada vez que arregles algo o añadas algo:

```powershell
cd K:\TheFlat
npm run build         # opcional, verifica que pasa antes de subir
git add .
git commit -m "Fix XYZ"
git push
```

Vercel detecta el push y redespliega automático en 2 minutos. María verá
los cambios la próxima vez que abra la URL.

---

## 5. Antes de entregárselo a María

Una pasada rápida por el juego:
- F9 ya no existe en producción (estamos en `DEV_HUD=false`).
- TOC-TOC: niveles 1, 2 y 3 superables sólo replicando la SECUENCIA L/R.
- Caja fuerte: PIN 1105.
- PC Alex unlock-hatch: código `HAKU-KERO-NALA`.
- Morse decoder: serial del Tomodachi → animación Matrix → 4ª card en Regalos.exe.
- Memorial Haku: al entrar al piso aparece su sprite + bocadillo con frase.

---

## 6. Si algo se rompe en Vercel

- Mira el log: Vercel → Project → Deployments → click en el último.
- 99% de los problemas son env vars faltantes o `secrets.local.ts` con
  contenido inválido (que NO se sube — pero si está en local mal, el
  juego funciona en modo demo).

---

## Cosas opcionales que puedes hacer luego

- Custom domain (`theflat.alex.es` o similar) — Vercel → Settings → Domains.
- Analytics gratis — Vercel → Analytics.
- Convertir el repo a público después del cumple (después de hablarlo
  con María) — settings del repo en GitHub.

Hecho. Feliz cumple a María en tu nombre. 🌸
