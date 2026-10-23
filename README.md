# Mushu: mascota virtual de pareja

Una mascota que criáis entre los dos desde vuestros teléfonos o computadoras. Funciona como una web estática en GitHub Pages; para compartirla basta con enviar un enlace.

## Qué hace

- **Edad real:** cuenta los días desde su nacimiento (25-09-2025 por defecto, que hoy son 393 días), aunque nadie abra la app.
- **Crece solo:** a los **600 días** pasa a turquesa y se ve más maduro; a los **900** se alarga como un adolescente. No se puede cambiar de etapa a mano.
- **Racha:** empieza en el número que elijáis (393) y sube un día por cada día que lo cuidáis. Se ve arriba.
- **3 vidas al mes:** cada día en que nadie lo cuida gasta una vida y al día siguiente amanece triste. Si se gastan las 3 en el mismo mes, aparece la **caja de mudanza: «Mushu se independizó»**. El **día 1 de cada mes** vuelve a tener 3 vidas.
- **Cada uno con su nombre:** el historial dice quién hizo qué, y si ayer solo vino uno, Mushu dice que extraña al otro.
- **Cuidados:** comer (6 alimentos), acariciar (también deslizando el dedo sobre él) y bañar.
- **Jugar:** abre un minijuego en el que Mushu atrapa balones, corazones y estrellas y tiene que esquivar las nubes.
- **Dormir:** se acuesta en su cama con manta y **descansa 2 horas reales**. Durante ese tiempo no se le puede despertar, y tu pareja también lo ve dormido.
- **Vida propia:** a veces lo pillas haciendo dominadas con el balón, leyendo, con el móvil o con su autito; al verte llegar se sorprende, suelta lo que tenía y te saluda. El balón se puede patear.
- **Armario:** coronita, cetro, gorro y máscara de superhéroe, gorros, gafas, chaquetas, bufandas, capas, zapatos y disfraces completos. Algunas prendas se desbloquean con los días de cuidados.
- **Icono:** si la añadís a la pantalla de inicio del teléfono, el icono es Mushu.

---

## 1. Publicar en GitHub Pages (5 minutos)

1. En GitHub pulsa **New repository**, ponle de nombre `mushu` y créalo como **Public**.
2. Pulsa **uploading an existing file** y arrastra **todo el contenido** de esta carpeta: los archivos y las carpetas `src`, `styles`, `icons`, etc. Pulsa **Commit changes**.
3. Ve a **Settings → Pages**. En *Source* elige **Deploy from a branch**, rama **main**, carpeta **/ (root)**, y guarda.
4. En uno o dos minutos tendrás el enlace: `https://TU_USUARIO.github.io/mushu/`.

Al abrirlo aparece directamente **«¿Cómo se llamará nuestra mascota?»**. Escribe el nombre, la fecha de nacimiento, la racha (393), tu nombre y el de tu pareja.


## 2. Compartirlo con tu pareja (automático)

No hay que configurar nada:

1. Al crear a Mushu, la app guarda una copia compartida automáticamente y en la pantalla principal aparece **«Invita a …»**.
2. Pulsa **Enviar enlace** y mándalo por WhatsApp a tu pareja (también está en **Ajustes → Compartir con tu pareja**).
3. Tu pareja abre el enlace, toca su nombre y listo: los dos veis a la misma mascota. Lo que hace uno le aparece al otro con aviso y animación; la app mira si hay cambios cada 15 segundos y al volver a abrirla. Sin Internet, los cuidados se guardan y se envían al volver la conexión.

Si ya tenías a Mushu creado en tu teléfono con la versión anterior, no hace falta empezar de nuevo: al abrir esta versión se conecta solo y aparece la invitación.

**Cómo funciona por dentro:** la copia compartida se guarda en [jsonblob.com](https://jsonblob.com), un servicio gratuito que no pide cuentas. El enlace contiene la dirección de esa copia, así que compártelo solo con tu pareja. Cada teléfono guarda además todos los datos, y en **Ajustes → Copia de seguridad** podéis descargar un archivo cuando queráis.

**Plan B (solo si el modo automático fallara):** en **Ajustes → Compartir con tu pareja → Otra forma: guardar en GitHub** se puede usar vuestro repositorio con un token:
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → *Only select repositories*: `mushu` → *Contents: Read and write*.

## 3. Reglas y ajustes

| Regla | Detalle |
|---|---|
| Edad | Días reales desde el nacimiento |
| Etapas | Día 600 y día 900. También hacen falta 20 y 40 días de cuidados; si no se cumplen, espera sin perder la edad |
| Racha | +1 por cada día con al menos un cuidado. Un día sin cuidados gasta una vida pero no rompe la racha. Al mudarse se pierde |
| Vidas | 3 por mes. Se recargan el día 1 |
| Mudanza | 3 días sin cuidados en el mismo mes. Se puede «volver a empezar» |
| Dormir | 2 horas en la cama, hasta 3 veces al día |
| Límites | Cada acción tiene un tiempo de espera y un máximo diario. El premio raro (fruta estelar), una vez al día |
| Logros | 7, 30, 100, 180 y 350 días en que los dos lo cuidasteis |

En **Ajustes → Tiempo, racha y evolución → Editar** se pueden corregir la fecha de nacimiento, la racha y los días de cada etapa. Está protegido tras un botón para no cambiarlo por accidente. En **Ajustes → Copia de seguridad** se descarga o se restaura un archivo con todos los datos.

## Para desarrollar (opcional)

```bash
python3 -m http.server 8000   # abrir http://localhost:8000
npm test                      # pruebas de las reglas
```

| Carpeta / archivo | Contenido |
|---|---|
| `index.html`, `styles/app.css`, `manifest.webmanifest`, `icons/` | Interfaz e iconos |
| `src/app/main.js` | Pantallas, cuidados, armario y evolución |
| `src/app/rules.js` | Reglas: edad, etapas, racha, vidas, mudanza, sueño, límites |
| `src/app/store.js` | Guardado en el teléfono y sincronización automática (jsonblob) o con GitHub |
| `src/app/minigame.js` | Minijuego de jugar |
| `src/app/box.js` | Caja de mudanza |
| `src/pet/` | El personaje: dibujo, animaciones, actividades, ropa, cama, balón y partículas |
| `tests/rules.test.mjs` | Pruebas de las reglas |
