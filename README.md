# Mushu — mascota virtual de pareja

Una mascota que criáis entre los dos desde vuestros teléfonos o computadoras.

- **Edad real:** cuenta los días desde su nacimiento, aunque nadie abra la app.
- **Crece sola:** a los **600 días** pasa a la segunda etapa (turquesa, un poco más alto y maduro) y a los **900 días** a la tercera (más alargado, adolescente). No se puede cambiar de etapa a mano.
- **Cada uno con su nombre:** al entrar, cada persona escribe su nombre y el historial dice quién hizo qué.
- **3 vidas:** si un día nadie lo cuida, se pone triste y pierde una vida. Si ayer solo vino uno, extraña al otro. Al tercer día seguido sin cuidados aparece una **caja de mudanza: «Mushu se independizó»**. Cuidarlo cualquier día le devuelve las 3 vidas.
- **Cuidados:** comer (6 alimentos), acariciar (también deslizando el dedo sobre él), jugar, bañar y dormir, con tiempos de espera y límites diarios. Bailar es solo por diversión.
- **Racha compartida:** días seguidos en que los dos lo cuidasteis, con logros a los 7, 30, 100, 180 y 350 días.

---

## 1. Crear la base de datos compartida (Supabase, gratis) — 10 minutos

GitHub Pages solo muestra la página; para que los dos veáis la misma mascota hace falta una base de datos.

1. Entra en <https://supabase.com>, crea una cuenta y pulsa **New project** (elige una contraseña y la región más cercana).
2. Cuando termine de crearse, ve a **SQL Editor → New query**, pega **todo** el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Debe decir *Success*.
3. Ve a **Authentication → Sign In / Providers** y activa **Allow anonymous sign-ins** (así no necesitáis correo ni contraseña).
4. Ve a **Project Settings → API** y copia:
   - **Project URL** (algo como `https://abcd1234.supabase.co`)
   - **anon public key** (una clave larga que empieza por `eyJ…`)

   La clave *anon* es pública por diseño: la protección la ponen las reglas RLS del SQL. **No copies nunca la clave `service_role`.**
5. Abre [`config.js`](config.js) y pega los dos valores:

   ```js
   export const CONFIG = {
     SUPABASE_URL: 'https://abcd1234.supabase.co',
     SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   };
   ```

   (Si prefieres no ponerlos en el repositorio, déjalos vacíos: la app los pedirá la primera vez en cada dispositivo.)

## 2. Publicar en GitHub Pages — 5 minutos

No hace falta compilar nada: son archivos estáticos.

1. En GitHub pulsa **New repository**, ponle un nombre (por ejemplo `mushu`) y créalo como **Public**.
2. Pulsa **uploading an existing file** y arrastra **todo el contenido** de esta carpeta (los archivos y las carpetas `src`, `styles`, `supabase`…). Pulsa **Commit changes**.

   Con la terminal sería:
   ```bash
   cd mascota-pareja
   git init && git add . && git commit -m "Mushu"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/mushu.git
   git push -u origin main
   ```
3. En el repositorio ve a **Settings → Pages**, en *Source* elige **Deploy from a branch**, rama **main**, carpeta **/ (root)** y guarda.
4. En uno o dos minutos tendrás el enlace: `https://TU_USUARIO.github.io/mushu/`. Ese enlace es el que abrís los dos.

> Todas las rutas son relativas, así que funciona dentro de la subcarpeta del repositorio.

## 3. Empezar a cuidarlo juntos

1. **La primera persona** abre el enlace, escribe el nombre de la mascota (*Mushu*), su fecha de nacimiento (por defecto el 25-09-2025, que hoy son 393 días) y **su propio nombre**.
2. En **Ajustes → Invitar a tu pareja** aparece un **código de 6 letras**.
3. **La segunda persona** abre el mismo enlace, elige **«Tengo un código»**, escribe el código y su nombre.
4. Listo: lo que haga uno le aparece al otro al instante, con aviso («Leo le dio una manzana») y la animación.

Cada dispositivo queda vinculado automáticamente. Si borras los datos del navegador o cambias de teléfono, elige «Tengo un código» y escribe el mismo código y **exactamente el mismo nombre**: recuperas tu lugar de cuidador.

## Modo local (para probar)

Si eliges **«Probar en modo local»**, todo se guarda solo en ese navegador y **no se comparte**. La app lo indica arriba («Modo local · no se comparte»). En este modo podéis turnaros en el mismo dispositivo con el botón «Cuida ahora: … ⇄».

## Ajustes protegidos

En **Ajustes → Tiempo y evolución → Editar** se pueden corregir la fecha de nacimiento y los días de cada etapa (600 y 900 por defecto). Está bloqueado tras un botón para no cambiarlo por accidente. Además, para evolucionar hacen falta 20 días de cuidados (segunda etapa) y 40 (tercera); si no se cumplen, espera sin perder la edad.

## Ver en local (opcional, para desarrollar)

```bash
python3 -m http.server 8000   # abrir http://localhost:8000
npm test                      # pruebas de las reglas
```

## Estructura

| Carpeta / archivo | Contenido |
|---|---|
| `index.html`, `styles/app.css` | Interfaz |
| `config.js` | Datos de conexión a Supabase |
| `src/app/main.js` | Pantallas, acciones y sincronización |
| `src/app/rules.js` | Reglas: edad, etapas, vidas, mudanza, racha, límites |
| `src/app/backend-supabase.js` | Conexión compartida (tiempo real y acciones sin conexión) |
| `src/app/backend-local.js` | Modo local |
| `src/app/box.js` | Caja de mudanza |
| `src/pet/` | El personaje: dibujo, animaciones, etapas, comida y partículas |
| `supabase/schema.sql` | Tablas, seguridad (RLS) y reglas en el servidor |
| `supabase/test.sql` | Prueba del esquema |
| `tests/rules.test.mjs` | Pruebas de las reglas |

## Seguridad y fiabilidad

- Solo los dos miembros pueden leer la mascota (RLS); nadie puede escribir directamente en las tablas.
- Las acciones se validan en el servidor con su propia hora (no con el reloj del teléfono): tiempos de espera, límites diarios, vidas y mudanza.
- Sin Internet, las acciones quedan pendientes y se envían al volver; cada una lleva un identificador único y el servidor ignora repeticiones, así que no se duplican recompensas.
- **Ajustes → Copia de seguridad** descarga todos los datos en un archivo.
