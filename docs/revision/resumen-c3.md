# Resumen de C3 · «Tus combinaciones» en Entrenar y «Escuchar» en el editor

Rama `creador-combinaciones`, 2026-11-04. Sin push y sin unir a main. El motor de C1 (`SorteoMezcla`) no se
ha tocado: solo se conecta.

## Commits

| Commit | Qué |
|---|---|
| `5212cd8` | `crearUuid()` en el almacén: `crypto.randomUUID` si existe; si no (http desde la red local), un UUID v4 con `getRandomValues`. Es el `crearId` por defecto. Tests en node (formato v4, 2000 sin repetir, bytes extremos, sin `randomUUID` se guardan propias y se migra una v0). Fuera el parche `add_init_script` del test y de las capturas del creador. |
| `3daead2` | `nuevoGuion(config, perfil, azar, propias)` crea un `SorteoMezcla` con `config.mezcla`; `preferencias()` devuelve `mezcla` (desconocida → «ninguna»). Equivalencia: guiones del propio `nuevoGuion` (con «Practicar más», «Mucho» y «Solo las mías», también sin cortas, zurdo y Reacción) comprobados en Python, silencio final incluido. |
| `6b0dc18` | Selector en Entrenar, `estadoMezcla()` en `static/ajustes.js`, resumen de «Tu sesión», README, `tests/test_mezcla_navegador.py` y `herramientas/capturas_mezcla.py`. |
| `916e271` | «Escuchar» en el editor (`escuchar()` en `static/creador.js`), con tests de lógica y de navegador y sus capturas. |
| (este) | Este resumen. |

## Cómo queda

- **Selector** debajo de Nivel: `0 % Ninguna · 20 % Poco · 35 % Bastante · 50 % Mucho` en una fila y
  `100 % Solo las mías` a todo el ancho debajo. Los porcentajes salen de `PROBABILIDAD_PROPIAS`. Se guarda
  al momento en `perfil.sesion.mezcla`, como el resto de Entrenar.
- **Sin propias:** el grupo está desactivado (`<fieldset disabled>`) y la nota dice «Aún no tienes
  combinaciones propias. Crea la primera y mézclala con la biblioteca.», con el enlace a
  `#ajustes/mis-combinaciones/nueva`.
- **Con 1-2:** «Solo las mías» está desactivada y la nota dice «… necesita al menos 3 combinaciones (tienes 2).».
  Si estaba guardada así (porque se borraron propias), se respeta, la nota añade «de momento salen las de la
  biblioteca» y el nivel cuenta (decisión 12).
- **Con «Solo las mías»** (y 3 o más): Nivel desactivado, con la nota «Con «Solo las mías» no cuenta el
  nivel: salen todas las tuyas.». El nivel guardado no se pierde. Si no hay ninguna propia de 2-3 acciones,
  sale el aviso de la decisión 4.
- **Poco/Bastante/Mucho sin propias del nivel:** «No tienes combinaciones de nivel medio: solo saldrán las de
  la biblioteca.».
- **«Tu sesión»** dice la mezcla efectiva: «Básico · Mucho de las tuyas · …» o «Solo las tuyas · …» (sin
  nivel). Con «Ninguna», o si la mezcla no se puede cumplir, no dice nada de la mezcla.
- Al volver a Entrenar se recalcula todo con las propias de ese momento (`mostrar` → `resumir`).
- **Historial:** nada nuevo. Las propias se guardan como el resto (`{asalto, texto, ids}`, con los ids ya en
  espejo en zurdo) y la valoración las rehace desde los ids.
- **«Escuchar»:** está en la caja de la combinación, bajo las fichas. Dice `textoHablado(ids, perfil.sesion.voz,
  false)` a la velocidad de Ajustes, en ortodoxo, como se ve en el editor. Pulsarlo otra vez vuelve a empezar.
  Con 0 acciones lleva `aria-disabled` y el motivo «Añade alguna acción para escucharla.». Al salir del
  editor se calla.

## Tests

- Al empezar: 1014 en pytest y 233 en node. Al terminar: **1028 en pytest** (dos pasadas completas, las dos
  en verde: 249 s y 213 s) y **244 en `node --test tests/js/*.test.mjs`**.
- Nuevos en node: respaldo del UUID (2), mezcla en `nuevoGuion` y `preferencias` (4), `estadoMezcla`,
  opciones y resumen (4), `escuchar` (1).
- Nuevo en la equivalencia: 60 guiones de `nuevoGuion` con invariantes, «Solo las mías» solo dice propias en
  las combinaciones y silencio final ≤ 5 s.
- Nuevos en el navegador (`tests/test_mezcla_navegador.py`, 13):
  - estados con 0, 2 y 5 propias, con el teclado (las flechas se saltan la desactivada); que se recuerda al
    recargar; crear una en Ajustes activa el selector; toques de 48 px o más y nada se sale a 390;
  - una **sesión entera** «Prueba 2×30 s» con «Solo las mías», en zurdo y Ambos. Usa el reloj falso de
    Playwright (`page.clock`) y una `speechSynthesis` falsa que apunta lo que se dice. Comprueba que las
    propias salen en espejo y se dicen con `textoHablado` (nunca con un nombre), que lo dicho por la voz es
    lo guardado, la velocidad, las dos claves `{asalto, texto, ids}` y que la valoración las lista;
  - «Escuchar» en los tres modos y las tres velocidades, con Enter y Espacio, desactivado a 0 y que cabe a
    390, 1024 y 1440.
- **Fallo intermitente de `test_perfil_navegador.py`:** no ha vuelto en ninguna de las tres pasadas completas
  de esta sesión (contando la que hice antes de un commit), así que no he podido verlo fallar ni
  diagnosticarlo. Sigue sin saberse de dónde viene.

## Capturas

En `.playwright-mcp/capturas/` (no se versionan), `mezcla-<qué>-<ancho>.png` a 390, 1024 y 1440:
`sin-propias`, `2` (Bastante elegida, «Solo las mías» desactivada), `5-solo` (nivel desactivado),
`5-mucho-medio` (aviso sin propias de medio), `editor-vacio` y `editor-escuchar`. Se repiten con
`python herramientas/capturas_mezcla.py`. Las he mirado todas. Al revisarlas salió un fallo que ya está
arreglado: a 1024 los porcentajes a 32 px tocaban el borde de su botón. En escritorio van ahora a 24 px.

## Decisiones de David tras C3 (aplicadas)

1. **«Solo las mías»: el relleno es siempre propio si hay propias de 2-3 acciones.** Antes (C1, commit
   `07a25d7`) la biblioteca iba detrás de las propias cortas, y como una coletilla no repite ninguna de las 5
   últimas dichas, con pocas propias cortas se colaba la biblioteca. También antes del aviso de los 10 s:

   | Preset | 3 propias (2 cortas) | 5 propias (2 cortas) | 8 propias (6 cortas) |
   |---|---|---|---|
   | Amateur 3×3, antes | 1,9 % de la biblioteca | 4,9 % | 0,3 % |
   | Prueba 2×30 s, antes | 14,6 % | 21,4 % | 0,9 % |
   | **Ahora, los dos** | **0 %** | **0 %** | **0 %** |

   Cómo, igual en Python y JS:
   - Con «Solo las mías» (la efectiva) y alguna propia corta, `coletillas()` devuelve **solo** las propias
     cortas, y el sorteo marca `coletillas_repetibles` / `coletillasRepetibles` (`motor/sorteo.py`,
     `static/motor/sorteo.js`).
   - En `elegir_siguiente`, si ninguna coletilla fuera de la ventana cabe y son repetibles, vale una reciente:
     la primera que quepa y no sea la inmediatamente anterior. Si solo cabe la anterior, esa (mejor repetida
     que el silencio). El guion lo lee del sorteo. El dictado lo recibe de Entrenar (`repetirColetillas` en
     `static/ajustes.js`, `asalto({ repetibles })`).
   - Si no hay ninguna propia de 2-3 acciones, la biblioteca rellena como antes, y Entrenar lo avisa.
   - Con Ninguna, Poco, Bastante y Mucho la marca es falsa y no cambia nada. `test_igual_que_antes` sigue
     en verde con las mismas huellas.

   Tests: `elegir_siguiente` con y sin repetibles (`tests/test_reservas.py`), la marca solo con «Solo las
   mías» y propias cortas (Python y JS), **0 % de biblioteca en 300 guiones «Prueba 2×30 s»** con 2 propias
   cortas (3 y 5 propias, con y sin Reacción, en `tests/test_mezcla.py`). En la equivalencia, 32 elecciones de
   `elegirSiguiente` exportadas de JS dan lo mismo en Python, y los guiones de `nuevoGuion` («Prueba» incluida)
   tienen el relleno propio. El silencio final (Python y la simulación de voz en JS) pasa con «Solo las mías»
   sin excepciones. La sesión entera en el navegador ahora exige que todo lo dicho sea propio.
   Tras el cambio: **1038 en pytest** (dos pasadas completas en verde, 149 s y 146 s) y **244 en node**. El
   fallo intermitente de `test_perfil_navegador.py` tampoco ha salido en estas dos.
2. **«Escuchar» sigue en ortodoxo**, como se ve en el editor.

Queda como estaba: los desactivados del selector usan `disabled` nativo (los radios desactivados no reciben el
foco), no `aria-disabled` como los botones de C2. Así las flechas del grupo funcionan como siempre, y el motivo
está escrito y en `aria-describedby` del grupo.

## Cambio posterior: interruptor en Entrenar y «Cuánto aparecen» en Ajustes (almacén v9)

El selector de cinco opciones de Entrenar se ha sustituido:

- **Entrenar**: un interruptor «Mis combinaciones» (sí/no), en `perfil.sesion.usarMisCombinaciones`. Se
  recuerda como el resto. Sin propias se ve desactivado con «Crea tus combinaciones en Ajustes»
  (enlace a `#ajustes/mis-combinaciones`), pero lo guardado no se toca: al crear alguna, vuelve como estaba.
- **Ajustes → Mis combinaciones**: «Cuánto aparecen» (Poco · Bastante · Mucho · Solo las mías, sin
  porcentajes), en `perfil.misCombinaciones.cuanto`. Por defecto, Bastante.
- **Migración v8 → v9**: «Ninguna» → apagado y Bastante; las demás → encendido con esa cantidad (se sortea
  igual). Las copias v8 se importan.
- El motor no cambia: Entrenar le pide `mezclaPedida(interruptor, cuanto)` («ninguna» si está apagado).
- Capturas: `python herramientas/capturas_mezcla.py` (ya no saca las del editor, que no han cambiado).
