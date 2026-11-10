# Rama `respaldo-antes-de-limpiar` (27-10): qué hay y qué falta en main

Revisión hecha el 10-11-2026, solo lectura, contra `main` = 37d8b62. La rama no se ha tocado, ni
subido, ni borrado.

## Conclusión

**No se ha perdido nada del código.** Los 9 commits son la versión de antes de reescribir el historial
del 27-10. Los 9 están en `main` con otro hash, y 7 tienen el diff idéntico byte a byte (mismo
patch-id). Los otros 2 solo se distinguen en que, en `main`, los PNG originales de las fotos de fondo
no se llegaron a versionar nunca: esa era la limpieza.

Lo único que existe solo en esta rama son esos **8 PNG originales** (4,8 MB). Siguen en disco, iguales
byte a byte, en `static/imagenes/originales/` (fuera de git por `.gitignore`).

La base común es 88e416e. Desde ahí `main` lleva 191 commits más: parte del diseño de estos commits se
cambió o se quitó después, a propósito y con su migración del almacén (ver la última sección).

## Commit a commit

| Respaldo | En main | Estado | Qué se perdió |
|---|---|---|---|
| 2810756 Fotos de fondo en WebP, conversor, Inter 800, créditos | 057f8bf | **En parte, a propósito** | Solo los 8 PNG de `static/imagenes/originales/`. Las 8 WebP, la fuente Inter 800, `CREDITOS.md`, `convertir_imagenes.py`, el precache y su test son idénticos. |
| 57237bc Diseño nuevo en Entrenar y la sesión (tokens negro/rojo, cabecera con foto, chips…) | e9ad3b1 | Igual | Nada |
| 2913a39 Deja de versionar los PNG originales | 7f65b37 | Igual (sin el borrado) | Nada: en `main` los PNG nunca entraron, así que no hay nada que borrar. Mismo `.gitignore`, créditos, conversor y test. |
| eb15fd6 `nombre_corto` en las acciones | fe74186 | Igual | Nada |
| 412d847 Maniquí con piezas torneadas | d5cc877 | Igual | Nada |
| b8b649d Diseño nuevo en Historial y Perfil (cifras del mes, gráfico Asaltos/RPE…) | 2abf5d1 | Igual | Nada |
| b8ebed9 Anillo de foco solo con teclado | e10dd61 | Igual | Nada |
| 6a938c3 `nombre_corto` a 18 caracteres | be02067 | Igual | Nada |
| 4b3e7e7 «Mi estilo» con la migración v1→v2 | 86542a1 | Igual | Nada |

Cómo se ha comprobado: emparejando por mensaje de commit y comparando `git patch-id --stable`; en los
dos que no coinciden, con `git diff --stat` entre el commit y su pareja. Además, una pasada línea a
línea de lo que añade cada commit frente a `main` hoy: lo que no aparece tal cual se cambió en commits
posteriores de `main`, no se perdió.

## Capturas del diseño del 27-10

En `.playwright-mcp/capturas/rediseno/respaldo-27-10/` (fuera de git): Entrenar, Historial y Perfil a
390 y 1440 px, cada una como pantalla visible (`*-pantalla.png`) y página entera (`*-entera.png`).
Se sacaron con el sitio montado desde un worktree temporal (ya eliminado) y con datos de prueba solo en
el localStorage de Playwright: 14 sesiones en 5 semanas con RPE, perfil de ejemplo y dos focos. No
hubo errores de JS.

Lo que se ve:
- **Entrenar**: foto de cabecera (guante contra el saco), «LISTO PARA / EL ASALTO» en Anton con la
  segunda línea en rojo, chips de presets (Amateur 3×3 · Prueba 2×30 s · Personalizado), tarjeta con
  Nivel 1/2/3 en botones grandes, interruptores Zurdo y Reacción, botón rojo «Empezar» y la voz debajo.
  A 1440: menú lateral a la izquierda y «Tu sesión» con Empezar en una columna aparte.
- **Historial**: «Tu progreso» con tres cifras del mes (la primera en rojo), gráfico de barras por
  semana con la actual en rojo y el selector Asaltos/RPE, sesiones con bloque de fecha y la píldora de
  RPE, y la copia de seguridad al final.
- **Perfil**: «Tu estilo» con la tarjeta roja «Estilo provisional», preguntas en chips, focos de
  trabajo, deslizadores de «Qué te dicta la app», «Tus datos», notas y «Revisar con entrenador».

En la captura de página entera a 390 la barra inferior sale en medio porque es fija: es cosa de la
captura, no un fallo de la app.

## Archivos que no deberían ir a un repo público

- **PNG originales** (`static/imagenes/originales/*.png`, en 2810756 y borrados en 2913a39): según
  `CREDITOS.md` son imágenes generadas con IA por David para esta app. Las he mirado: personas
  anónimas de espaldas o en penumbra, guantes y sacos, sin marcas, logos ni texto. No tienen metadatos
  de texto (ni prompt, ni EXIF, ni C2PA). La licencia no es un problema, pero pesan 4,8 MB y no se
  usan: la limpieza que los sacó del historial era correcta. **Si algún día se sube esta rama, vuelven
  a entrar en el historial público.**
- **Datos personales**: ninguno. Todos los commits tienen como autor el correo noreply de GitHub. Los
  diffs no llevan correos, teléfonos ni rutas del equipo. El perfil y el historial siguen fuera del
  repo (almacén del navegador).
- **Referencias de diseño**: 2810756 añade `docs/referencias/` y `docs/diseño/` al `.gitignore`. Esas
  carpetas no están en ningún commit de la rama.

## Qué podría servir para el rediseño

Todo el diseño negro/rojo ya está en `main`, así que no hace falta copiar nada de esta rama. Para el
plan de la reorganización, como **propuestas** (se decidirán allí, no se copian):

1. **Presets en chips con «Personalizado»** (Entrenar, 57237bc): es el antecedente directo del
   selector General | Personalizada. `data/presets.json` es igual en las dos ramas (Amateur 3×3 y
   Prueba 2×30 s). Ni en `main` ni aquí hay un preset llamado «Rápida»: la única «Rápida» de la app
   es la velocidad de la voz (`NOMBRE_VELOCIDAD`). Lo más probable es que «quitar Rápida» sea quitar
   el chip «Prueba 2×30 s», pero hay que confirmarlo (y la prueba la usa `tests/` para sesiones cortas).
2. **Dos columnas a 1440** (configuración a la izquierda; «Tu sesión» y Empezar a la derecha): encaja
   con «Resumen de la sesión elegida y botón Empezar» y con la regla de escritorio ≥ 1024 px.
3. **Cabecera de Perfil con antetítulo de guardia y nivel** («Ortodoxo · nivel 2»): se parece a la
   cabecera nueva de Entrenar (avatar · nombre · estilo). Ojo: en `main` la guardia y el nivel ya se
   eligen en Entrenar (migración v6→v7).
4. **Lo que se quitó después a propósito, y no conviene recuperar**: los focos de trabajo (v4→v5), los
   deslizadores de pesos (v5→v6, sustituidos por «Practicar más»), las notas del entrenador y las
   revisiones (v6→v7), y la tarjeta «Estilo provisional» (sustituida por «Estilo recomendado» en
   9c87182).

## Qué hacer con la rama

Es un respaldo completo y redundante: su código está en `main` y sus PNG en disco. No hay que hacer
nada con ella. Si se quiere borrar algún día, antes conviene guardar los PNG fuera del repo.
