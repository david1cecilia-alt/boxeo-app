# Plan: creador de combinaciones (bloque 4)

Rama `creador-combinaciones`, sacada de main en 8e97330. Hoy solo diagnóstico y plan: no se ha tocado código.
Boceto del diseño: [boceto-creador.html](boceto-creador.html) (suelto, fuera de la app; capturas en
`.playwright-mcp/capturas/boceto-creador-{390,1440,avisos-390}.png`).

> Los documentos de contexto (`CONTEXTO-boxeo-app.md`, estado y hoja de ruta) están en claude.ai, no en el PC: lo
> necesario viene en las decisiones de abajo.

---

## 0. Decisiones de David (visto bueno al plan, 2026-11-04)

Sobre los choques de 1.8 (lo que aquí se decide manda sobre lo escrito más abajo):

1. **«Nombrar combinaciones»:** de acuerdo con 1.5. Solo un test que blinde que las propias nunca se nombran.
2. **Lista del creador:** nombre corto, como en la sesión; el texto hablado, para lectores de pantalla.
3. **Avisos:** se **quita** el de «salida en medio». Quedan tres: sin golpes, idéntica a una de la biblioteca (con
   su nivel) e idéntica a otra propia. Paso atrás sigue siendo defensa.
4. **Coletillas con «Solo las mías» sin propias de 2-3 acciones:** solo para las coletillas del final del asalto se
   usan las cortas de la biblioteca (las de siempre: 2-3 acciones, que por número de acciones son de básico).
   Entrenar avisará (C3): «Añade alguna de 2-3 acciones para que el final del asalto sea solo tuyo». El test de
   silencio final **no tiene excepciones** y pasa también con «Solo las mías».
5. **Ventana de no repetir** por identidad: `n` (biblioteca) o `id` (propias), en Python y JS. Primer commit de C1.
6. De acuerdo: ids `p-<randomUUID>`; «Guardar igual» / «Volver a editar»; «guardia ortodoxa»; los golpes de las
   propias cuentan como ya salidos para la cobertura; con «Solo las mías» y menos de 3 propias el sorteo usa
   «Ninguna» y Entrenar lo explica.
7. **Para C2:** el interruptor «Al cuerpo» cambia las baldosas de 1-6 a 7-12 (fase N) y se apaga solo después de
   añadir cada golpe. Los números se leen de `data/acciones.json`.

**C1 queda así** (commits, en este orden; Python y JS a la vez, con equivalencia en cada uno que toque el sorteo):

1. Ventana de no repetir por identidad (`n` / `id`).
2. Sorteo mezclado: moneda con p = 20/35/50 % (constante única); grupos propias del nivel / biblioteca del nivel;
   pesos de «Practicar más» dentro de cada grupo (nunca excluyen); ventana por grupo `mín(5, n − 1)`; cobertura con
   la biblioteca; sin propias del nivel → solo biblioteca; «Solo las mías»: ignora el nivel, sin cobertura, mínimo 3
   propias y, si hay menos, «Ninguna». «Ninguna» da **exactamente** lo mismo que hoy con la misma semilla (test).
3. Guion: reservas y coletillas desde el sorteo mezclado, con el caso 4. Reacción incluida.
4. Avisos del creador en el motor (Python y JS): dada una lista de ids, los avisos y si se puede guardar (2-10
   acciones, menos de 20 propias). Nivel con `nivel_de`.
5. Almacén v8: migración 7→8 (`combinacionesPropias: []`, mezcla «ninguna»); Exportar/Importar con las propias;
   importar copias v5, v6 y v7 (tests).

`nuevoGuion` y Entrenar no se tocan en C1 (es C3).

---


## 1. Diagnóstico

### 1.1 Almacén (`static/almacen.js`)

- **Valores por defecto:** `vacio()` → `{ version, sesiones, valoraciones, perfil: perfilPorDefecto() }`. Lo que se
  elige en Entrenar está en `perfil.sesion` (`sesionPorDefecto()`: voz, ritmo, asalto, nivel, zurdo, reaccion,
  personalizada). Al cargar, `migrar()` lleva los datos a la versión actual y `completar()` rellena lo que falte
  campo a campo (fusiona `basicos`, `estilo`, `sesion`, `voz`, `historial`; `practicar` solo si es array).
- **Migraciones:** `VERSION = 7`; `MIGRACIONES[n]` pasa de n a n+1 (0→1 ids aleatorios … 5→6 `practicar: []`,
  6→7 quita notas/revisiones y la guardia/nivel de «Tus datos»). `migrar()` las encadena y lanza `ErrorAlmacen` si
  la versión es mayor que la de la app.
- **Exportar/Importar:** `exportar()` → `{ app: "boxeo", version, exportado, datos }`. `importar()` solo comprueba
  `app === "boxeo"` y que `datos` sea objeto; la versión la valida `migrar()` sobre `copia.datos.version`. Por eso
  **importar una copia v5/v6/v7 ya funciona** en cuanto exista la migración 7→8: pasará por ella y saldrá con la
  lista vacía. Una copia v9 se rechaza con mensaje claro.
- **Dónde guardar lo nuevo:** `datos.combinacionesPropias` (al nivel de `sesiones`, no dentro de `perfil`: no es una
  preferencia y así `guardarPerfil` no la toca) y `perfil.sesion.mezcla` (Entrenar lo recuerda como el nivel, con
  `recordarSesion`).

### 1.2 Sorteo (`motor/sorteo.py` ⇄ `static/motor/sorteo.js`)

- **Filtro por nivel:** en el constructor, `self.combos = [c for c in biblioteca() if c.nivel == nivel]`.
- **Sorteo:** uniforme salvo pesos: `peso_practicar(acciones, practicar) * max(1, nuevos)` con `rng.choices` /
  `azar.elegirConPesos`. `peso_practicar` multiplica ×2/×4 por movimiento elegido, tope ×8; nunca da 0.
- **Cobertura 1-6:** `faltan = {1..6}`; `_candidatas()` se queda con las libres que añaden algún número que falte
  (si no hay ninguna, todas las libres) y además pesan ×(números nuevos).
- **Ventana:** `recientes`, las últimas `SIN_REPETIR = 5`. **Identifica cada combinación por igualdad:** en Python
  `c not in self.recientes` compara la dataclass `ComboBiblioteca` por valor (notación, nivel, acciones, nombre); en
  JS `includes` compara por referencia. Hoy da igual (la biblioteca no tiene dos iguales: comprobado), pero con
  propias duplicadas (se permiten con aviso) **Python y JS divergirían**. Hay que identificar por clave: `n` para la
  biblioteca (hoy `ComboBiblioteca` no lo carga: se añade) e `id` para las propias.
- **Coletillas:** biblioteca nivel 1 de 2-3 acciones, ordenadas al azar por peso (`u^(1/peso)`), sin tocar el estado.
- **guardar()/restaurar():** guardan `recientes` y `faltan` para sacar reservas sin dejar rastro.
- **Equivalencia:** `tests/test_equivalencia_js.py` + `tests/js/exportar.mjs`. No compara secuencias (cada motor
  tiene su PRNG) sino reglas, invariantes y proporciones con 5.000 muestras (tolerancia 5 puntos). Hay que ampliar:
  sorteo mezclado (proporción de propias ≈ p, ventana por grupo, cobertura), «solo las mías», coletillas mezcladas,
  guiones con propias, y que el espejo/`texto` de una propia sea igual en los dos motores.

### 1.3 «Al menos un golpe»: todo lo que lo da por hecho

Comprobado: ninguna combinación de la biblioteca carece de golpe, así que nada de esto se ha ejercitado nunca.

| Sitio | Qué hace | Con una propia sin golpes | Arreglo |
|---|---|---|---|
| `reglas.validar` / `_regla_tiene_golpe` (py+js) | Única regla: «no hay ningún golpe» | Es justo el aviso del creador | El creador usa `validar()` como fuente de ese aviso (no bloquea). Sin cambios en la regla. |
| `reglas.ultimo_golpe` (py+js) | Último golpe «para los pesos del perfil» | Devuelve `None` sin romper | **Nadie la llama** (código muerto desde la v6). No se toca; si quieres, commit aparte para quitarla. |
| `sorteo.numeros` / cobertura 1-6 | Números de los golpes | Conjunto vacío | En el grupo de propias no se filtra por cobertura (decisión tuya), así que no hay problema. Si se aplicara, una propia sin números nunca saldría mientras falten. |
| `sorteo.movimiento` / `peso_practicar` | Golpe → «1»-«6»/«cuerpo»; resto → familia | Funciona: pesa por defensas/salidas | Nada. |
| `texto_hablado` / `palabra_hablada` (voz Números/Nombres/Ambos) | Golpe con número → número; resto → `orden` o nombre | Dice las órdenes («bloqueo, parada, paso atrás»); las salidas (sin `orden`) por su nombre hablado | Nada. Test: una propia solo de defensas se dice igual en los tres modos. |
| `ritmo.duracion_estimada` | Estima por el texto | Funciona | Nada. |
| `pasos.pasosCombo` (pantalla de la sesión) | Tipo, número y nombre corto por paso | Pinta círculos de defensa/salida | Nada. |
| `pasos.vozDeSesion` (deducir la voz de sesiones viejas) | Solo vota con las que llevan golpe con número | Se ignora en la votación (ya previsto en el código) | Nada. Las sesiones nuevas guardan `voz`. |
| `pasos.combinacionesParaVer` (Historial, valoración) | Rehace el texto desde los ids | Funciona | Nada. |
| Guion (`temporizador`) | Usa `siguiente()`, `coletillas()`, `guardar/restaurar` | No mira golpes | Nada (ver 1.8 para coletillas en «solo las mías»). |
| Reacción | Solo añade señales; las combinaciones salen del mismo sorteo | — | Nada: con el sorteo mezclado la usa sola. |
| Historial / servidor (`ComboDictado`) | Guarda `{asalto, texto, ids}` sin validar golpes | Se guarda bien | Nada. |
| Valoración (`costosas`) | Índices de las dictadas | — | Nada. |

### 1.4 Espejo zurdo

Se aplica en un único sitio: `SorteoBiblioteca._combinacion()` (`espejo_combo` si `zurdo`), al final y sobre
acciones del catálogo. Sirve **tal cual** para las propias: son ids del catálogo en ortodoxo. `numero(accion, zurdo)`
lee el número del espejo, así que los números no cambian. El editor no mira el zurdo de Entrenar (la única vista
que lo mira hoy es «Practicar más», para el nombre de la mano).

### 1.5 «Nombrar combinaciones»

**Es el selector Números / Nombres / Ambos** (`index.html`, `MODOS_VOZ`): decide cómo se dice cada golpe. No dice el
nombre de la combinación: el `nombre` de la biblioteca («jab-recto») **no se dice ni se ve en ningún sitio** de la
sesión (`Evento.texto` = `texto_hablado(acciones, voz, zurdo)`). La regla «las propias nunca se nombran en el audio»
ya se cumple sola. Para blindarla: las propias salen con `origen: "propia"` y `nombre: None`, y un test comprueba
que el texto de cada evento de una propia es exactamente `texto_hablado(...)`.

### 1.6 Historial, postsesión y valoración

Nada depende del número de biblioteca (#n): las sesiones guardan `ids` y `texto`; la valoración, índices. Borrar o
editar una propia no rompe ninguna sesión pasada. Detalle: la sesión guarda `nivel` (el servidor lo exige 1-3); con
«solo las mías» el nivel no se usa, pero se guarda el elegido en Entrenar. El Historial hoy no lo muestra, así que no
engaña a nadie (ver choque 11).

### 1.7 Ajustes, Entrenar y router

- **Router** (`rutas.js`): `#vista/parametro`; la vista recibe `mostrar(parametro, { mismaVista })`. Ajustes hoy
  **ignora el parámetro** (`mostrar: pintar`). Aprende es el modelo de subpágina: `pintar(id, { mismaVista })` y, al
  navegar dentro de la vista, foco al título y scroll arriba. El «← Volver» de Ajustes recuerda la pestaña de origen
  (`vuelta`, ignora los hash que empiezan por `#ajustes`): ya sirve para volver de la subpágina.
- **Entrenar** (`vistas/entrenar.js`): lee `preferencias()` y guarda cada cambio con `recordar()`; el guion sale de
  `nuevoGuion(config, perfil, azar)` en `static/ajustes.js`, que crea el `SorteoBiblioteca`. Ahí entra el sorteo
  mezclado. `resumenElecciones` (línea «Medio · Vivo · Números») tendrá que mencionar la mezcla.
- **Panel de «Practicar más»** (`vistas/ajustes.js` + CSS `.huecos-practicar`, `dialog.hoja`, `.fichas`,
  `.segmentado`): tres huecos; uno vacío abre una hoja `<dialog>` con pestañas Golpes/Defensas/Salidas y fichas de
  texto. Accesible (foco atrapado, flechas en pestañas, Esc, foco de vuelta).
  - **Le sobra:** el modal para una elección de un toque (tapa la tarjeta que estás editando); las pestañas `tablist`
    cuando solo hay tres grupos; fichas de solo texto, todas iguales («1 jab» pesa lo mismo que «flexión»).
  - **Le falta:** jerarquía visual (el número del golpe es lo que se reconoce de un vistazo); el código de colores
    de la sesión (golpe rojo, defensa círculo, salida discontinua: `.paso-golpe/.paso-defensa/.paso-movimiento`);
    respuesta al tocar (`:active`); en PC, aprovechar el ancho (es la misma hoja centrada).
  - **Se puede compartir con el creador:** el código visual de los pasos (`.pasos i` / `.leyenda i`), las tarjetas
    de grupo, las baldosas de golpe con número grande, `atraparFoco`, el estilo de los botones. Es lo que C4
    llevaría a «Practicar más».

### 1.8 Choques con las decisiones (para que decidas)

1. **Documentos de contexto no encontrados** (arriba).
2. **«Nombrar combinaciones» no nombra combinaciones** (1.5): la regla de no nombrar las propias ya se cumple; solo
   añado el test. Ninguna acción tuya hace falta, salvo confirmarlo.
3. **Formato de la lista.** El ejemplo «Combinación N | 1-Jab | rueda derecha | 6-gancho de derecha» usa el nombre
   *hablado* y mayúscula; la regla dice *nombre corto / texto de pantalla* («jab», «rueda dcha.», «gancho dcha.»).
   **Propuesta:** nombre corto en minúscula, como en la sesión, con el número en el círculo rojo (boceto). Para
   lectores de pantalla, la lista lleva el texto plano «1 jab, rueda derecha, 6 gancho de derecha» (hablado).
4. **Los golpes al cuerpo no tienen número** (`acciones.json`): salen como «jab abajo», sin cifra.
5. **¿Qué es una «salida»?** En los datos, `tipo: "movimiento"`: paso lateral izq./dcha., pivote y cambio de
   ángulo. **«Paso atrás» es una defensa**, así que va en la tarjeta Defensas (como en «Practicar más») y no activa
   el aviso «salida en medio». Además, **11 de las 150 de la biblioteca ya llevan una salida en medio** (p. ej. #5,
   #6): el aviso es un criterio técnico → lo marco `# REVISAR CON ENTRENADOR`.
6. **«Aceptar / Denegar»:** propongo los textos «Guardar igual» / «Volver a editar» (mismo significado, se entiende
   sin leer la pregunta). Si prefieres los literales, se cambian.
7. **«Guardia diestra»:** la app dice «ortodoxa» en todas partes. Propongo «Se crean para guardia ortodoxa; en zurdo
   la app las cambia de lado, como al resto».
8. **Id `p-<marca>`:** `CLAUDE.md` pide `crypto.randomUUID()` para lo local. Propongo `p-<randomUUID>` (una marca de
   tiempo puede repetirse al importar o en dos pestañas). La fecha ya va en `creada`.
9. **Coletillas con «Solo las mías».** Las coletillas son de 2-3 acciones para rellenar el final del asalto. Si
   ninguna propia tiene 2-3 acciones, no hay coletillas y el silencio final puede pasar del límite que comprueba
   `tests/test_silencio_final.py`. **Propuesta:** coletillas = propias de 2-3 acciones; si no hay, ninguna, y ese
   test se aplica solo cuando hay coletillas (Entrenar avisa: «Sin combinaciones de 2-3 acciones, el final de cada
   asalto puede quedar en silencio»). Alternativa: usar las de la biblioteca solo para rellenar.
10. **Coletillas en la mezcla:** propongo una lista con la misma moneda posición a posición (p: siguiente propia corta
    en su orden ponderado; si no, siguiente de la biblioteca), así la proporción también se cumple al final.
11. **Cobertura 1-6 en la mezcla:** solo filtra el grupo biblioteca. ¿Los golpes de una propia que sale cuentan como
    cubiertos? **Propuesta: sí** (se han dicho). Con «solo las mías», desactivada.
12. **`mezcla = "solo"` con menos de 3 propias** (porque se borraron) o con 0 propias: el valor guardado no se
    cambia, pero el sorteo usa «ninguna» y Entrenar lo explica en la nota. Al volver a tener 3, vuelve sola.
13. **Copia importada con más de 20 propias o ids desconocidos:** `completar()` descarta las entradas que no sean
    válidas (ids fuera del catálogo, longitud fuera de 2-10) y se queda con las 20 primeras.
14. **Nivel guardado con «solo las mías»:** se guarda el de Entrenar (el servidor exige 1-3). Si algún día el
    Historial muestra el nivel, habrá que guardar también la mezcla (columna nueva en SQLite): fuera de este bloque.
15. **API `/api/guion`:** el guion lo genera siempre el JS, así que la API no cambia. El sorteo mezclado se escribe
    primero en Python (referencia + tests), pero sin endpoint nuevo.

---

## 2. Diseño propuesto

Ver el boceto. Resumen:

- **Entrada en Ajustes:** tarjeta-enlace «Mis combinaciones 3/20» con una línea de explicación y «›». Abre
  `#ajustes/mis-combinaciones`.
- **Listado:** cada combinación es una tarjeta con «Combinación N» (titular Anton), pastilla de nivel y dos botones
  de icono de 48 px (editar, borrar con confirmación en `<dialog>`). Debajo, la secuencia con **el mismo código que
  la pantalla de la sesión**: golpe = círculo rojo con su número, defensa = círculo con borde, salida = círculo
  discontinuo. «+ Añadir combinación» es un hueco discontinuo grande al final (desactivado a 20/20 con el motivo).
  Lista vacía: texto que explica para qué sirve y el botón.
- **Editor (`#ajustes/mis-combinaciones/nueva` y `/editar/<id>`):**
  - **Caja de la combinación, fija arriba al bajar:** medidor de nivel de 10 segmentos (uno por acción) con las
    zonas Básico 2-4 · Medio 5-6 · Avanzado 7-10 marcadas, contador «5 de 10 acciones» y el nivel en grande; debajo,
    la tira de chips (tocar uno lo quita, con «×» visible) y la línea de la guardia ortodoxa.
  - **Tres tarjetas grandes** Golpes / Defensas / Salidas con icono (`aria-expanded`); la elegida se ve en blanco.
    Su paleta aparece debajo, en la página (sin modal).
  - **Golpes:** seis baldosas de 72 px con el número enorme en rojo (Anton) y el nombre corto; un interruptor «Al
    cuerpo» cambia las seis a sus versiones al cuerpo (sin número). Así son 6 baldosas y no 12.
  - **Defensas / Salidas:** baldosas de 56 px en dos columnas (las salidas con borde discontinuo, como en la sesión).
  - **Barra de acciones fija abajo:** «Quitar la última» y «Guardar». Guardar no se desactiva en silencio: con menos
    de 2 acciones o 20/20 lleva `aria-disabled` y debajo dice por qué. A 10 acciones, las baldosas avisan «máximo».
  - **Avisos:** `<dialog>` «Antes de guardar» con todos los avisos a la vez, cada uno en su franja ámbar (`--aviso`),
    y los botones «Volver a editar» (foco inicial) / «Guardar igual».
  - **Escritorio (≥1024):** dos columnas: paletas a la izquierda (golpes en 3 columnas), caja de la combinación +
    Guardar fijas a la derecha. Ancho máximo como el resto de Ajustes.
- **Movimiento:** solo transform/opacity: `:active` a `scale(.97)` (140 ms), chip nuevo que entra de `scale(.9)` y
  opacidad 0 (180 ms, ease-out fuerte); nada al usar el teclado y nada con `prefers-reduced-motion`.
- **Accesibilidad:** todo son `<button>` nativos con nombre («Quitar rueda dcha.», «Editar combinación 2»); toques
  ≥48 px; `role="status"` anuncia «Añadido jab. 3 acciones, básico.»; al quitar un chip el foco pasa al siguiente
  (o a «Quitar la última»); al abrir el editor, foco al título; el diálogo devuelve el foco a «Guardar»; colores con
  contraste AA comprobado en `tests/js/contraste.test.mjs` (las parejas nuevas se añaden ahí).

**Qué tiene de mejor frente a «Practicar más»:**

1. **Sin modal:** la paleta está en la página y la combinación siempre a la vista; en «Practicar más» la hoja tapa lo
   que estás editando.
2. **Jerarquía:** el número del golpe es lo primero que se ve (como se reconoce en el gimnasio), no una ficha de
   texto más.
3. **Mismo lenguaje visual que la sesión:** lo que creas se ve igual que lo que verás al entrenar.
4. **Respuesta en directo:** nivel, contador y anuncio para lectores de pantalla en cada toque; el motivo de que
   Guardar no se pueda pulsar está escrito.
5. **Menos ruido:** interruptor «Al cuerpo» en vez de 12 baldosas; tarjetas en vez de `tablist` (más simple con
   teclado: Tab y Enter).
6. **Escritorio de verdad:** dos columnas con la combinación fija, no una hoja centrada.

---

## 3. Fases

Cada fase acaba con `.venv\Scripts\python -m pytest -q` en verde, capturas y **parada** para tu visto bueno.
Commits pequeños en español, autor con el correo noreply, sin atribución y sin push.

### C1 · Motor y almacén (Python + JS + migración v8 + tests)

**Ficheros:** `motor/acciones.py`, `motor/sorteo.py`, `motor/temporizador.py` (solo si hace falta para coletillas),
`static/motor/acciones.js`, `static/motor/sorteo.js`, `static/motor/temporizador.js`, `static/almacen.js`,
`static/ajustes.js` (`nuevoGuion`, `preferencias`), `tests/test_sorteo.py`, `tests/test_equivalencia_js.py`,
`tests/js/exportar.mjs`, `tests/js/almacen.test.mjs`, `tests/js/ajustes.test.mjs`, `tests/test_silencio_final.py`
(si se acepta el choque 9), `CLAUDE.md` (una línea de arquitectura).

**Diseño del motor:**
- `ComboBiblioteca` gana `n`; la ventana pasa a identificar por clave (`n` / `id`). Sin cambio de comportamiento:
  commit propio con su test (dos propias iguales no se confunden en la ventana, en Python y JS).
- `motor/sorteo.py`: constantes `PROBABILIDAD_PROPIAS = {"poco": 0.20, "bastante": 0.35, "mucho": 0.50}` y
  `MIN_SOLO_PROPIAS = 3`; `propias_validas(propias)` (ids del catálogo, 2-10 acciones); `SorteoMezcla(nivel, perfil,
  zurdo, rng, propias, mezcla)` con dos grupos internos (biblioteca del nivel, propias del nivel; en «solo» todas
  las propias), cada uno con su ventana `min(5, n − 1)`; moneda `rng.random() < p` por sorteo; pesos de «Practicar
  más» dentro de cada grupo; cobertura solo en biblioteca. `siguiente()`, `coletillas()`, `guardar()`, `restaurar()`
  con la misma interfaz que `SorteoBiblioteca`, para que el guion, las reservas y Reacción no cambien. Las propias
  salen con `origen="propia"`, `nombre=None`. Funciones auxiliares para Entrenar: `mezcla_efectiva(mezcla, propias,
  nivel)` y el motivo del aviso (sin propias de ese nivel / menos de 3).
- Aviso del creador en el motor (`motor/reglas.py`): `avisos_creador(ids, propias, indice_editando)` → lista de
  `{tipo, texto}`: sin golpe (de `validar`), igual a una de la biblioteca (con su nivel), igual a otra propia, salida
  en medio (`# REVISAR CON ENTRENADOR`) — **quitado** (decisión 3). Y `puede_guardar(n_acciones, n_propias)` (2-10 y ≤20).
- Port fiel a JS de todo lo anterior.

**Almacén:** `VERSION = 8`; migración 7→8: `combinacionesPropias: []` y `perfil.sesion.mezcla = "ninguna"`;
`vacio()` y `sesionPorDefecto()` las incluyen; `completar()` sanea la lista (choque 13). Métodos `anadirPropia(ids)`
→ `{ id: "p-<uuid>", ids, creada }`, `cambiarPropia(id, ids)`, `borrarPropia(id)`; `exportar/importar` sin cambios
(ya copian todo `datos`).

**Commits previstos:**
1. Identifica las combinaciones de la ventana por clave (`n` en la biblioteca) en Python y JS.
2. Añade el sorteo mezclado con combinaciones propias en Python (con tests).
3. Porta el sorteo mezclado a JS y amplía los tests de equivalencia.
4. Añade los avisos del creador y `puede_guardar` en Python y JS.
5. Sube el almacén a v8 con las combinaciones propias y la mezcla (migración y tests).
6. Usa el sorteo mezclado en `nuevoGuion` y en las preferencias de Entrenar.

**Tests nuevos:** proporción de propias ≈ 20/35/50 % (±5 puntos, 5.000 muestras) en los dos motores; sin propias del
nivel → 0 %; «solo» → 100 % y de todos los niveles; ventana por grupo `min(5, n−1)` (con 1, 2, 6 propias); pesos de
«Practicar más» dentro de cada grupo; cobertura 1-6 de la biblioteca intacta en la mezcla; zurdo: una propia sale en
espejo y con los mismos números; texto de una propia = `texto_hablado` (nunca su nombre); propia sin golpes en los
tres modos de voz; guiones con propias cumplen los invariantes (reservas y coletillas incluidas, con Reacción);
reproducible con semilla; migración 7→8; importar copias v5, v6, v7 → lista vacía y `mezcla: "ninguna"`; copia v8
saneada; avisos (cada uno y varios juntos).

**Riesgos:** romper la equivalencia por el cambio de identificación de la ventana (por eso va solo en el commit 1);
la moneda cambia el consumo del azar y por tanto los guiones con semilla de tests que comparan valores exactos
(con «ninguna» no se tira moneda, para que lo de hoy salga idéntico); coletillas en «solo» (choque 9).

### C2 · Pantalla del creador en Ajustes

**Ficheros:** `static/vistas/ajustes.js` (entrada + `mostrar(parametro)`), nuevo `static/vistas/creador.js`
(listado, editor, avisos, borrar), `static/index.html` (diálogos si hace falta), `static/estilos.css` (bloque
«Mis combinaciones», reutilizando `.pasos i`), `static/sw.js` (precache de `vistas/creador.js`, lo pide
`tests/test_pwa.py`), `tests/js/contraste.test.mjs`, nuevo `tests/test_creador_navegador.py`, nuevo
`herramientas/capturas_creador.py`, `README.md`.

**Commits previstos:**
1. Añade la subpágina `#ajustes/mis-combinaciones` con el listado y la entrada en Ajustes.
2. Añade el editor con las tres tarjetas, la tira de chips y el nivel en directo.
3. Añade los avisos al guardar y la confirmación al borrar.
4. Ajusta el diseño de escritorio y añade las capturas del creador.

**Tests nuevos (navegador, Playwright):** crear, editar, borrar (con confirmación) y renumerar; Guardar bloqueado con
<2 y a 20/20 con su motivo; >10 no entra; cada aviso y varios juntos; «Volver a editar» no guarda, «Guardar igual»
sí; todo con teclado (Tab, Enter, Espacio, Esc) y foco donde toca; toques ≥48 px; contraste AA; «← Volver» desde la
subpágina y desde el editor; recarga de `#ajustes/mis-combinaciones/editar/<id>` inexistente → listado.

**Riesgos:** la caja fija arriba y la barra fija abajo comiéndose la pantalla a 390 con el teclado virtual (no hay
campos de texto, así que no debería salir); la navegación atrás del móvil dentro de Ajustes.

### C3 · Selector en Entrenar y prueba completa

**Ficheros:** `static/index.html` (fieldset «Tus combinaciones»), `static/vistas/entrenar.js`, `static/ajustes.js`
(`resumenElecciones`), `static/estilos.css`, `tests/test_sesion_navegador.py`, `tests/js/ajustes.test.mjs`,
`README.md`.

**Comportamiento:** el selector solo aparece con ≥1 propia; «Solo las mías» desactivada con <3 y con el motivo
escrito; con «solo», el selector de nivel se desactiva con una nota; si no hay propias del nivel elegido, nota «No
tienes combinaciones de nivel medio: solo saldrán las de la biblioteca»; se recuerda como el nivel.

**Commits previstos:**
1. Añade el selector «Tus combinaciones» en Entrenar y lo recuerda.
2. Desactiva el nivel con «Solo las mías» y avisa si no hay propias del nivel.
3. Prueba completa en el navegador: crear tres combinaciones, entrenar con «Solo las mías» y con «Mucho».

**Tests nuevos:** visibilidad y estados del selector; recordar la elección; sesión completa con propias (las
dictadas incluyen propias, en zurdo salen en espejo, se guardan en el historial y se pueden valorar); exportar e
importar con propias.

**Riesgos:** espacio en la tarjeta de configuración a 390 (ya lleva nivel, ritmo, voz e interruptores): el selector
irá como fila de chips desplazable o como `<details>`, según la captura.

### C4 · (Opcional, solo si lo apruebas tras ver C2) «Practicar más» con el diseño del creador

Sin cambiar cómo funciona (tres huecos, poco/bastante, máximo 3): cambiar la hoja modal por la paleta en la página
con las tarjetas de grupo y las baldosas de golpe con número. **Ficheros:** `static/vistas/ajustes.js`,
`static/estilos.css`, `herramientas/capturas_practicar.py`, tests de Ajustes en el navegador. **Riesgo:** los tests
de foco de la hoja actual se reescriben.

---

## 4. Capturas

En `.playwright-mcp/capturas/`, con datos de prueba solo en el `localStorage` del navegador de Playwright:

| Fase | Capturas | Anchos |
|---|---|---|
| C2 | Ajustes con la entrada (0/20 y 3/20); listado vacío, con 3 y con 20/20; editor vacío, con 5 acciones (golpes abiertos), con «Al cuerpo», con defensas y con salidas abiertas; diálogo con 1 y con 4 avisos; confirmación de borrar | 390 y 1440; editor y listado también a 1024 |
| C3 | Entrenar con el selector (sin propias = no sale; con 2 = «Solo las mías» desactivada; con «Solo las mías» = nivel desactivado; aviso sin propias del nivel); pantalla de la sesión dictando una propia | 390, 1024 y 1440 |
| C4 | «Practicar más» vacío, con 3 y la paleta abierta | 390, 1024 y 1440 |

Las capturas de cada fase se generan con un script de `herramientas/` (como `capturas_practicar.py`) para poder
repetirlas.

---

## 5. Fase N · Golpes al cuerpo 7-12

Decidido por David:

- **Numeración** (los ids internos no cambian): 7 jab al cuerpo · 8 recto al cuerpo · 9 crochet de izquierda al
  cuerpo · 10 crochet de derecha al cuerpo · 11 gancho de izquierda al cuerpo · 12 gancho de derecha al cuerpo. En
  zurdo el número no cambia, como el 1-6. En modo Números, «recto al cuerpo» se dice «ocho».
- **Sesión:** tienen que verse, aunque menos que el 1-6. Cobertura en dos pasos: primero 1-6, como ahora; cuando ya
  han salido, se buscan los 7-12 que falten a lo largo de la sesión. En «Solo las mías», sin cobertura.
- **Biblioteca:** no se editan las 150 que hay ni cambian sus `n`. Se **añaden** 6 por nivel (168 en total) con
  `herramientas/biblioteca.py`, para que cada golpe al cuerpo esté al menos 3 veces en cada nivel, cumpliendo: el
  balance de golpes a la cara (1 jab 20-30 %; 2-6 entre 13 y 17 %, en total y por nivel); ≥50 % de las que empiezan
  por golpe, con jab; máximo 5 dobles ganchos por nivel; las reglas de nombres R1-R5; el reparto de defensas lo más
  parecido posible al de ahora. Las nuevas, marcadas REVISAR CON ENTRENADOR en `revisar.json`.
- **Aprende:** los títulos de las 6 fichas de golpes llevan los dos números («1/7 Jab», «2/8 Recto»…). Las tarjetas
  flotantes van en otro bloque.

Diagnóstico y plan: 5.1 y siguientes (hecho tras C1; sin tocar código de N).

### 5.1 Diagnóstico

**Dónde vive hoy la numeración 1-6.** Solo en `data/acciones.json`: el campo `numero` de las seis acciones a la cara
(escrito en ortodoxo, por mano adelantada/trasera). Todo lo demás lo lee de ahí: `motor.acciones.numero(accion, zurdo)`
(el zurdo, del espejo) y su port `static/motor/acciones.js`. **«7-12 sin activar»** quiere decir: `palabras_numero` ya
llega a «doce», pero las seis `*_cuerpo` no llevan `numero`; la `_nota` dice «Los golpes al cuerpo (7-12) aún no llevan
número» y `tests/test_numeracion.py` lo fija («del 7 al 12 (cuerpo) aún no»). Los textos (`hablado`, `corto`; sin
`orden`, son golpes) están en `textos.<familia>.al_cuerpo` y **no cambian**. La regla impar = adelantada se cumple
también en 7-12 (7, 9 y 11 con la izquierda en ortodoxo).

**Qué cambia en cada sitio al poner `numero` 7-12:**

| Sitio | Qué pasa solo con el dato | Qué hay que hacer |
|---|---|---|
| Voz (`palabra_hablada`) | Números: «ocho»; Ambos: «ocho recto al cuerpo»; Nombres: igual que hoy | Nada en código. Tests de los tres modos y zurdo. **REVISAR CON ENTRENADOR:** «diez» (crochet de derecha al cuerpo) se parece al aviso «diez segundos». |
| Pantalla de la sesión (`pasos.pasosCombo`) | El círculo rojo lleva 7-12 | Comprobar a 390 px que «10», «11» y «12» caben en el círculo de 28 px (13 px de letra): test de navegador como `test_sesion_navegador.py`. |
| Historial y valoración (`combinacionesParaVer`) | El texto se rehace desde los ids: **las sesiones antiguas salen con el número nuevo** sin migrar | Nada; test con una sesión guardada en Números («uno, recto al cuerpo» → «1, 8»). |
| Voz deducida (`vozDeSesion`) | **Rompe:** vota con las combinaciones que llevan golpe con número; una antigua de solo cuerpo dicha en Números («jab al cuerpo, bloqueo») votaría «nombres» y la sesión quedaría en «ambos» | Votar solo con golpes 1-6 (los que tenían número cuando no se guardaba la voz). Test. |
| Espejo zurdo (`espejo`) | Ya sirve: compara sin `numero`, así que `gancho_izq_cuerpo` ↔ `gancho_der_cuerpo` (9 ↔ 10) y el jab al cuerpo del zurdo sigue siendo el 7 | Tests como los de 1-6, parametrizados con 7-12. |
| «Practicar más» (`movimiento`) | **Rompe:** `if accion.numero: return str(numero)` convertiría los golpes al cuerpo en «7»…«12»; desaparecería «cuerpo», que el almacén ya guarda y la hoja pinta aparte | Mirar antes el objetivo: golpe al cuerpo → «cuerpo», como hoy. Sin migración. El panel puede decir «golpes al cuerpo (7-12)». |
| Cobertura (`numeros`, `NUMEROS`) | `numeros()` devolverá también 7-12; el filtro del paso 1 sigue con 1-6 | Paso 2 (5.4). |
| `notacion()` (`combinaciones.json`, propuesta) | En la notación de las 150, los golpes al cuerpo pasan de su id («jab_cuerpo») a su número («7»); `n`, ids y nombres no cambian | Aceptarlo (la notación es derivada) y regenerar; si no, `notacion` escribe solo 1-6. **Decisión de David.** |
| `herramientas/biblioteca.py` | **Rompe el balance:** `porcentajes_cara` cuenta `a.numero` y metería los 7-12 en el % de golpes a la cara | Contar solo `objetivo == "cabeza"`. Bloque nuevo (5.5) al final, sin tocar `FAMILIAS` ni `SUELTAS`. |
| Fichas de Aprende | Títulos «Jab», «Recto»… (`data/tecnica.json`; las 6 fichas tienen el id del golpe a la cara) | `aprende.js` pone los dos números leídos de `acciones.json` (ficha `jab` → `jab` y `jab_cuerpo`): «1/7 Jab», «3/9 Crochet de izquierda». Sin cifras en `tecnica.json`. En ortodoxo, como la nota del zurdo. |
| Límite de 18 caracteres (`test_espejo`) | Los nombres cortos no cambian («croch. izq. abajo» = 17) | Nada: el número va en el círculo, no en el nombre. `test_ningun_nombre_lleva_numeros` sigue valiendo. |
| `biblioteca-propuesta.md` y `revisar.json` | Se regeneran | Las 18 nuevas, cada una con REVISAR CON ENTRENADOR; `herramientas/extraer_revisar.py`. |
| Equivalencia | `NUMEROS` y «golpe n» de 1 a 6 | Proporciones de 7-12, cobertura en dos pasos, `movimientos()` igual. |
| Tests que cuentan 50 | `test_biblioteca.py:53` (`{1: 50, 2: 50, 3: 50}`), `POR_NIVEL = 50` y `REPARTO` | 56 por nivel y `REPARTO` nuevo (5.3). Las huellas de `tests/fijos/igual_que_antes.json` se regeneran a propósito en el commit que cambie el sorteo. |

### 5.2 Cuántas veces sale hoy cada golpe al cuerpo (combinaciones que lo llevan)

| Nivel | 7 jab | 8 recto | 9 croch. izq. | 10 croch. dcha. | 11 gancho izq. | 12 gancho dcha. | Faltan para 3 |
|---|---|---|---|---|---|---|---|
| Básico | 3 | 2 | 2 | 1 | 2 | 2 | 6 (8, 9, 10×2, 11, 12) |
| Medio | 4 | 4 | 4 | 1 | 1 | 2 | 5 (10×2, 11×2, 12) |
| Avanzado | 7 | 3 | 7 | 6 | 5 | 5 | 0 |

**6 por nivel bastan.** Probado en memoria con las reglas de `biblioteca.py` (sin tocar el repo): las 18 de 5.5 pasan
**todas** (nombres R1-R5, sin repetidas, balance a la cara en total y por nivel, ≥50 % con jab, máximo 5 dobles ganchos,
que ya está al tope en los tres niveles: ninguna nueva lleva 5-6 o 6-5 seguidos). Resultado:

| Nivel | 7-12 | Cara 1 · 2 · 3 · 4 · 5 · 6 (%) | Empiezan con jab |
|---|---|---|---|
| Básico | 3 · 3 · 3 · 3 · 3 · 3 | 27,3 · 15,5 · 15,5 · 14,5 · 13,6 · 13,6 | 66 % |
| Medio | 4 · 5 · 4 · 3 · 3 · 3 | 25,4 · 14,7 · 15,8 · 14,7 · 14,7 · 14,7 | 78 % |
| Avanzado | 8 · 4 · 9 · 8 · 6 · 5 | 24,6 · 15,2 · 15,2 · 16,3 · 14,4 · 14,4 | 81 % |
| Total | — | 25,4 · 15,1 · 15,4 · 15,4 · 14,3 · 14,3 | 75 % |

Margen justo en básico: el 5 y el 6 quedan en 13,6 % (mínimo 13). Las nuevas de básico no deben llevar el 2 a la cara.

### 5.3 Reparto de defensas con 56

Las mismas proporciones que con 50: básico {0: 22, 1: 17, 2: 17}; medio {1: 22, 2: 23, 3: 11}; avanzado {1: 6, 2: 17,
3: 22, 4-5: 11}. Las nuevas: básico 2/2/2, medio 2/3/1, avanzado 1/2/2/1.

### 5.4 Cobertura en dos pasos

- **Paso 1** (como hoy): mientras falte algún 1-6, la biblioteca solo saca las que añaden alguno.
- **Paso 2:** con los 1-6 ya dichos, las que añaden algún 7-12 que falte **pesan ×2**, sin filtrar (por eso salen menos
  que el 1-6, «a lo largo de la sesión»). Un solo conjunto `faltan` de 1-12; `guardar`/`restaurar` no cambian.
- **Ventana:** va antes (las candidatas son las libres); el ×2 solo reordena entre ellas.
- **«Practicar más»:** se multiplica con el ×2; el tope de ×8 sigue siendo solo para «Practicar más».
- **Propias:** sus golpes 1-12 cuentan como dichos (ya lo hace `SorteoMezcla` con `numero()`). En «Solo las mías», sin
  cobertura.
- Simulación (biblioteca candidata de 56, «Amateur 3×3 min», 2.000 sesiones, las combinaciones por sesión del guion de
  hoy), % de sesiones con los seis al cuerpo:

| Nivel (dichas por sesión) | Sin paso 2 | ×2 | ×3 | Dichas con golpe al cuerpo (×2) |
|---|---|---|---|---|
| Básico (71) | 92 % | 100 % | 100 % | 34 % |
| Medio (52) | 85 % | 99 % | 100 % | 40 % |
| Avanzado (35) | 90 % | 99 % | 100 % | 61 % |

  ×2 basta y apenas sube los golpes al cuerpo (1-3 puntos). **REVISAR CON ENTRENADOR:** el peso ×2.

### 5.5 Las 18 nuevas (candidatas; n 151-168, al final de la biblioteca)

Básico: `2c-4` recto al cuerpo y crochet · `1-4c-5` jab, crochet al cuerpo y gancho · `ED-4c-6` esquiva, crochet al
cuerpo y gancho · `1-3c-B` jab, crochet al cuerpo y bloqueo · `EI-5c-4-B` esquiva, gancho al cuerpo, crochet y bloqueo ·
`PA-6c-3-ED` paso atrás, gancho al cuerpo, crochet y esquiva.

Medio: `1-4c-5-AD-3` · `1-5c-3-B-6` · `ED-4c-5-EI-1` · `1-6c-3-F-5-PA` · `BA-5c-3-AI-5` · `P-1-2c-AD-6-B`.

Avanzado: `1-2c-3-4-AD-5-4` · `1-3c-4-ED-6-3-B` · `ED-5c-4-1-4c-5-AI-6` · `1-1c-6-ED-4-F-5-PA` ·
`B-4c-6-AD-1-5-EI-4-LD` · `P-1-3c-ED-6-AI-5-BA-4`.

Todas REVISAR CON ENTRENADOR (técnica y nombres). `preparar()` numera familias y luego sueltas ordenadas por nivel: las
nuevas van en un bloque propio numerado detrás, para que ningún `n` de las 150 se mueva (test).

### 5.6 Commits previstos

1. `biblioteca.py`: el balance cuenta solo golpes a la cara; bloque al final con las 18; `POR_NIVEL = 56` y `REPARTO`
   nuevo; regenera `combinaciones.json`, la propuesta y `revisar.json`. Tests: los `n` 1-150 iguales (ids, nivel y
   nombre), 56 por nivel, cada golpe al cuerpo ≥3 por nivel.
2. `acciones.json`: `numero` 7-12 y `_nota`; `movimiento()` deja «cuerpo» (Python y JS); `vozDeSesion` vota con 1-6.
   Tests: numeración y zurdo 7-12, tres modos de voz («ocho»), `movimientos()` igual, Historial antiguo con el número
   nuevo, voz deducida de una sesión vieja de solo cuerpo.
3. Cobertura en dos pasos (Python y JS) con equivalencia; regenerar a propósito las huellas de
   `tests/fijos/igual_que_antes.json`. Tests: paso 1 igual que hoy, ≥95 % de sesiones con los seis al cuerpo en los tres
   niveles, mezcla y «Solo las mías».
4. Pantalla y Aprende: «1/7 Jab»… en las fichas; test de navegador de los números de dos cifras en el círculo a 390 px.
5. Capturas (sesión con un 10, ficha «3/9») y `README.md`.

**Decisiones pendientes de David:** notación con 7-12 en las 150 (5.1), «diez» frente a «diez segundos», el ×2.
