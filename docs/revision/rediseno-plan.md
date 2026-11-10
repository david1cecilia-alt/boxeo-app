# Plan: reorganización de la estructura (rediseño, fase de estructura)

Rama `rediseno-estructura`, sacada de `main` en 6114ddd. **Hoy solo diagnóstico, inventario y plan: no se
ha tocado código de la app.** El estilo visual (colores, tipografía, fotos) va en otra fase.

- Boceto en gris (suelto, fuera de la app): [boceto-rediseno.html](boceto-rediseno.html) y sus capturas
  `boceto-rediseno-{390,1440}-{cerrado,abierto}.png` y `boceto-rediseno-390-pista.png`.
- Capturas del estado actual: `.playwright-mcp/capturas/rediseno/antes/` (fuera de git), cada ruta a 390 y
  1440 px, como pantalla visible (`-pantalla`) y página entera (`-entera`). Datos de prueba solo en el
  localStorage de Playwright: 14 sesiones con RPE, 2 combinaciones propias, «Practicar más» con el 3 y
  «Tus combinaciones» en Poco.
- Capturas del diseño del 27-10: `.playwright-mcp/capturas/rediseno/respaldo-27-10/` (ver
  [respaldo-27-10.md](respaldo-27-10.md)).

---

## 1. Inventario del estado actual (main, almacén v8)

### 1.1 Rutas y pantallas

Rutas por hash ([static/rutas.js](../../static/rutas.js)). Cada vista es un `<section id="vista-…">` de
[static/index.html](../../static/index.html). Barra inferior en el móvil y menú lateral a la izquierda desde
1024 px.

| Ruta | Pantalla | Cómo se llega | En la barra |
|---|---|---|---|
| `#entrenar` (por defecto) | Configuración + pantalla de sesión (`#pantalla`, dentro de la misma vista) | Arranque, barra | Sí |
| `#aprende`, `#aprende/<id>` | Guía de técnica: categorías y ficha con el maniquí | Barra | Sí |
| `#historial`, `#historial/<clave>`, `#historial/dia/…`, `…/semana/…`, `…/mes/…` | Galería semana/mes/año, gráfico, sesiones, detalle con valoración, copia de seguridad | Barra | Sí |
| `#perfil` | Estilo recomendado o «Mi estilo», «Sobre ti» (fecha, medidas, 7 preguntas), «Mi estilo» | Barra | Sí |
| `#ajustes` | Tarjeta «Mis combinaciones», Voz, Practicar más | Engranaje arriba a la derecha (móvil, `#ir-ajustes`); «Ajustes» en el menú lateral (PC) | Solo PC |
| `#ajustes/mis-combinaciones` | Listado de propias (editar, borrar con confirmación) | Tarjeta de Ajustes | — |
| `#ajustes/mis-combinaciones/nueva`, `…/editar/<id>` | Editor del creador | Listado; enlace «Crea la primera» de Entrenar | — |
| (diálogo) `#postsesion` | Valoración al acabar | Al terminar o parar una sesión | — |

### 1.2 Controles de cada pantalla y claves del almacén v8 que usan

Almacén: `localStorage["boxeo"]`, `{ version: 8, sesiones, valoraciones, combinacionesPropias, perfil }`
([static/almacen.js](../../static/almacen.js)).

**Entrenar** ([static/vistas/entrenar.js](../../static/vistas/entrenar.js), [static/ajustes.js](../../static/ajustes.js))

| Control | Elemento | Clave que lee / escribe |
|---|---|---|
| Presets: Amateur 3×3 · Prueba 2×30 s · Personalizado | `#presets` (radios `preset`) | `perfil.sesion.asalto` (`amateur` / `prueba` / `personalizado`); los presets salen de `data/presets.json` |
| Ajustes avanzados (solo con Personalizado): asaltos, duración, descanso | `#avanzados`, `#asaltos`, `#duracion`, `#descanso` | `perfil.sesion.personalizada.{asaltos,duracion_asalto,descanso}` (se guarda solo si es válida) |
| Nivel 1 · 2 · 3 | `#niveles` (radios `nivel`) | `perfil.sesion.nivel` (`null` = el de `data/perfil.json`) |
| Tus combinaciones: Ninguna · Poco · Bastante · Mucho · Solo las mías | `#mezclas` (radios `mezcla`) | `perfil.sesion.mezcla`; lee `combinacionesPropias` (sin propias: enlace a `#ajustes/mis-combinaciones/nueva`) |
| Ritmo 1-5 | `#ritmo` (range) | `perfil.sesion.ritmo` |
| Nombrar combinaciones: Números · Nombres · Ambos | radios `voz` | `perfil.sesion.voz` |
| Zurdo | `#zurdo` (switch) | `perfil.sesion.zurdo` (`null` = la guardia de `data/perfil.json`) |
| Reacción | `#reaccion` (switch) | `perfil.sesion.reaccion` |
| «Tu sesión» (resumen, solo PC) | `#resumen-grande`, `#resumen-elecciones` | Lo anterior |
| Empezar | `#empezar` | Lee todo lo anterior, `perfil.voz.velocidad`, `perfil.practicar` y `combinacionesPropias`; al acabar escribe en `sesiones` (o en SQLite si hay servidor) |
| Línea «Voz: …» | `#info-voz` | `perfil.voz.id` (indirectamente, por la voz activa) |
| Engranaje (móvil) | `#ir-ajustes` | — |
| Sesión: Pausa · Parar (y espacio / Esc) | `#pausa`, `#parar` | — |
| Post-sesión: RPE 1-10, sensación, bien, corregir, costosas | `dialog#postsesion` | `valoraciones["local:<id>"]` |

**Aprende** ([static/vistas/aprende.js](../../static/vistas/aprende.js)): categorías, fichas y maniquí. No usa el
almacén: solo `data/tecnica.json`, `data/acciones.json` y `data/posturas.json`.

**Historial** ([static/vistas/historial.js](../../static/vistas/historial.js), `galeria.js`, `grafico.js`)

| Control | Clave |
|---|---|
| Semana · Mes · Año y flechas ‹ › | `perfil.historial.agrupar` |
| Gráfico Asaltos / RPE | `perfil.historial.grafica` |
| Lista de sesiones → detalle (`#historial/<clave>`) | `sesiones` (o SQLite) y `valoraciones` |
| Valorar / editar valoración | `valoraciones[clave]` |
| Borrar sesión | `sesiones` (o SQLite) y su `valoraciones[clave]` |
| Exportar mis datos | Todo `datos` (más las sesiones del servidor, como referencia) |
| Importar copia… | Sustituye todo `datos` (pasa por `migrar`) |

**Perfil** ([static/vistas/perfil.js](../../static/vistas/perfil.js))

| Control | Clave |
|---|---|
| Antetítulo «Ortodoxo · nivel Medio» | Lee `perfil.sesion.zurdo` y `perfil.sesion.nivel` |
| Tarjeta «Estilo recomendado» / «Tu estilo» | Lee `perfil.estilo` y `perfil.basicos` (+ `data/estilos.json`) |
| «Sobre ti»: empecé a boxear, altura, peso, alcance | `perfil.basicos.{inicio,altura_cm,peso_kg,alcance_cm}` |
| «Sobre ti»: 7 preguntas en chips | `perfil.estilo.{distancia,presion,golpe_favorito,volumen,cardio,defensa,iniciativa}` |
| «Mi estilo» | `perfil.estilo.mi_estilo` |

**Ajustes** ([static/vistas/ajustes.js](../../static/vistas/ajustes.js))

| Control | Clave |
|---|---|
| Tarjeta «Mis combinaciones N/20» | Lee `combinacionesPropias` |
| Voz (selector) | `perfil.voz.id` |
| Velocidad Lenta · Normal · Rápida | `perfil.voz.velocidad` |
| Probar voz | Lee `perfil.sesion.voz` y `perfil.sesion.zurdo` |
| Practicar más: 3 huecos, panel con pestañas Golpes · Defensas · Salidas, «Un poco más / Bastante más», quitar | `perfil.practicar = [{ movimiento, cuanto: "poco" \| "bastante" }]` |

**Mis combinaciones** ([static/vistas/creador.js](../../static/vistas/creador.js)): listado, editar, borrar,
editor por grupos con «Al cuerpo», escuchar y guardar → `combinacionesPropias` (lee `perfil.sesion` para
decirlas como en Entrenar). Al salir del editor con cambios pregunta si se descartan (también con el «atrás»
del navegador).

**Claves que no edita nadie desde la interfaz**: `perfil.historial.*` se guarda solo al cambiar la vista
del Historial.

### 1.3 Toques para empezar una sesión

**1 toque** desde que se abre la app, tanto la primera vez como las siguientes: `#entrenar` es la ruta por
defecto y ya trae marcado lo último elegido (o Amateur 3×3 y el nivel de `data/perfil.json`), así que basta
con «Empezar». Con la estructura nueva sigue siendo **1 toque**: General viene elegida para quien no ha
personalizado nada, y si no, lo último elegido. La animación de entrada no añade toques, porque se quita
sola en ≤ 1 s, y si se toca para saltarla, ese toque no puede llegar a «Empezar» (ver 3.6).

---

## 2. Estructura nueva (decidida) y cómo encaja

- **Barra**: Entrenar · Aprende · Historial. Perfil y Ajustes salen de la barra y del menú lateral del PC.
  El engranaje `#ir-ajustes` desaparece.
- **Entrenar**: cabecera (avatar o foto · nombre · estilo), que es **un solo botón** que abre `#perfil`; selector
  **General | Personalizada**; resumen de la sesión elegida; Empezar.
- **Menú lateral, solo en Entrenar**, con asa de puntitos: a) Personalizar sesión, b) Mis combinaciones,
  c) Ajustes.
- **Copia de seguridad**: se queda en Historial, sin cambios.
- **Perfil** (`#perfil`, fuera de la barra): resultado del estilo; el cuestionario, detrás de «Repetir».

### 2.1 Propuestas tomadas del diseño del 27-10 (solo colocación; los colores, en otra fase)

1. **Selector en chips/segmentado con «Personalizado»**: el antecedente directo de General | Personalizada.
   Propuesta: un segmentado de dos opciones a todo el ancho. Con `?prueba` aparece una tercera, «Prueba
   2×30 s» (ver 3.3).
2. **Columna derecha «Tu sesión» + Empezar a 1440 px**: a la izquierda la cabecera de perfil y el selector;
   a la derecha, fijo al hacer scroll (`position: sticky`), «Tu sesión» con el resumen y Empezar. Es lo que
   dibuja el boceto. A la derecha de la columna queda un margen para el asa (112 px), para que no tape
   Empezar.

---

## 3. Qué se mueve, qué se quita y qué se crea, archivo por archivo

### 3.1 Archivos de la app

| Archivo | Cambio |
|---|---|
| [static/index.html](../../static/index.html) | **Quita**: `#ir-ajustes`, `section#vista-ajustes`, los enlaces Perfil y Ajustes de `#pestanas`, la foto de cabecera, la marca de agua y el titular de Entrenar, `#presets`, `#avanzados` y la `config-tarjeta`. **Crea** en Entrenar: `button.cabecera-perfil` (avatar, nombre, estilo), `fieldset#tipo-sesion` (General / Personalizada), «Tu sesión», `button#asa` (`aria-controls="menu"`, `aria-expanded`), `dialog#menu` con tres secciones y `div#intro` (hueco de la animación). `#pantalla` y `#postsesion` no cambian. |
| [static/rutas.js](../../static/rutas.js) | **Crea** las redirecciones con `location.replace` (no dejan entrada en el historial): `#ajustes/mis-combinaciones[/…]` → `#entrenar/mis-combinaciones[/…]` y `#ajustes` → `#entrenar/menu/ajustes`. `#perfil` sigue siendo una ruta, aunque no tenga enlace en la barra (el `aria-current` no marca ninguna pestaña). |
| [static/app.js](../../static/app.js) | Ya no llama a `iniciarAjustes` como vista; monta el menú (`iniciarMenu`) dentro de Entrenar y arranca la intro. |
| [static/vistas/entrenar.js](../../static/vistas/entrenar.js) | Se queda con: cabecera, selector, resumen, Empezar y la sesión. **Salen** a `personalizar.js` el nivel, la mezcla, el ritmo, la reacción, asaltos/duración/descanso y su guardado; **salen** a la sección Ajustes los modos de voz y la guardia. `mostrar(parametro)` atiende `menu`, `menu/<seccion>` y `mis-combinaciones/…`. |
| **Nuevo** `static/vistas/menu.js` | El asa y el panel: toque, arrastre, teclado, foco, Esc, «Atrás», la pista de la primera vez y `prefers-reduced-motion` (ver 3.5). Solo presenta y abre o cierra; el contenido lo pintan las secciones. |
| **Nuevo** `static/vistas/personalizar.js` | Sección a): asaltos, duración, descanso, nivel, ritmo, Practicar más (traído de `vistas/ajustes.js`, sin «Un poco / Bastante»), Tus combinaciones y Reacción. Si se cambia algo con General elegida, el selector pasa a Personalizada (duda D3). |
| [static/vistas/ajustes.js](../../static/vistas/ajustes.js) | Pasa a ser la sección c) del menú: voz, velocidad, **Nombrar combinaciones** (viene de Entrenar), **guardia** diestro/zurdo (viene de Entrenar) y **nombre y avatar/foto**. Salen «Practicar más» (a `personalizar.js`), la tarjeta «Mis combinaciones» (a la sección b) y la lógica de «Volver» y de la subpágina. |
| [static/vistas/creador.js](../../static/vistas/creador.js) | `RUTA = "#entrenar/mis-combinaciones"`; «← Volver» del listado lleva a `#entrenar/menu/combinaciones`; se pinta en un contenedor de Entrenar (`#entrenar-sub`) en vez de `#ajustes-contenido`. La lógica de descartar cambios con «atrás» se queda igual, con la ruta nueva. |
| [static/vistas/perfil.js](../../static/vistas/perfil.js) | Arriba, avatar o foto, nombre y estilo (solo se ven: se cambian en el menú, D7). El resultado del estilo, visible; las 7 preguntas, plegadas detrás de **«Repetir el cuestionario»** («Hacer el cuestionario» si no hay respuestas). Fecha y medidas siguen aquí (D8). «← Volver» lleva a `#entrenar`. El antetítulo lee la guardia de su sitio nuevo. |
| **Nuevo** `static/vistas/avatar.js` | Elegir un avatar predefinido (lista de `data/avatares.json`) o una foto propia; pinta el avatar en la cabecera y en Perfil. Sin avatares ni foto: un círculo con la inicial del nombre, sin inventar imágenes. |
| **Nuevo** `static/foto.js` | Lógica sin DOM de la foto: recorte cuadrado centrado y reducción a 256 px en JPEG (calidad 0,85) con `createImageBitmap` + `OffscreenCanvas` (o `<canvas>`); comprueba tipo y tamaño. Unos 15-35 KB en base64 por foto. |
| **Nuevo** `static/intro.js` | El hueco de la animación: overlay de ≤ 1 s, se salta al tocar o con una tecla (y se traga ese toque), no se muestra con `prefers-reduced-motion: reduce`. Sin diseño: un fondo gris. |
| [static/ajustes.js](../../static/ajustes.js) | `preferencias()` devuelve `tipo` (`general` / `personalizada` / `prueba` solo con `?prueba`) en vez de `asalto`. **Crea** `configGeneral()` (3×3 de `data/presets.json` y lo fijo de D1) y `conPrueba()` (lee `?prueba`). `cambiarPracticar(practicar, movimiento, elegir)` sin `cuanto`. `resumenElecciones` para General. |
| [static/almacen.js](../../static/almacen.js) | `VERSION = 9`, la migración 8 → 9 (sección 4) y `completar()` con `identidad` y `pistas`. Valida la foto al leer y al importar. |
| [motor/sorteo.py](../../motor/sorteo.py) → [static/motor/sorteo.js](../../static/motor/sorteo.js) | **Python primero**: `FACTOR_PRACTICAR` pasa a un solo número (sección 5) y `peso_practicar` ignora `cuanto` (lo de antes sigue sirviendo). `TOPE_PRACTICAR` se recalcula para 3 elegidos. Después, el port a JS y la equivalencia. |
| [data/presets.json](../../data/presets.json) | `amateur` se queda (id estable) con `"nombre": "General"`; `prueba` se queda (la usan los tests y `?prueba`). El Historial dirá «General · nivel 2» donde decía «Amateur 3×3 · nivel 2». |
| **Nuevo** `data/avatares.json` + `static/imagenes/avatares/` | **Hueco**: lista vacía hasta que David pase las imágenes (WebP cuadrados de 256 px; autoría en `CREDITOS.md`). Al precache de `sw.js` en cuanto haya ficheros. |
| [static/estilos.css](../../static/estilos.css) | Estilos de la cabecera de perfil, el selector, «Tu sesión», el asa, el panel, la pista y la intro. Fuera lo que deja de usarse (`#ir-ajustes`, `.presets`, `.config-tarjeta`, la foto de Entrenar). **Todo en gris neutro** (D6): los tokens de `:root` pasan a una escala de grises; no hay que reescribir componentes. |
| [static/sw.js](../../static/sw.js) | Al precache: `vistas/menu.js`, `vistas/personalizar.js`, `vistas/avatar.js`, `foto.js`, `intro.js`, `data/avatares.json` (lo comprueba `tests/test_pwa.py`). |
| [CLAUDE.md](../../CLAUDE.md) | Actualizar: `ajustes.js` une perfil y motor (igual); `vistas/ajustes.js` es una sección del menú; las rutas de Mis combinaciones; Practicar más con un nivel. |
| `herramientas/capturas_practicar.py`, `capturas_creador.py`, `capturas_mezcla.py`, `capturas_perfil_historial.py` | Usan `#ajustes` y los controles de Entrenar: se actualizan cuando se muevan (no son tests, pero se rompen). |

### 3.2 Lo que no cambia

El motor (salvo el factor de Practicar), `reproductor.js`, `dictado.js`, `voz.js`, `historial.js`, la vista
del Historial y la copia de seguridad, Aprende, la pantalla de la sesión, la post-sesión y el servidor
FastAPI.

### 3.3 «Prueba 2×30 s» fuera de la interfaz, pero accesible

Propuesta: **`?prueba` en la URL** (`index.html?prueba#entrenar`). Con él, el selector enseña una tercera
opción «Prueba 2×30 s»; sin él, no existe en la interfaz. Por qué así:

- Funciona sin conexión: el service worker busca en la caché con `ignoreSearch: true`, así que
  `index.html?prueba` sale de la caché.
- No se guarda: elegir Prueba no cambia `perfil.sesion.tipo`. Al quitar `?prueba` vuelve lo de siempre, y nadie
  se queda «atrapado» en una sesión de 1 minuto.
- Los tests de motor no cambian: `data/presets.json` conserva `prueba` y `cargar_presets()` la sigue dando
  (`tests/test_sorteo.py`, `tests/test_mezcla.py`, `tests/test_temporizador.py`, `tests/test_igual_que_antes.py`).
- Los tests de navegador que la usan abren la página con `?prueba` (ver 6.1).

Descartadas: tocar el logo 5 veces (no se descubre, no es accesible y es más código) y una clave en
localStorage (los tests ya escriben el almacén, pero sería un ajuste oculto que sobrevive en el móvil).

### 3.4 Redirección de la ruta vieja

`#ajustes/mis-combinaciones` → `#entrenar/mis-combinaciones`, con el resto de la ruta (`/nueva`,
`/editar/<id>`), con `location.replace`. Así «Atrás» no rebota a la ruta vieja. `#ajustes` →
`#entrenar/menu/ajustes` (Entrenar con el menú abierto en Ajustes). Sirve para marcadores, para los enlaces
de los tests y para el enlace «Crea la primera» si queda alguno.

### 3.5 El asa y el menú (detalle)

- **Qué es**: un `<button id="asa" aria-controls="menu" aria-expanded="false" aria-label="Menú: personalizar,
  mis combinaciones y ajustes">`. Con teclado y lector de pantalla es un botón normal (Intro / Espacio), así
  que arrastrar nunca es la única forma (WCAG 2.5.7). Área táctil de 48 × 72 px; lo que se ve es una pastilla
  con 2 × 3 puntitos.
- **Dónde**: a la **derecha**, a **28 px** del borde y al 42 % de alto. Así queda fuera de la franja del gesto
  «Atrás»: en Android nace en los dos bordes (unos 20-24 dp) y en iOS en el izquierdo. Ponerlo a la derecha
  evita además el gesto de iOS. En el PC, en el margen derecho de la columna.
- **Abrir y cerrar**: tocar alterna. Arrastrar (eventos de puntero con `touch-action: none` en el asa): el
  panel sigue al dedo; al soltar se abre si ha recorrido ≥ 30 % de su ancho o va rápido (> 0,5 px/ms), y
  si no, vuelve. Un movimiento de menos de 8 px cuenta como toque. Se cierra con «✕», Esc, tocando el velo,
  arrastrando el panel hacia la derecha o con «Atrás» (D4).
- **Panel**: `<dialog>` con `showModal()`, que deja inerte el resto de la página (foco atrapado gratis; además el
  `atraparFoco` que ya existe en `vistas/dom.js`). Ancho `min(88vw, 420px)` desde la derecha. Las tres secciones
  son `<details>` (a abierta por defecto; `#entrenar/menu/<seccion>` abre esa).
- **Foco**: al abrir, al título del menú (`h2 tabindex="-1"`), que el lector anuncia; al cerrar, de vuelta al
  asa (lo hace `dialog.close()`, que se comprueba con un test). Al volver de Mis combinaciones, el foco va a su
  enlace del menú.
- **Pista de la primera vez**: si `perfil.pistas.asa` es `false`, tras la intro el panel asoma 64 px durante
  unos 1,2 s, con el globo «Desliza o toca para personalizar tu sesión» (`role="note"`), y se recoge. Se marca
  vista en cuanto se ha enseñado una vez o se abre el menú. Con `prefers-reduced-motion` no hay movimiento:
  solo el globo unos segundos.
- **Solo en Entrenar**: el asa está dentro de `#vista-entrenar`, y se oculta durante la sesión
  (`body.entrenando`) y en Mis combinaciones.

### 3.6 Animación de entrada (solo el hueco)

`div#intro` a pantalla completa, gris liso, con un contenido vacío para la fase visual. Dura como mucho
1 s. Desaparece sola, o al primer `pointerdown` o tecla, que se cancela (`preventDefault` +
`stopPropagation`) para que no pulse lo que haya debajo. Con `prefers-reduced-motion: reduce` no se
muestra. Una vez por arranque en frío: `sessionStorage`, con try/catch; si falla, se muestra (D13).

### 3.7 Avatar y foto

- **Predefinidos**: los pasa David. Hasta entonces la lista de `data/avatares.json` está vacía y la interfaz
  solo ofrece «Foto propia» y la inicial.
- **Foto propia**: `<input type="file" accept="image/*">` (en el móvil ofrece cámara o galería), recorte
  cuadrado centrado, 256 × 256, JPEG 0,85 → `data:image/jpeg;base64,…`. Nunca sale del navegador. Rechazo
  claro si no es una imagen o no se puede leer (HEIC en algunos navegadores de escritorio).
- **En la copia de seguridad**: entra sola, porque `exportar()` copia todo `datos`. Al importar,
  `completar()` solo acepta `data:image/jpeg;base64,` o `data:image/webp;base64,`, como mucho 200 000
  caracteres; si no cumple, se descarta la foto y se avisa. Nunca se pinta con `innerHTML`, solo como
  `img.src`.
- **Cuota**: 256 px en JPEG ocupan unos 30 KB de los ~5 MB de localStorage. Si aun así falla, ya existe el
  aviso «No se puede guardar en este navegador: exporta tus datos».

---

## 4. Migración del almacén v8 → v9

| Campo v8 | v9 | Cómo se convierten los datos viejos |
|---|---|---|
| `perfil.sesion.asalto` (`amateur` / `prueba` / `personalizado`) | `perfil.sesion.tipo` (`general` / `personalizada`) | `personalizado` → `personalizada`. `amateur` o `prueba` → **`general` solo si todo lo demás coincide con lo fijo de la General** (D1). Si no (por ejemplo, nivel 2 o «Tus combinaciones» en Poco), → `personalizada` con `personalizada = { 3, 180, 60 }`, para que **al actualizar no cambie la sesión** (el mismo criterio que en v3 → v4 y v6 → v7). `prueba` nunca se queda. |
| `perfil.practicar = [{ movimiento, cuanto }]` | `[{ movimiento }]` | Se quita `cuanto`. **Se podría hacer sin migrar**: el motor nuevo ignora `cuanto`. Como la v9 hace falta igualmente, se limpia aquí. |
| — | `perfil.identidad = { nombre: "", avatar: null }` | Nuevo, vacío. `avatar`: `null`, `{ tipo: "predefinido", id }` o `{ tipo: "foto", datos }`. |
| — | `perfil.pistas = { asa: false }` | Nuevo. A quien ya usaba la app también se le enseña la pista una vez. |
| `perfil.sesion.zurdo` (guardia) | **igual** | **Sin migrar**: solo cambia dónde se edita (Ajustes), no dónde se guarda. `preferencias()` ya lo da a la General y a la Personalizada. |
| `perfil.sesion.voz` (Nombrar combinaciones) | **igual** | **Sin migrar**, por lo mismo. |
| `perfil.voz.{id,velocidad}`, `perfil.basicos`, `perfil.estilo`, `perfil.historial` | igual | — |
| `sesiones`, `valoraciones`, `combinacionesPropias` | igual | Las sesiones guardan su propio `zurdo`, `voz` y duración: el Historial no depende de la estructura nueva. |

Lo de «guardia y nombrar» se podría mover a `perfil.ajustes` para que el nombre `sesion` fuera exacto, pero
costaría una migración y tocaría tests sin ganar nada que se vea. **Propuesta: no moverlo.**

Tests de la migración (en `tests/js/almacen.test.mjs`): amateur con lo fijo → general; amateur con nivel 2
→ personalizada 3×3; amateur con mezcla Poco → personalizada; prueba → general; personalizado →
personalizada con sus valores; `cuanto` quitado; `identidad` y `pistas` por defecto; v0 → v9 de un tirón;
copia v8 importada → v9; foto mal formada descartada al importar; `VERSION === 9`.

---

## 5. «Practicar más» con un solo nivel

**Propuesta: un solo factor de ×3** (`FACTOR_PRACTICAR = 3.0`), con `TOPE_PRACTICAR = 8` igual que ahora. Hoy
hay dos: «Un poco más» = ×2 y «Bastante más» = ×4.

### 5.1 Simulación

Sesiones 3×3 a ritmo Constante con el guion real (`construir_guion` + `SorteoBiblioteca`, semilla fija): 400
sesiones por caso. Se mide **qué parte de las combinaciones dichas lleva el movimiento**. El script está en
el scratchpad de esta sesión; propuesta: añadirlo en R0 como `herramientas/simular_practicar.py`, para
repetirlo si cambia la biblioteca.

Un movimiento elegido (extracto; con ×1 = sin elegir):

| Nivel | Movimiento | ×1 | ×2 (antes «un poco») | ×2,5 | **×3** | ×4 (antes «bastante») |
|---|---|---|---|---|---|---|
| 1 (70 combinaciones/sesión) | 3 crochet | 28 % | 42 % | 47 % | **50 %** | 56 % |
| 1 | rodar | 10 % | 18 % | 21 % | **23 %** | 27 % |
| 1 | pivote (de lo más raro) | 3,6 % | 6,4 % | 7,5 % | **8,5 %** | 10,5 % |
| 2 (52/sesión) | 5 uppercut | 46 % | 61 % | 67 % | **69 %** | 75 % |
| 2 | parada | 12 % | 21 % | 24 % | **27 %** | 32 % |
| 2 | paso lateral (de lo más raro) | 1,6 % | 2,9 % | 3,8 % | **4,1 %** | 5,0 % |
| 3 (35/sesión) | bloqueo | 41 % | 57 % | 62 % | **66 %** | 71 % |
| 3 | 1 jab (ya casi siempre) | 86 % | 92 % | 93 % | **94 %** | 96 % |

Tres elegidos a la vez (lo que cuesta a los demás):

| Nivel, elegidos | ×2 | ×2,5 | **×3** | ×4 |
|---|---|---|---|---|
| 1: 3 crochet, esquiva, rodar | 42 / 25 / 18 % · jab 46→40 % | 47 / 27 / 20 % · jab →39 % | **49 / 28 / 22 % · jab →38 %** | 50 / 29 / 21 % · jab →35 % |
| 2: 4 crochet, 5 uppercut, rodar | 57 / 61 / 56 % · recto 45→36 % | 57 / 62 / 57 % | **57 / 62 / 57 % · recto →36 %** | 56 / 61 / 55 % |

### 5.2 Por qué ×3

1. **Se nota con un solo movimiento**: un golpe de nivel 1-2 pasa de ~1 de cada 3-4 combinaciones a ~1 de
   cada 2 (+20 puntos). Con ×2 la subida era de +13-15 puntos, menos visible en una sola sesión.
2. **Con varios elegidos se satura igual**: con tres movimientos, de ×2,5 a ×4 sale prácticamente lo mismo,
   porque una combinación que lleva dos elegidos ya llega al tope de ×8 y la cobertura del 1 al 6 sigue
   mandando. Un factor más alto no daría nada más; solo quitaría más a los no elegidos con un movimiento.
3. **Queda entre los dos de antes** (×2,83 es su media geométrica): quien tenía «Un poco» verá su movimiento
   algo más, y quien tenía «Bastante», algo menos (por ejemplo, el crochet de nivel 1: 42 % → 50 % ← 56 %).
4. **Nunca se quita nada**: el jab de nivel 1 baja como mucho del 46 % al 38 % con tres elegidos; lo raro
   sigue saliendo.
5. **Límite de la herramienta**: los movimientos rarísimos de un nivel (pivote o salir en básico, paso lateral
   en medio) apenas suben en valor absoluto con ningún factor (3-4 % → 8 %): la biblioteca casi no los
   tiene en ese nivel. La solución ahí es la biblioteca o el creador, no un factor más alto. Hay que decírselo
   al usuario: «Pocas combinaciones de tu nivel lo llevan».

**Tope**: con ×3, dos elegidos en la misma combinación darían ×9 y se quedan en ×8; tres, ×27 → ×8. Se
deja `TOPE_PRACTICAR = 8` (así ninguna combinación pesa más de 8 veces otra).

`# REVISAR CON ENTRENADOR`: si ×3 (la mitad de las combinaciones con el golpe elegido) es una buena dosis para
trabajar un golpe en una sesión, o si es demasiado repetitivo para un principiante.

---

## 6. Tests

### 6.1 Los que se rompen (y por qué)

| Archivo | Qué se rompe |
|---|---|
| `tests/test_ajustes_navegador.py` | Entero: abre `#ajustes`, mira `#ajustes-contenido > form` y «Un poco / Bastante más». Se reescribe como sección c) y Practicar dentro del menú. |
| `tests/test_creador_navegador.py` | Ruta `#ajustes/mis-combinaciones`, `#ajustes-contenido`, `#ir-creador`. Ruta nueva y contenedor nuevo; el comportamiento (descartar con «atrás») se mantiene. |
| `tests/test_mezcla_navegador.py` | El control de mezcla pasa al menú; el enlace `#ajustes/mis-combinaciones/nueva`; en la línea 187, `asalto: "prueba"` → `tipo` y abrir con `?prueba`. |
| `tests/test_perfil_navegador.py` | `version == 8` (línea 74); `#zurdo` en Entrenar (líneas 59 y 85) pasa a Ajustes del menú; el cuestionario, detrás de «Repetir». |
| `tests/test_grafica_navegador.py` | `version == 8` (línea 111). |
| `tests/test_aprende_navegador.py` | Recorre `#pestanas a` (línea 260): ahora son 3. |
| `tests/test_sesion_navegador.py` | No se rompe: solo usa `#empezar`, `#pausa` y `#combo`, que se quedan. Lo único: la intro no debe tapar el primer clic (los tests abren con `prefers-reduced-motion` o con la intro ya vista). |
| `tests/js/almacen.test.mjs` | `VERSION === 8` (línea 393) y las formas por defecto (`sesionPorDefecto`). |
| `tests/js/ajustes.test.mjs` | `preferencias()` (`asalto` → `tipo`, líneas 60-102) y `cambiarPracticar` con `cuanto`. |
| `tests/test_sorteo.py` | `_peso` con poco/bastante y el tope (líneas ~105-125). |
| `tests/js/sorteo.test.mjs`, `tests/test_equivalencia_js.py`, `tests/test_mezcla.py`, `tests/js/exportar.mjs` | Casos con `cuanto: "poco" / "bastante"`: pasan a `{ movimiento }`. |
| `tests/test_igual_que_antes.py` + `tests/fijos/igual_que_antes.json` (+ `tests/js/igual_que_antes.mjs`) | Las huellas **con** Practicar cambian (factor nuevo) y se regeneran con `python -m tests.test_igual_que_antes`. Las huellas **sin** Practicar tienen que salir idénticas: es la prueba de que solo ha cambiado el factor. |
| `tests/js/contraste.test.mjs` | Los pares de tokens cambian al pasar a gris; se recalculan y siguen exigiendo 4,5:1 y 3:1. |

No cambian: `test_reglas`, `test_temporizador`, `test_ritmo`, `test_reservas`, `test_silencio_final`,
`test_biblioteca*`, `test_espejo`, `test_numeracion`, `test_tecnica`, `test_revisar`, `test_api` (comprueba
que existe el preset `amateur`: sigue), `test_fotos_maniqui`, `test_historial*`, `test_pwa` (sí exige meter
los ficheros nuevos al precache).

### 6.2 Los que hay que escribir

- **`tests/test_menu_navegador.py`** (Playwright, 390 y 1440):
  - **Toque**: clic en el asa → panel abierto, `aria-expanded="true"`; otro toque o «✕» → cerrado.
  - **Arrastre**: `mouse.down` sobre el asa, `move` 200 px a la izquierda en pasos, `up` → abierto; arrastre de
    40 px → no se abre; arrastre del panel hacia la derecha → se cierra. Con `touch` emulado, igual.
  - **Teclado**: Tab hasta el asa, Intro → abierto; Esc → cerrado.
  - **Foco**: al abrir está en el título del menú; al cerrar (por «✕», Esc, velo o arrastre) vuelve al asa;
    con el panel abierto, Tab no sale del panel.
  - **Borde**: la caja del asa está a ≥ 24 px del borde derecho e izquierdo a 390 y 1440.
  - **Solo en Entrenar**: no hay asa en `#aprende`, `#historial` ni `#perfil`, ni durante la sesión.
  - **Pista**: con `pistas.asa = false` aparece una vez y se guarda `true`; con `true` no; con
    `prefers-reduced-motion` no hay transformación (`emulate_media`).
  - **«Atrás»** (si D4 = sí): con el menú abierto, `go_back()` lo cierra y se queda en `#entrenar`.
- **Redirección**: `#ajustes/mis-combinaciones/nueva` acaba en `#entrenar/mis-combinaciones/nueva` y
  `history.length` no crece; `#ajustes` → Entrenar con el menú abierto en Ajustes.
- **Migración v9**: los casos de la sección 4 en `tests/js/almacen.test.mjs`, y en el navegador un almacén v8
  real que abre con lo mismo elegido.
- **General y Personalizada**: General no se puede editar y da 3×3 con lo fijo; la guardia de Ajustes cambia
  la General (zurdo = espejo); tocar algo de a) con General pasa a Personalizada (D3).
- **`?prueba`**: sin él no hay opción Prueba; con él sí, y elegirla no se guarda.
- **Foto**: recorte de una imagen 800 × 600 → 256 × 256 JPEG, < 60 KB; va en exportar y vuelve igual al
  importar; una foto mal formada en una copia se descarta.
- **Intro**: dura ≤ 1 s; el toque que la salta no pulsa Empezar; con `prefers-reduced-motion` no aparece.
- **Motor**: `peso_practicar` con un factor y el tope con 3 elegidos, en Python y en la equivalencia JS.
- **Perfil**: cabecera de Entrenar → `#perfil`; el cuestionario solo se ve tras «Repetir»; nombre y avatar
  salen en la cabecera.

---

## 7. Fases (cada una se revisa por separado; `pytest -q` en verde antes de cada commit)

| Fase | Contenido | Commits previstos |
|---|---|---|
| **R0. Motor: Practicar a un nivel** | Python (factor único, ignora `cuanto`, tope) + tests; port a JS + equivalencia; regenerar las huellas con Practicar. | 3: «Deja Practicar más en un solo nivel en el motor», «Porta Practicar más de un nivel a JS», «Regenera las huellas con Practicar más» |
| **R1. Almacén v9 y preferencias** | Migración 8 → 9 y `completar` (identidad, pistas, foto validada) con sus tests; `preferencias()` con `tipo`, `configGeneral()`, `?prueba`. La interfaz vieja sigue funcionando sobre la v9. | 2-3 |
| **R2. Rutas** | `#entrenar/mis-combinaciones` y las redirecciones desde `#ajustes…`; el creador se mueve de contenedor; tests de redirección y del creador. | 2 |
| **R3. Menú (vacío)** | `menu.js`: asa, panel, toque, arrastre, teclado, foco, Esc, «Atrás», borde; tests de 6.2. Todavía sin contenido. | 2 |
| **R4. Entrenar nuevo** | Cabecera, selector General / Personalizada, «Tu sesión», Empezar; secciones a), b) y c) dentro del menú; fuera `#vista-ajustes`, el engranaje y Perfil/Ajustes de la barra. Tests de Entrenar, mezcla y Ajustes adaptados. | 3-4 |
| **R5. Perfil, nombre y avatar** | Cuestionario detrás de «Repetir»; nombre y avatar/foto (`avatar.js`, `foto.js`) en Ajustes; cabecera y Perfil los enseñan; foto en la copia. | 2-3 |
| **R6. Intro y pista** | Hueco de la intro y pista del asa, con `prefers-reduced-motion`. | 1-2 |
| **R7. Gris neutro y cierre** | Tokens en gris + test de contraste; limpieza de CSS sin uso; herramientas de capturas; `CLAUDE.md`; capturas «después» a 390, 768 y 1440 en `.playwright-mcp/capturas/rediseno/despues/`. | 2-3 |

R0 y R1 no cambian nada visible, así que se pueden revisar y unir antes de tocar la interfaz.

---

## 8. Riesgos

1. **El «atrás» del creador** ya intercepta `hashchange` para preguntar si se descartan los cambios. Moverlo
   de ruta y añadir `#entrenar/menu` al historial del navegador son dos lógicas de «atrás» que pueden
   chocar. Se cubre con los tests del creador que ya existen (que siguen) y uno nuevo: menú → Mis
   combinaciones → editor → atrás ×3.
2. **Arrastre en iOS Safari**: `<dialog>` + `transform` + eventos de puntero tienen rarezas, como el scroll del
   cuerpo debajo y `touch-action`. Hay que probarlo en un iPhone real; Playwright solo emula.
3. **El asa tapa contenido en el móvil**: a 390 px, la pastilla (22 px) cae sobre el borde derecho de la
   tarjeta «Tu sesión» (se ve en el boceto). No tapa texto, pero es un elemento flotante encima (D5).
4. **Cambio de comportamiento en el sorteo**: con un solo factor, quien tenía «Bastante más» verá su
   movimiento algo menos (y quien tenía «Un poco», algo más). Se puede medir (sección 5), pero se notará.
5. **Foto y cuota**: copias de seguridad algo más grandes (~30 KB). Un navegador con poco espacio podría
   llenarse antes; ya existe el aviso.
6. **Historial con «General»**: al cambiar el nombre del preset `amateur`, las sesiones viejas se verán como
   «General · nivel …». Es lo esperado, pero cambia lo que se ve.
7. **Muchos tests de navegador a la vez** (R4). Por eso R3 crea el menú vacío antes de mover nada a él.
8. **La intro y la pista pueden tapar el primer clic de todos los tests de navegador** (y de las
   herramientas de capturas). En R6, una salida común: el `sessionStorage` de la intro y `pistas.asa = true`
   en los datos de prueba, o abrir con `prefers-reduced-motion`. Se decide antes de escribir la intro.

---

## 9. Dudas que tiene que decidir David

| # | Duda | Propuesta |
|---|---|---|
| D1 | **¿Qué lleva la General además de 3×3?** «No editable», pero ¿qué nivel, ritmo, mezcla, Practicar y Reacción? | 3×3:00 · descanso 1:00, **nivel el de `data/perfil.json` (hoy Básico)**, ritmo Constante, mezcla Ninguna, sin Practicar, sin Reacción. Voz, Nombrar y guardia, los de Ajustes. Así lo fijo vive en `data/`, no en el código. |
| D2 | Al migrar, quien tenía «Amateur 3×3» con elecciones propias (nivel 2, mezcla…): ¿Personalizada 3×3 o General? | **Personalizada 3×3**, para que al actualizar no le cambie la sesión. |
| D3 | Con General elegida, ¿qué pasa al tocar algo de «Personalizar sesión»? | **Pasa sola a Personalizada** y lo anuncia («Personalizada»). La otra opción es desactivar los controles con General, pero esconde por qué. |
| D4 | ¿Abrir el menú añade una entrada al historial (`#entrenar/menu`) para que el gesto «Atrás» lo cierre en vez de salir de la app? | **Sí**: es lo que se espera en Android. Cuesta un poco más de lógica de rutas (riesgo 1). |
| D5 | El asa a 390 px pisa ~22 px del borde de «Tu sesión». ¿Margen derecho extra en el móvil o se acepta? | **Se acepta** (no tapa texto). Si molesta, margen derecho de 56 px solo en «Tu sesión». |
| D6 | **«Todo en gris neutro»**: ¿gris oscuro (como ahora, pero sin rojo) o gris claro (como el boceto)? | **Gris oscuro**: se usa en el gimnasio, a 1-2 m y con poca luz, y `theme-color` y `color-scheme` siguen igual. El boceto es claro solo por ser un boceto. |
| D7 | Nombre y avatar: ¿se editan solo en Ajustes (menú) o también en Perfil? | **Solo en Ajustes**; Perfil los enseña con «Cambiar», que abre el menú en Ajustes. Una sola forma de editar. |
| D8 | Fecha de inicio y medidas (altura, peso, alcance): ¿siguen en Perfil? | **Sí**, junto al cuestionario: son de «quién eres», no del entreno. |
| D9 | Fotos de cabecera (WebP): Entrenar la pierde (la cabecera es el perfil). ¿Aprende e Historial las conservan? | **Conservarlas** hasta la fase visual; con el gris quedan algo raras, pero quitarlas es decisión de estilo. |
| D10 | Avatares predefinidos: ¿cuántos y en qué formato? | WebP cuadrados de 256 px, 6-8, con su autoría en `CREDITOS.md`. Hasta que lleguen, solo foto o inicial. |
| D11 | Practicar más: ¿se queda en 3 movimientos como máximo? | **Sí, 3**. Con ×3 y tope ×8, a partir de 3 el efecto de cada uno ya se diluye (sección 5); más no ayudaría. |
| D12 | ¿El asa también en el PC, o en el PC el menú se abre con un botón «Personalizar» visible? | **El mismo asa** (un solo componente y los mismos tests); en el PC no hay gesto «Atrás» que evitar. |
| D13 | ¿La intro sale en cada arranque o una vez por sesión del navegador? | **Una vez por arranque en frío** (`sessionStorage`): al volver de otra app no se repite. |
