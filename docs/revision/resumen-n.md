# Resumen de la fase N · Golpes al cuerpo 7-12

Rama `creador-combinaciones`, 2026-11-04. Sin push.

## Commits

| Commit | Qué |
|---|---|
| `c3bcb31` | Biblioteca: 18 combinaciones nuevas al final (n 151-168, 6 por nivel), 56 por nivel, regla y test «cada golpe al cuerpo en ≥3 combinaciones de cada nivel», huella de las 150 de antes. Propuesta y `revisar.json` regenerados. |
| `b7a2d46` | `numero` 7-12 en `data/acciones.json` (fuera el test «sin activar»). Arreglos: `movimiento()` deja «cuerpo» (Python y JS), la voz deducida vota solo con 1-6 y el balance de `biblioteca.py` cuenta solo golpes a la cara. |
| `71b1952` | Cobertura en dos pasos (Python y JS), peso ×2 marcado REVISAR CON ENTRENADOR, con tests y equivalencia. |
| `1a38ae2` | Huellas de `igual_que_antes.json` regeneradas por la cobertura en dos pasos (commit propio). |
| `0d4a827` | Aprende: «1/7 Jab», «2/8 Recto»… en la lista y en la ficha; test de navegador del círculo con dos cifras. |
| `276a54a` | Aviso «diez segundos» → «Últimos diez segundos» (Python y JS), REVISAR CON ENTRENADOR. |
| `c244c8e` | Boceto del creador con 7-12, script de capturas y capturas del boceto. |
| (este) | Este resumen. |

## Tests

- Al empezar: 952 (pytest) y 218 (node).
- Al terminar: **995 en pytest y 223 en `node --test`**, todo en verde.

## Simulación (200 sesiones «Amateur 3×3 min» por nivel)

Con el sorteo de hoy y, para comparar, el de `b7a2d46` (168 combinaciones y números 7-12, pero la cobertura solo
del 1-6).

| Nivel | Dichas por sesión | Con los 6 al cuerpo: hoy | Sin el paso 2 | Con 1-6 en las 6 primeras | Media de combinaciones hasta tener el 1-6 | Dichas con golpe al cuerpo: hoy / sin paso 2 |
|---|---|---|---|---|---|---|
| Básico | 70 | **100 %** | 93 % | 100 % | 4,04 (igual) | 34,2 % / 31,9 % |
| Medio | 52 | **100 %** | 81 % | 100 % | 2,96 (igual) | 40,0 % / 37,1 % |
| Avanzado | 35 | **99,5 %** | 86,5 % | 100 % | 2,40 (igual) | 61,0 % / 58,6 % |

El 1-6 se cubre exactamente igual que antes (mismas cifras: el paso 1 no cambia). Veces por sesión de cada golpe al
cuerpo (7 · 8 · 9 · 10 · 11 · 12): básico 4,0 · 4,1 · 4,0 · 4,0 · 4,0 · 3,9; medio 3,8 · 4,9 · 3,8 · 3,1 · 3,0 · 3,0;
avanzado 5,1 · 2,8 · 5,7 · 5,3 · 3,9 · 3,1.

## Las 18 nuevas (todas REVISAR CON ENTRENADOR: técnica y nombre)

Golpes con su número de la app (7-12 al cuerpo); ED/EI esquiva derecha/izquierda, AD/AI rueda derecha/izquierda.

| n | Nivel | Acciones | Nombre |
|---|---|---|---|
| 151 | básico | 8 · 4 | recto al cuerpo y crochet |
| 152 | básico | 1 · 10 · 5 | jab, crochet al cuerpo y gancho |
| 153 | básico | ED · 10 · 6 | esquiva, crochet al cuerpo y gancho |
| 154 | básico | 1 · 9 · bloqueo | jab, crochet al cuerpo y bloqueo |
| 155 | básico | EI · 11 · 4 · bloqueo | esquiva, gancho al cuerpo, crochet y bloqueo |
| 156 | básico | paso atrás · 12 · 3 · ED | paso atrás, gancho al cuerpo, crochet y esquiva |
| 157 | medio | 1 · 10 · 5 · AD · 3 | jab, crochet al cuerpo, gancho, rueda y crochet |
| 158 | medio | 1 · 11 · 3 · bloqueo · 6 | jab, gancho al cuerpo, crochet, bloqueo y gancho |
| 159 | medio | ED · 10 · 5 · EI · 1 | esquiva, crochet al cuerpo, gancho, esquiva y jab |
| 160 | medio | 1 · 12 · 3 · flexión · 5 · paso atrás | jab, gancho al cuerpo, crochet, flexión, gancho y paso atrás |
| 161 | medio | ballesteo · 11 · 3 · AI · 5 | ballesteo, gancho al cuerpo, crochet, rueda y gancho |
| 162 | medio | parada · 1 · 8 · AD · 6 · bloqueo | parada, jab, recto al cuerpo, rueda, gancho y bloqueo |
| 163 | avanzado | 1 · 8 · 3 · 4 · AD · 5 · 4 | jab, recto al cuerpo, doble crochet, rueda, gancho y crochet |
| 164 | avanzado | 1 · 9 · 4 · ED · 6 · 3 · bloqueo | jab, crochet al cuerpo y crochet, esquiva, gancho-crochet y bloqueo |
| 165 | avanzado | ED · 11 · 4 · 1 · 10 · 5 · AI · 6 | esquiva, gancho al cuerpo, crochet-jab, crochet al cuerpo y rueda |
| 166 | avanzado | 1 · 7 · 6 · ED · 4 · flexión · 5 · paso atrás | jab arriba y abajo, gancho, esquiva, flexión y paso atrás |
| 167 | avanzado | bloqueo · 10 · 6 · AD · 1 · 5 · EI · 4 · paso lateral dcha. | bloqueo, crochet al cuerpo, gancho, rueda, esquiva y paso lateral |
| 168 | avanzado | parada · 1 · 9 · ED · 6 · AI · 5 · ballesteo · 4 | parada, jab, crochet al cuerpo, esquiva, rueda y ballesteo |

## Capturas

En `.playwright-mcp/capturas/` (no se versionan), a 390 y 1440: `numeros-sesion-*` (Medio en Números, «12 gancho
dcha. abajo»), `numeros-historial-*` (sesión v5 sin voz: «1 jab, 8 recto al cuerpo…»), `numeros-aprende-*` y
`boceto-creador-*`. Las del boceto, también en `docs/revision/`. No cambia nada de escritorio: sin capturas a 1024.

## Cambios respecto al plan y cosas a saber

1. **Huellas regeneradas tres veces, no una:** también en el commit de la biblioteca (cada nivel elige entre 56) y en
   el de los números (los guiones en Ambos y Números dicen ahora «ocho»…; los sorteos daban la misma huella), además
   del commit propio de la cobertura. En los dos primeros iban dentro para que pytest pasara en cada commit. El commit
   `71b1952`, solo, falla únicamente en las huellas (que pediste en un commit aparte).
2. **Nombres de las 12 nuevas de medio y avanzado:** el plan solo daba los de básico. Los he escrito yo con las
   reglas R1-R5 (los comprueba el script); van con la duda «técnica y nombre».
3. **Notación:** en `data/combinaciones.json` los golpes al cuerpo salen ya como 7-12. En
   `biblioteca-propuesta.md` siguen como «3 al cuerpo» (la leyenda dice que es el 9), porque esa frase entra en el
   texto de las dudas de `revisar.json` y su id depende del texto: cambiarla dejaría sin respuesta los puntos ya
   contestados.
4. **La app no tiene pantalla de biblioteca:** la biblioteca se ve en la sesión (círculo 7-12, test a 390 px:
   «10»-«12» caben en el círculo de 28 px) y en la notación de los datos.
5. **Practicar más:** el panel sigue diciendo «golpes al cuerpo» (sin «(7-12)», para que funcione igual).
6. **Aviso:** empezaba por «diez»; ahora «Últimos diez segundos». La voz tarda unos 2 s en decirlo y el guion le
   reserva 1,5 s (ya se quedaba corto con «diez segundos», unos 1,6 s); el dictado espera a la voz de verdad, así
   que no lo he tocado. **Decisión tuya:** subir `DURACION_AVISO` a 2 s cambiaría el reparto de los guiones.
7. Nuevos REVISAR CON ENTRENADOR en `revisar.json`: las 18 combinaciones, el peso ×2 y el texto del aviso (81 puntos).
