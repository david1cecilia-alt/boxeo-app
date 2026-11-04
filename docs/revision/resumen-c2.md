# Resumen de C2 · Pantalla del creador en Ajustes

Rama `creador-combinaciones`, 2026-11-04. Sin push. Solo interfaz: no se han tocado el motor ni el almacén v8.

## Commits

| Commit | Qué |
|---|---|
| `8cf8e6f` | `atraparFoco` pasa a `vistas/dom.js` (lo comparten «Practicar más» y el creador). Lógica de vista sin DOM en `static/creador.js` (baldosas, fichas, estado del editor, «Al cuerpo» que se apaga solo, mínimo 2 / máximo 10, 20/20, anuncio, renumeración) con `tests/js/creador.test.mjs`. |
| `cada425` | Tarjeta «Mis combinaciones N/20» en Ajustes, subpágina `#ajustes/mis-combinaciones` con el listado (vacío, con combinaciones, 20/20) y borrar con confirmación. |
| `01079c6` | Editor (`/nueva`, `/editar/<id>`): tarjetas Golpes/Defensas/Salidas, baldosas, interruptor «Al cuerpo», tira de fichas, medidor y nivel en directo, «Quitar la última», Guardar. |
| `6d15d8d` | Avisos al guardar en un `<dialog>` («Volver a editar» / «Guardar igual»), «¿Descartar los cambios?» (enlace, pestañas y «atrás» del navegador) y `tests/test_creador_navegador.py`. |
| `e00321a` | Golpes en 3 columnas solo desde 1280 px y botones de los diálogos sin partir; test de palabras partidas; `herramientas/capturas_creador.py`. |
| (este) | Este resumen. |

## Tests

- Al empezar: 995 en pytest y 223 en node.
- Al terminar: **1014 en pytest** y **233 en `node --test tests/js/*.test.mjs`**, todo en verde.
- Nuevos: 10 de lógica (node) y 16 de navegador (Playwright, a 390 px y los de diseño también a 1024 y 1440).
  Cubren: tarjeta y vuelta con el foco; listado vacío; 20/20 («Añadir» no hace nada ni con clic, ni con Enter,
  ni escribiendo la ruta); editar un id que no existe; borrar (Esc no borra, renumera, foco a la siguiente);
  crear con el teclado («Al cuerpo» con Espacio, se apaga tras el golpe, Guardar con «Mínimo 2», «Añadido…»
  solo en `#estado`); quitar ficha o la última y adónde va el foco; 10 acciones; avisos (dos a la vez, foco
  atrapado con Tab y Mayús+Tab, Esc, «Volver a editar» no guarda, «Guardar igual» sí); biblioteca con su nivel y
  sin compararse consigo misma; descartar por el enlace, por el «atrás» y por una pestaña, sin entradas de más
  en el historial; nada se sale (375 px útiles a 390), toques ≥48 px y ninguna palabra partida.
- Los datos de prueba solo viven en el localStorage del Chromium de Playwright.

## Capturas

En `.playwright-mcp/capturas/` (no se versionan), `creador-<qué>-<ancho>.png` a 390, 1024 y 1440: `ajustes`,
`listado-vacio`, `listado-3`, `listado-20`, `editor-vacio`, `editor-cuerpo` («Al cuerpo» activo),
`editor-10`, `avisos` y `borrar`. Las he mirado todas. Al revisarlas salieron dos fallos que ya están
arreglados en `e00321a`: a 1024 los golpes en tres columnas partían palabras («croch / et»), y a 390 los
botones del diálogo de avisos se partían en dos líneas.

## Decisiones y cambios respecto al plan

1. **Desactivados con `aria-disabled`** (Guardar, «Quitar la última», baldosas a 10 y «Añadir» a 20/20): el
   clic y Enter no hacen nada, se ven apagados (opacidad 0,45, sin el efecto de pulsar) y `aria-describedby`
   apunta al motivo visible.
2. **Motivos:** «Mínimo 2», «Máximo 10 acciones» y «Ya tienes 20 combinaciones: borra alguna para crear otra.»
   están en `static/creador.js`. Del motor solo se usa `puede_guardar` (su `motivo` dice «Añade al menos 2
   acciones.»).
3. **Nada fijo a 390.** A ≥1024, la columna de la combinación queda fija al bajar.
4. **Salir con cambios:** cada entrada del historial lleva una marca de tiempo en `history.state`. Si se sale
   del editor con cambios, se vuelve a él adelante o atrás (`history.forward/back`, sin `pushState` ni
   `replaceState` de ruta), así que no se duplican entradas, y se pregunta. «Descartar» lleva adonde se quería
   ir: atrás si se fue atrás; si no, a la ruta pedida (al listado, atrás si se vino de él). El enlace
   «← Mis combinaciones» pregunta sin cambiar la URL. Además, `beforeunload` avisa si se recarga o se cierra
   la pestaña con cambios.
   - **Limitación:** si se sale con una pestaña (Historial…), al volver al editor queda una entrada «adelante»
     con esa pestaña hasta la siguiente navegación, que la sustituye. No crea bucles ni duplica el «atrás».
5. **Diálogos:** la respuesta se toma en el momento (botón, Esc con `cancel`, toque en el velo fuera de la
   caja), no en el evento `close`, que llega después: con el «atrás» repetido, el `close` de la vez anterior
   se comía la respuesta siguiente (lo pilló el test).
6. **Guardar** vuelve al listado sin dejar el editor en el historial (atrás si se vino del listado; si no, se
   sustituye) y deja el foco en «Editar» de la combinación guardada, con el anuncio «Guardada la combinación N.».
7. **Lector de pantalla:** las fichas del listado llevan el texto hablado («rueda derecha»); los chips del
   editor, «Quitar recto abajo, acción 2». El «Añadido…» va solo a la región `#estado` (`aria-live`).
8. **Texto de la tarjeta:** «Crea las tuyas y mézclalas con la biblioteca en Entrenar.» (el del boceto).
   Entrenar aún no las usa: es C3.

## Cosas a saber

- **`crypto.randomUUID` en las pruebas:** Playwright sirve la app desde `http://boxeo.local`. No es un
  contexto seguro, y ahí Chromium no tiene `randomUUID`: `anadirPropia` fallaba. En la web real (https o
  localhost) sí existe. No he tocado el almacén: el test y el script de capturas añaden uno equivalente con
  `add_init_script`. **Para C3:** si alguien abre la app desde una IP de la red local por http (p. ej., el
  móvil contra el PC), guardar una combinación fallaría. ¿Lo cubrimos en el almacén?
- **Un fallo intermitente** en una de cuatro pasadas completas de pytest: se paró en el puesto 594 (zona de
  `test_perfil_navegador.py`). No se repitió ni en cinco pasadas sueltas de ese fichero ni en tres pasadas
  completas más. No sé si viene de C2.
- Los golpes de las baldosas, fichas y textos salen solo de `data/acciones.json` (nombre corto, como en la
  sesión); un test lo compara con el JSON.
- «Escuchar» no está (C3).
