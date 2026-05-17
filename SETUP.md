# SETUP — The Flat

Guía paso a paso para dejar el proyecto corriendo en local, conectado a Supabase
y desplegado en Vercel. Pensada para leerse en orden. Si ya has hecho alguno
de los pasos, sáltalo.

---

## 1. Instalar dependencias

Abre una terminal en `K:\TheFlat` y ejecuta:

```bash
npm install
```

Esto descarga Next.js, Phaser, Supabase client, Zustand y demás. Tarda 1-2 minutos.

Cuando termine, arranca el dev server:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Deberías ver la landing
"THE FLAT — Keep it Cutre". Si entras en `/game` verás un placeholder Phaser
("THE FLAT · Hola, María · phaser ok"). Si ves esto: el Día 1 está funcionando.

> **Nota:** `/login`, `/admin` y la protección de rutas **no harán nada útil**
> hasta que conectes Supabase (paso siguiente). El middleware está preparado
> para dejar pasar todo mientras las variables estén vacías, así que puedes
> desarrollar sin bloquearte.

---

## 2. Crear proyecto Supabase (5 minutos)

Supabase es la base de datos + auth + realtime del juego. Tiene plan gratuito
generoso; no harán falta tarjetas ni nada.

### 2.1 Crear cuenta y proyecto

1. Ve a [supabase.com](https://supabase.com) y haz click en **Start your project**.
2. Regístrate con GitHub (recomendado) o email.
3. Dentro del dashboard, click **New project**.
4. Datos del proyecto:
   - **Name:** `the-flat` (o lo que quieras)
   - **Database Password:** genera una fuerte y guárdala (no se usa en el día a día pero la necesitarás si tocas la DB directamente)
   - **Region:** elige **West Europe (Ireland)** o **Central EU (Frankfurt)** — más cercano a Sevilla = menos latencia
   - **Pricing Plan:** Free
5. Click **Create new project**. Tarda ~2 minutos en aprovisionar.

### 2.2 Copiar credenciales

Cuando el proyecto esté listo:

1. En la sidebar izquierda: **Project Settings** (el icono de rueda dentada).
2. Sección **API**.
3. Verás tres valores importantes:
   - **Project URL** → copia este valor
   - **anon public** (bajo "Project API keys") → copia este valor
   - **service_role** (más abajo, marcado como **secret**) → copia también, pero
     **nunca lo pegues en código cliente ni lo subas a GitHub**

### 2.3 Pegar en .env.local

Abre `K:\TheFlat\.env.local` y rellena:

```
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...   ← la anon public
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...        ← la service_role
```

> `.env.local` está en `.gitignore` → nunca se sube a GitHub. Seguro.

Reinicia `npm run dev` (Ctrl+C y arranca de nuevo) para que Next.js recargue
las variables.

### 2.4 Configurar la URL de redirect (magic link)

Para que el login funcione:

1. En Supabase → **Authentication** → **URL Configuration**.
2. **Site URL:** `http://localhost:3000` (para dev). Más adelante añadiremos la de Vercel.
3. **Redirect URLs:** añade `http://localhost:3000/auth/callback`.
4. Guarda.

Para probar: `/login`, pon tu email, click "Recibir enlace mágico". Debería llegarte
un correo de Supabase con un enlace que te logea automáticamente.

---

## 3. Subir el proyecto a GitHub (5 minutos)

Necesario para el deploy automático a Vercel.

```bash
cd K:\TheFlat
git init
git add .
git commit -m "feat: Day 1 — Next.js + Phaser + Supabase scaffold"
```

Luego en [github.com/new](https://github.com/new) crea un repo (privado recomendado
— es un regalo) llamado `the-flat`. Copia los comandos que te da GitHub para
añadir el remote y hacer push.

---

## 4. Desplegar en Vercel (5 minutos)

1. Ve a [vercel.com](https://vercel.com) y regístrate con GitHub.
2. **Add New... → Project**.
3. Selecciona tu repo `the-flat`. Click **Import**.
4. En **Environment Variables**, añade las tres de Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Deploy**. Tarda ~2 minutos.
6. Cuando termine, te da una URL tipo `https://the-flat-xxx.vercel.app`.

### 4.1 Añadir la URL de Vercel a Supabase

Vuelve a Supabase → **Authentication** → **URL Configuration**:
- Añade tu URL de Vercel en **Site URL** (si quieres que esa sea la principal)
  o en **Redirect URLs** junto a `/auth/callback`.

A partir de aquí, cada `git push` redeploya automáticamente.

---

## 5. Checklist Día 1-2 cerrado

- [ ] `npm install` sin errores
- [ ] `npm run dev` muestra landing en `/`
- [ ] `/game` muestra la escena Phaser con "THE FLAT · Hola, María"
- [ ] `.env.local` relleno con credenciales Supabase reales
- [ ] Login en `/login` funciona (recibo el magic link)
- [ ] Repo en GitHub
- [ ] Deploy en Vercel funcionando
- [ ] Redirect URL de Vercel añadida a Supabase

Cuando tengas todo esto marcado, estamos listos para el **Día 3**:
preparar tilesets de LimeZu y montar el primer tilemap en Tiled.

---

## Problemas comunes

**`npm install` falla con errores de permisos en Windows**
→ Abre PowerShell como Administrador o prueba `npm install --no-optional`.

**`npm run dev` dice "port 3000 in use"**
→ Otro proceso está usando el puerto. `npm run dev -- -p 3001` y ajusta la URL.

**El magic link no llega**
→ Revisa spam. Supabase free tier usa sus propios servidores SMTP y a veces tardan.
Alternativa: Authentication → Providers → Email → activar "Confirm email" en OFF
durante desarrollo para que no exija verificación previa.

**Phaser no renderiza en `/game`, pantalla negra**
→ Abre la consola del navegador (F12). Si ves error de `canvas`, reinstala
dependencias: `rm -rf node_modules package-lock.json && npm install`.

**Middleware redirige a /login en bucle**
→ Comprueba que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
están realmente rellenas en `.env.local`, y que reiniciaste el dev server.

---

Cualquier otra cosa, me dices y lo resolvemos.
