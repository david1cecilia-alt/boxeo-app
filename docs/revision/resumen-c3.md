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

## Para decidir

1. **«Solo las mías» deja pasar coletillas de la biblioteca aunque haya propias cortas.** Es lo que hace C1
   (commit `07a25d7`: «con «Solo las mías», delante, con la biblioteca de relleno»): una coletilla no repite
   ninguna de las 5 últimas dichas, y con pocas propias cortas todas están recientes. Además, las coletillas
   también rellenan huecos **antes del aviso de los 10 s**, no solo al final. Lo pilló el test de la sesión
   entera. Medido con `nuevoGuion` (300 sesiones, nivel medio):

   | Preset | 3 propias (2 cortas) | 5 propias (2 cortas) | 8 propias (6 cortas) |
   |---|---|---|---|
   | Amateur 3×3 | 1,9 % de la biblioteca | 4,9 % | 0,3 % |
   | Prueba 2×30 s | 14,6 % | 21,4 % | 0,9 % |

   No lo he cambiado: es una regla del motor (Python, JS y el dictado) y C1 la decidió así para que el test de
   silencio final pase sin excepciones. Opciones: (a) dejarlo así y que el aviso diga también «con pocas de 2-3
   acciones»; (b) que en «Solo las mías» una propia corta pueda repetirse antes que tirar de la biblioteca
   (ventana de su grupo, `mín(5, n − 1)`, en vez de las 5 últimas), en Python y JS, con equivalencia y
   silencio final. Recomiendo la (b).
2. **«Escuchar» en ortodoxo.** Es como se ve en el editor. Si prefieres que siga el «Zurdo» de Entrenar, se
   cambia en una línea (`escuchar()`), pero entonces lo que se oye no cuadra con las fichas de la pantalla.
3. Los desactivados del selector usan `disabled` nativo (los radios desactivados no reciben el foco), no
   `aria-disabled` como los botones de C2. Así las flechas del grupo funcionan como siempre y el motivo
   está escrito y en `aria-describedby` del grupo.
