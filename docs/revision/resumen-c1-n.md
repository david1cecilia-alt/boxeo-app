# Resumen: C1 y diagnóstico de N (2026-11-04)

Rama `creador-combinaciones`. C1 terminada sin interfaz; la fase N, solo diagnóstico y plan (sin código de N).
Detalle completo en [plan-creador.md](plan-creador.md) (secciones 0 y 5).

## C1 · Commits

| Commit | Qué |
|---|---|
| 759b8d5 | Plan: decisiones de David y fase N |
| d504fb6 | 1. Ventana de no repetir por identidad (`n` en la biblioteca), Python y JS. Huellas sha256 de los sorteos, coletillas y guiones de antes (`tests/fijos/igual_que_antes.json`) para blindar que nada cambie |
| 39bc706 | 2. Sorteo mezclado (`SorteoMezcla`, `SorteoGrupo`): moneda 20/35/50 % (`PROBABILIDAD_PROPIAS`), grupos, pesos de «Practicar más» por grupo, ventana `mín(5, n − 1)`, cobertura con la biblioteca (los golpes de las propias cuentan), «Solo las mías» con mínimo 3 |
| 07a25d7 | 3. Coletillas desde el sorteo mezclado; guiones con propias y Reacción en la equivalencia y en el silencio final |
| 1d26f6f | 4. `avisos_creador` / `avisosCreador` en `reglas`: sin golpes, igual que una de la biblioteca (con su nivel), igual que otra propia; `puede_guardar` y `motivo` (2-10 acciones, menos de 20 propias) |
| f3cdc86 | 5. Almacén v8: migración 7→8, `combinacionesPropias`, `perfil.sesion.mezcla`, saneado de copias, `anadirPropia` / `cambiarPropia` / `borrarPropia` |
| 0c9f4c1 | Plan: diagnóstico y plan de la fase N |

## Tests

- `pytest`: **952 pasan** (había 760).
- `node --test tests/js/*.test.mjs`: **218 pasan** (había 180).
- «Ninguna» da **exactamente** lo mismo que antes con la misma semilla: huellas de antes en Python y JS, también con
  propias guardadas, con una mezcla sin propias del nivel y con «Solo las mías» con menos de 3.
- Playwright (datos de prueba solo en el localStorage de ese Chromium): la app arranca sin errores de JS; un almacén v7
  pasa a v8 con sesiones, valoraciones y perfil intactos (Perfil muestra la altura y el Historial, la sesión); los 12
  guiones de `nuevoGuion` con «Ninguna» tienen la misma huella que antes; una sesión empieza y dicta.

## Cambios respecto al plan

1. **Coletillas con «Solo las mías» (decisión 4):** con solo propias cortas el test de silencio final **no pasa**, ni
   con 3 propias de 2-3 acciones (6,0 s, el máximo es 5,0): esas mismas propias son las combinaciones del asalto, están
   entre las recientes y la coletilla no puede repetirlas. Solución aplicada: primero todas las propias cortas y
   **detrás las de la biblioteca, solo de relleno**. Sin propias cortas, las de la biblioteca (como pediste). Así el
   test pasa sin excepciones (Python y JS, con guion y con el dictado).
2. **«Cortas de la biblioteca del nivel elegido»:** no existen en medio ni en avanzado (2-3 acciones es básico por
   definición). Se usan las coletillas de siempre (básico, 2-3 acciones).
3. Con la mezcla (poco/bastante/mucho), las coletillas llevan las propias cortas entre las de la biblioteca, con la
   misma moneda en cada puesto (la propuesta 10 del plan).
4. Se quitó el aviso «salida en medio» (decisión 3).
5. `nuevoGuion` y Entrenar no usan aún la mezcla: es C3. El almacén guarda la mezcla, pero la sesión de la app sigue
   en «Ninguna» hasta entonces.
6. Dos tests de navegador fijaban la versión 7 del almacén: ahora piden la 8.

## Fase N · Plan (ver plan-creador.md, 5.1-5.6)

- La numeración solo vive en el `numero` de `data/acciones.json`; `palabras_numero` ya llega a «doce». «Sin activar» =
  los `*_cuerpo` sin `numero` y un test que lo fija.
- Con solo poner el número: voz, pantalla, Historial (las sesiones antiguas salen con el número nuevo, sin migrar) y
  espejo zurdo ya funcionan.
- **Hay que arreglar tres cosas:** «Practicar más» (`movimiento()` convertiría «cuerpo» en 7-12), la voz deducida de
  sesiones viejas (votar solo con 1-6) y el balance de `biblioteca.py` (contar solo golpes a la cara).
- Cobertura en dos pasos: el paso 1 como hoy; en el paso 2, las que añaden un 7-12 que falte pesan ×2, sin filtrar.
- Commits previstos: biblioteca (18 nuevas al final, n 151-168) → números 7-12 → cobertura → Aprende y pantalla →
  capturas.

## Punto 3 · Golpes al cuerpo por nivel (combinaciones que lo llevan)

| Nivel | 7 | 8 | 9 | 10 | 11 | 12 | Faltan para 3 |
|---|---|---|---|---|---|---|---|
| Básico | 3 | 2 | 2 | 1 | 2 | 2 | 6 |
| Medio | 4 | 4 | 4 | 1 | 1 | 2 | 5 |
| Avanzado | 7 | 3 | 7 | 6 | 5 | 5 | 0 |

**6 nuevas por nivel bastan.** Probado en memoria con las reglas de `biblioteca.py`: las 18 candidatas pasan todas
(nombres R1-R5, balance a la cara en total y por nivel, ≥50 % con jab, máximo 5 dobles ganchos). Después, cada golpe al
cuerpo sale ≥3 veces en cada nivel. Margen justo: el 5 y el 6 de básico quedan en 13,6 % (mínimo 13), y los dobles
ganchos ya están al tope en los tres niveles. Simulación de la cobertura: con ×2, los seis al cuerpo salen en el
99-100 % de las sesiones «Amateur 3×3 min».

## Pendiente de decidir

- La notación de las 150 con golpes al cuerpo pasaría de «jab_cuerpo» a «7» (`n`, ids y nombres no cambian). ¿Vale?
- REVISAR CON ENTRENADOR: «diez» (crochet de derecha al cuerpo) frente al aviso «diez segundos».
- REVISAR CON ENTRENADOR: el peso ×2 del paso 2 y las 18 combinaciones nuevas.
- La solución de las coletillas de «Solo las mías» (cambio 1).
