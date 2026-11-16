# Convenciones del proyecto Boxeo

## General
- Todo en **español**: código (nombres de variables/funciones), comentarios, commits y textos de la UI.
- 100 % local: nada de servicios de pago ni llamadas a internet en tiempo de ejecución.
- Python **3.12** (no subir a 3.13+ por MediaPipe). Entorno en `.venv`.
- Commits pequeños, mensaje en español en imperativo/descriptivo ("Añade generador de combinaciones").

## Arquitectura
- `motor/` es lógica pura en Python: sin FastAPI, sin I/O salvo leer `data/`. Todo testeable.
- `app/` solo traduce HTTP ⇄ motor y guarda en SQLite (`sqlite3` de la stdlib).
- `motor/` (Python) es la **referencia**. `static/motor/` es un port fiel que debe pasar los tests de
  equivalencia (`tests/test_equivalencia_js.py`). Las reglas nuevas se escriben primero en Python.
- El guion de la sesión lo genera siempre el motor JS en el navegador (funciona sin servidor, PWA).
  El resto de `static/` solo presenta (se migrará a Tauri + React).
- Historial: SQLite vía FastAPI si hay servidor; si no, el almacén (`static/historial.js`).
- Perfil, valoraciones y combinaciones propias (las del creador): SIEMPRE en el almacén del navegador
  (`static/almacen.js`), nunca en el repo ni en `data/`. El sorteo las mezcla con la biblioteca
  (`SorteoMezcla`); con «Ninguna» sale exactamente lo de antes (`tests/test_igual_que_antes.py`). Nada de datos personales en `data/`: se publica tal cual con la web.
- El almacén tiene esquema versionado: sube `VERSION` y añade una migración en `MIGRACIONES` con su test
  solo cuando los datos guardados hay que transformarlos. Un campo nuevo OPCIONAL que se valida en
  `completar()` y cuya ausencia es válida no sube la versión (ejemplo: `sesiones[].tipo`, que las sesiones de
  antes no tienen). Las sesiones locales usan `crypto.randomUUID()`.
- `static/vistas/` solo presenta; `reproductor.js` lleva el tiempo de sesión; `ajustes.js` une perfil y motor.
  `dictado.js` dicta las combinaciones: la pausa cuenta desde el `onend`/`onerror` real de la voz (la
  estimación del motor + 3 s es solo el tope si no llega); avisos y señales también esperan a su voz.
- Todo fichero nuevo de `static/` o `data/` va al precache de `static/sw.js` (lo comprueba `tests/test_pwa.py`),
  salvo `data/revisar.json`, que se publica pero la app no usa.
- Sin WebGL el maniquí muestra fotos WebP que pinta `herramientas/fotos_maniqui.py` con la propia escena 3D al
  montar el sitio (Playwright). No se versionan ni se dibujan aparte: cambian solas con `posturas.json`.
- Si cambia un `# REVISAR CON ENTRENADOR`, regenera `data/revisar.json` con `herramientas/extraer_revisar.py`.
- La voz va detrás de la interfaz de `static/voz.js` (`decir`, `callar`). Hoy Web Speech API, mañana Piper.
- Intro «Que empiece el asalto»: `static/intro.js`, script clásico que corre antes de pintar. Sale una vez por
  arranque en frío (`sessionStorage['boxeo.intro']`); no sale con `prefers-reduced-motion` ni al arrancar en el menú
  (`#entrenar/menu…` o una ruta vieja que `rutaNueva()` lleva allí: la regla está copiada, la une un test). Se traga
  el toque o la tecla que la salta y al salir lanza `intro-fin` (`esperarIntro()` de `vistas/dom.js`).
- Pista del asa: `perfil.pistas.asa` en el almacén. No abre el `<dialog>` y lleva `pointer-events: none`; la lengüeta
  se recoge en ~1,7 s y el globo se queda 4 s (se va antes con un toque, una tecla, el menú, otra vista o la sesión).
- Identidad (`perfil.identidad`): `{ nombre, avatar, foto }`, formato en la 4.1 de `docs/revision/rediseno-plan.md`.
  La foto solo vale si pasa `fotoValida()`: cadena `data:image/jpeg;base64,…` o `data:image/webp;base64,…` de como
  mucho `MAX_FOTO` (200 000) caracteres; `foto.js` la crea de 256 × 256 px. Nunca se pinta con `innerHTML`.
- Nada de `alert()`, `confirm()` ni `prompt()` (lo vigila `tests/test_sin_dialogos_nativos.py`): los errores van en
  un aviso con `role="alert"` (`#aviso-almacen` o junto a lo que falló) y las confirmaciones, con
  `confirmar()` de `vistas/confirmar.js` (`abrirDialogo`/`conectarDialogo`/`atraparFoco`, en `vistas/dom.js`).
- Colores: todos en los tokens de `:root` de `estilos.css`, gris oscuro neutro (R = G = B) y el rojo como acento;
  los degradados que funden las fotos usan `rgb(var(--fondo-rgb) / a)`. `tests/js/contraste.test.mjs` comprueba el
  contraste AA y que los grises sean neutros. La intro lleva sus colores propios.

## Datos
- El vocabulario vive en `data/acciones.json`, nunca en el código. Los golpes se dicen por su nombre o, si el
  usuario lo elige («Nombrar combinaciones»), por su número (`numero`: 1 jab … 6 gancho trasero, por mano
  adelantada/trasera y escrito en ortodoxo; el zurdo lo lee de su espejo con `motor.acciones.numero`).
  Las defensas se dicen con su `orden` corta. Los nombres (`hablado` y `corto`) nunca llevan cifras.
- Todo se define en guardia **ortodoxa**; el zurdo se obtiene con `motor.acciones.espejo()`. No duplicar datos.
- Los textos de cada familia (`hablado`, `corto`, `orden`) están una sola vez en el bloque `textos` de
  `data/acciones.json`; `hablado` es una plantilla (`{mano}`, `{lado}`) que se rellena a partir de mano/lado.
  Los ids no cambian aunque cambie el nombre (`gancho_*` es el crochet; `uppercut_*`, el gancho).

## Reglas de boxeo
- Las reglas están en `motor/reglas.py` (`validar`) y son solo estructurales (al menos un golpe): el boxeo es
  situacional. Si un combo clásico no las pasa, **avisar**, no cambiar la regla.
- El nivel de una combinación lo da solo su número de acciones: `motor.reglas.nivel_de` (2-4 básico, 5-6 medio,
  7-10 avanzado, máximo 10; `None` fuera). Es la única función de nivel: la usarán la biblioteca y el futuro creador.
- Lo dudoso técnicamente se marca con `# REVISAR CON ENTRENADOR`; no inventar.

## Tests
- `.venv\Scripts\python -m pytest -q` debe pasar antes de cada commit.
- Aleatoriedad siempre con `random.Random(semilla)` inyectado (en JS, `crearAzar(semilla)` de `static/motor/azar.js`).
- Todo test de navegador y toda herramienta de capturas abre la app con `preparar(pagina)` de `tests/sin_intro.py`
  (sin intro ni pista, que taparían el primer clic); `intro=True` o `pista=True` para probarlas. Los datos de versiones
  viejas no los toca: la migración se prueba tal cual.
- Antes de hacer clic o medir dentro del menú, `esperar_menu_quieto()` de `tests/menu_quieto.py`.
- Para cronometrar sin esperas, `page.clock` (`install` + `pause_at`); las animaciones CSS no siguen ese reloj (se
  fijan con `getAnimations()`). Las herramientas de capturas escriben solo en `.playwright-mcp/capturas/`, nunca
  sobre ficheros versionados.
- `node` (18+) hace falta para los tests de JS (`tests/js/*.test.mjs`, con `node:test`) y los de equivalencia;
  pytest los lanza todos. Sin Node se saltan en local; en CI fallan.
