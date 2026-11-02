# Biblioteca nueva: propuesta para revisar

> **REVISAR CON ENTRENADOR: toda esta propuesta.** Las combinaciones, sus familias y variantes, los nombres y el
> reparto. Es una propuesta: `data/combinaciones.json` y el sorteo no cambian hasta que esté revisada.

## Cómo leerla

- Todo en guardia **ortodoxa** (el zurdo lo hace en espejo). Los golpes van por número: 1 jab, 2 recto, 3 crochet
  adelantado, 4 crochet trasero, 5 gancho adelantado, 6 gancho trasero; «3 al cuerpo» es el crochet adelantado al
  cuerpo. Las defensas y salidas, como las dice la app («esquiva abajo derecha»).
- **Nivel** = número total de acciones (golpes + defensas + salidas), calculado con `motor.reglas.nivel_de`:
  básico 2-4, medio 5-6, avanzado 7-10.
- **Defensa** = esquiva, esquiva abajo, ballesteo, flexión, bloqueo, parada y paso atrás. Pivote, paso lateral y
  cambio de ángulo son **salidas**: no cuentan como defensa, pero sí como acción.
- **Defensa en**: inicio (antes del primer golpe), entre golpes, o final (después del último golpe).
- **Papel**: *base* de la familia; *crece de #n* (la del nivel anterior más acciones, en el mismo orden);
  *variante de #n* (mismo nivel, cambia un lado, un golpe o la salida).
- **Respecto a la actual**: *se queda* (ya está en la biblioteca de hoy, igual), *cambia* (amplía una de hoy
  de 3 o más acciones) o *nueva*.

## Resumen

### Reparto de defensas por nivel

| Nivel | Combinaciones | Defensas | Hay | % real | % pedido | Desviación |
|---|---|---|---|---|---|---|
| básico | 30 | 0 | 12 | 40 % | 40 % | +0 |
| básico | 30 | 1 | 9 | 30 % | 30 % | +0 |
| básico | 30 | 2 | 9 | 30 % | 30 % | +0 |
| medio | 30 | 1 | 12 | 40 % | 40 % | +0 |
| medio | 30 | 2 | 12 | 40 % | 40 % | +0 |
| medio | 30 | 3 | 6 | 20 % | 20 % | +0 |
| avanzado | 30 | 1 | 3 | 10 % | 10 % | +0 |
| avanzado | 30 | 2 | 9 | 30 % | 30 % | +0 |
| avanzado | 30 | 3 | 12 | 40 % | 40 % | +0 |
| avanzado | 30 | 4-5 | 6 | 20 % | 20 % | +0 |

**Total: 90 combinaciones** (67 en 11 familias y 23 sueltas). Con 30 por nivel los porcentajes cuadran exactos: desviación 0 en todos.

### Cuántas hacen falta por nivel

| Nivel | Combinaciones | Se dicen por sesión Amateur 3×3 (mín · media · máx) | Veces que sale cada una (media) | Golpes del 1 al 6 |
|---|---|---|---|---|
| básico | 30 | 51 · 76 · 106 | 2,5 | todos |
| medio | 30 | 39 · 53 · 66 | 1,8 | todos |
| avanzado | 30 | 28 · 35 · 41 | 1,2 | todos |

Las cifras de la sesión salen de simular 60 sesiones Amateur por nivel (ritmos 1, 3 y 5) con estas
combinaciones, sorteando solo de su nivel y sin repetir ninguna de las 5 últimas.

**Mínimo que propongo: 25 por nivel; mejor 30.** Por qué:

- El sorteo no repite ninguna de las 5 últimas, así que con 25 siempre elige entre al menos 20.
- Donde más se repiten es en básico, porque sus combinaciones son cortas y caben más: unas 76 por sesión.
  Con 30, cada una sale de media 2,5 veces; con 25, 3,0; con 15, 5,1. A partir
  de 5 veces por sesión se hace repetitivo; 2-3 está bien, y repetir algo también es entrenarlo. En medio y
  avanzado (combinaciones más largas: unas 53 y 35 por sesión) 30 dan de sobra.
- Cada nivel tiene que tener todos los golpes del 1 al 6 (la sesión los dice en las 6 primeras) y los tipos del
  reparto de defensas: con menos de 25, algún tipo se queda en 2 combinaciones o menos (el avanzado con 1
  defensa ya tiene solo 3 con 30).
- Con 30 por nivel el reparto del entrenador cuadra exacto (10 % = 3 combinaciones).

### Vocabulario y lados

| Acción | Veces | | Acción | Veces |
|---|---|---|---|---|
| 1 | 54 | | esquiva izquierda | 21 |
| 2 | 128 | | esquiva abajo derecha | 21 |
| 3 | 100 | | esquiva abajo izquierda | 14 |
| 4 | 20 | | paso atrás | 12 |
| 5 | 6 | | bloqueo | 30 |
| 6 | 12 | | parada | 9 |
| 1 al cuerpo | 4 | | ballesteo | 16 |
| 2 al cuerpo | 2 | | flexión | 16 |
| 3 al cuerpo | 12 | | paso lateral izquierda | 2 |
| 4 al cuerpo | 2 | | paso lateral derecha | 3 |
| 5 al cuerpo | 1 | | pivote | 5 |
| 6 al cuerpo | 3 | | cambio de ángulo | 4 |
| esquiva derecha | 24 | |  |  |

Sin usar: ninguna.

## Familias

### F1. Crochet y esquiva abajo

El ejemplo del entrenador: jab, crochet, se esquiva abajo y se devuelve.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | jab, crochet y esquiva abajo | base | 1 · 3 · esquiva abajo derecha | 3 | 2 | 1 | — | final | básico | nueva |
| 2 | esquivando al otro lado | variante de #1 | 1 · 3 · esquiva abajo izquierda | 3 | 2 | 1 | — | final | básico | nueva |
| 3 | y devuelve gancho y crochet | crece de #1 | 1 · 3 · esquiva abajo derecha · 6 · 4 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 4 | devuelve 4-2 en vez de 6-4 | variante de #3 | 1 · 3 · esquiva abajo derecha · 4 · 2 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 5 | cambia de ángulo y crochet | crece de #3 | 1 · 3 · esquiva abajo derecha · 6 · 4 · cambio de ángulo · 3 | 7 | 5 | 1 | cambio de ángulo | entre golpes | avanzado | nueva |
| 6 | con 4-2 en vez de 6-4 | variante de #5 | 1 · 3 · esquiva abajo derecha · 4 · 2 · cambio de ángulo · 3 | 7 | 5 | 1 | cambio de ángulo | entre golpes | avanzado | nueva |
| 7 | sale con pivote | variante de #5 | 1 · 3 · esquiva abajo derecha · 6 · 4 · pivote · 3 | 7 | 5 | 1 | pivote | entre golpes | avanzado | nueva |

### F2. Jab-recto

La base de todo, a la que se le añaden esquivas laterales.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 | jab-recto | base | 1 · 2 | 2 | 2 | 0 | — | — | básico | se queda (antes básico) |
| 9 | jab-recto-crochet | variante de #8 | 1 · 2 · 3 | 3 | 3 | 0 | — | — | básico | se queda (antes básico) |
| 10 | esquiva y recto de contra | crece de #9 | 1 · 2 · 3 · esquiva derecha · 2 | 5 | 4 | 1 | — | entre golpes | medio | cambia: amplía «1-2-3-esquiva» |
| 11 | y vuelve a esquivar | variante de #10 | 1 · 2 · 3 · esquiva derecha · 2 · esquiva izquierda | 6 | 4 | 2 | — | entre golpes, final | medio | cambia: amplía «1-2-3-esquiva» |
| 12 | esquiva a los dos lados y gancho-recto | crece de #11 | 1 · 2 · 3 · esquiva derecha · 2 · esquiva izquierda · 5 · 2 | 8 | 6 | 2 | — | entre golpes | avanzado | cambia: amplía «1-2-3-esquiva» |
| 13 | acaba bloqueando | variante de #12 | 1 · 2 · 3 · esquiva derecha · 2 · esquiva izquierda · 3 · 2 · bloqueo | 9 | 6 | 3 | — | entre golpes, final | avanzado | cambia: amplía «1-2-3-esquiva» |

### F3. Ballesteo y contra

Se saca la cara hacia atrás y se contesta con el recto.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 14 | ballesteo y recto | base | ballesteo · 2 | 2 | 1 | 1 | — | inicio | básico | nueva |
| 15 | jab, ballesteo y recto | variante de #14 | 1 · ballesteo · 2 | 3 | 2 | 1 | — | entre golpes | básico | nueva |
| 16 | y sigue con crochet y recto | crece de #15 | 1 · ballesteo · 2 · 3 · 2 | 5 | 4 | 1 | — | entre golpes | medio | cambia: amplía «2-3-2» |
| 17 | con esquiva abajo y crochet | variante de #16 | ballesteo · 2 · 3 · esquiva abajo izquierda · 3 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 18 | esquiva abajo, crochet-recto y cambio de ángulo | crece de #16 | 1 · ballesteo · 2 · 3 · 2 · esquiva abajo izquierda · 3 · 2 · cambio de ángulo | 9 | 6 | 2 | cambio de ángulo | entre golpes | avanzado | cambia: amplía «2-3-2» |
| 19 | esquiva abajo a los dos lados | variante de #17 | ballesteo · 2 · 3 · esquiva abajo izquierda · 3 · esquiva abajo derecha · 4 · ballesteo · 2 | 9 | 5 | 4 | — | inicio, entre golpes | avanzado | nueva |

### F4. Parada y contra

Se para el jab con la derecha y se contesta.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 20 | parada y jab-recto | base | parada · 1 · 2 | 3 | 2 | 1 | — | inicio | básico | se queda (antes básico) |
| 21 | parada, recto-crochet y bloqueo | variante de #20 | parada · 2 · 3 · bloqueo | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 22 | esquiva y otro recto | crece de #20 | parada · 1 · 2 · esquiva derecha · 2 | 5 | 3 | 2 | — | inicio, entre golpes | medio | cambia: amplía «1-2-esquiva-2» |
| 23 | acaba bloqueando | variante de #22 | parada · 1 · 2 · esquiva derecha · 2 · bloqueo | 6 | 3 | 3 | — | inicio, entre golpes, final | medio | cambia: amplía «1-2-esquiva-2» |
| 24 | bloquea y devuelve | crece de #23 | parada · 1 · 2 · esquiva derecha · 2 · bloqueo · 3 · 2 | 8 | 5 | 3 | — | inicio, entre golpes | avanzado | cambia: amplía «1-2-esquiva-2» |
| 25 | y esquiva abajo con crochet | variante de #24 | parada · 1 · 2 · esquiva derecha · 2 · bloqueo · 3 · 2 · esquiva abajo izquierda · 3 | 10 | 6 | 4 | — | inicio, entre golpes | avanzado | cambia: amplía «1-2-esquiva-2» |

### F5. Abajo y arriba

Golpes al cuerpo para bajar la guardia del rival y subir a la cara.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 26 | jab al cuerpo y recto | base | 1 al cuerpo · 2 | 2 | 2 | 0 | — | — | básico | nueva |
| 27 | crochet abajo y arriba | variante de #26 | 2 · 3 al cuerpo · 3 | 3 | 3 | 0 | — | — | básico | nueva |
| 28 | flexión y crochet abajo y arriba | crece de #26 | 1 al cuerpo · 2 · flexión · 3 al cuerpo · 3 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 29 | con flexión y crochet-recto | variante de #27 | 2 · 3 al cuerpo · 3 · flexión · 3 · 2 | 6 | 5 | 1 | — | entre golpes | medio | nueva |
| 30 | esquiva abajo y crochet abajo y arriba | crece de #28 | 1 al cuerpo · 2 · flexión · 3 al cuerpo · 3 · 2 · esquiva abajo derecha · 4 al cuerpo · 4 | 9 | 7 | 2 | — | entre golpes | avanzado | nueva |
| 31 | bloquea, esquiva y pivota | variante de #30 | 1 al cuerpo · 2 · flexión · 3 al cuerpo · 3 · bloqueo · 2 · esquiva derecha · 2 · pivote | 10 | 6 | 3 | pivote | entre golpes | avanzado | nueva |

### F6. Esquiva a los dos lados

Esquiva lateral, se suelta y se vuelve a esquivar.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 32 | esquiva derecha, recto-crochet, esquiva izquierda | base | esquiva derecha · 2 · 3 · esquiva izquierda | 4 | 2 | 2 | — | inicio, final | básico | cambia: amplía «esquiva-2-3» |
| 33 | empezando por la izquierda | variante de #32 | esquiva izquierda · 3 · 2 · esquiva derecha | 4 | 2 | 2 | — | inicio, final | básico | cambia: amplía «esquiva-3-2» |
| 34 | y devuelve crochet-recto | crece de #32 | esquiva derecha · 2 · 3 · esquiva izquierda · 3 · 2 | 6 | 4 | 2 | — | inicio, entre golpes | medio | cambia: amplía «esquiva-2-3» |
| 35 | acaba bloqueando | variante de #33 | esquiva izquierda · 3 · 2 · esquiva derecha · 2 · bloqueo | 6 | 3 | 3 | — | inicio, entre golpes, final | medio | cambia: amplía «esquiva-3-2» |
| 36 | esquiva abajo y gancho-crochet | crece de #34 | esquiva derecha · 2 · 3 · esquiva izquierda · 3 · 2 · esquiva abajo derecha · 6 · 4 | 9 | 6 | 3 | — | inicio, entre golpes | avanzado | cambia: amplía «esquiva-2-3» |
| 37 | bloquea, devuelve y sale | variante de #35 | esquiva izquierda · 3 · 2 · esquiva derecha · 2 · bloqueo · 3 · 2 · paso lateral izquierda | 9 | 5 | 3 | paso lateral izquierda | inicio, entre golpes | avanzado | cambia: amplía «bloqueo-3-2-paso_lateral_izq» |

### F7. Bloqueo

Bloquear, devolver y, si toca, volver a bloquear.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 38 | bloqueo, crochet y recto | base | bloqueo · 3 · 2 | 3 | 2 | 1 | — | inicio | básico | se queda (antes básico) |
| 39 | y vuelve a bloquear | variante de #38 | bloqueo · 3 · 2 · bloqueo | 4 | 2 | 2 | — | inicio, final | básico | cambia: amplía «bloqueo-3-2» |
| 40 | jab-recto y bloqueo | variante de #38 | 1 · 2 · bloqueo | 3 | 2 | 1 | — | final | básico | nueva |
| 41 | con paso atrás y recto | crece de #38 | 1 · bloqueo · 3 · 2 · paso atrás · 2 | 6 | 4 | 2 | — | entre golpes | medio | cambia: amplía «bloqueo-3-2» |
| 42 | doble bloqueo y contra | variante de #41 | bloqueo · 3 · 2 · bloqueo · 3 · 2 | 6 | 4 | 2 | — | inicio, entre golpes | medio | cambia: amplía «bloqueo-3-2» |
| 43 | esquiva, recto y paso lateral | crece de #41 | 1 · bloqueo · 3 · 2 · paso atrás · 2 · esquiva derecha · 2 · paso lateral derecha | 9 | 5 | 3 | paso lateral derecha | entre golpes | avanzado | cambia: amplía «bloqueo-3-2» |
| 44 | esquiva y ballesteo | variante de #42 | bloqueo · 3 · 2 · bloqueo · 3 · 2 · esquiva izquierda · 3 · ballesteo · 2 | 10 | 6 | 4 | — | inicio, entre golpes | avanzado | cambia: amplía «bloqueo-3-2» |

### F8. Paso atrás y recto de contra

Se rompe la distancia y se contesta con la derecha.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 45 | paso atrás y recto | base | paso atrás · 2 | 2 | 1 | 1 | — | inicio | básico | se queda (antes básico) |
| 46 | paso atrás, jab-recto y paso atrás | variante de #45 | paso atrás · 1 · 2 · paso atrás | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 47 | jab-recto, paso atrás y recto-crochet | crece de #45 | 1 · 2 · paso atrás · 2 · 3 | 5 | 4 | 1 | — | entre golpes | medio | cambia: amplía «1-2-paso atrás-2» |
| 48 | y pivota | variante de #47 | 1 · 2 · paso atrás · 2 · 3 · pivote | 6 | 4 | 1 | pivote | entre golpes | medio | cambia: amplía «1-2-paso atrás-2» |
| 49 | flexión, crochet abajo y arriba y sale | crece de #47 | 1 · 2 · paso atrás · 2 · 3 · flexión · 3 al cuerpo · 3 · paso lateral derecha | 9 | 6 | 2 | paso lateral derecha | entre golpes | avanzado | cambia: amplía «1-2-paso atrás-2» |
| 50 | pivota, esquiva y recto | variante de #48 | 1 · 2 · paso atrás · 2 · 3 · pivote · esquiva derecha · 2 | 8 | 5 | 2 | pivote | entre golpes | avanzado | cambia: amplía «1-2-paso atrás-2» |

### F9. Gancho y crochet

Ganchos (5 y 6) en la corta, rematados con crochet.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 51 | gancho de derecha y crochet | base | 6 · 3 | 2 | 2 | 0 | — | — | básico | se queda (antes básico) |
| 52 | gancho de izquierda y recto | variante de #51 | 5 · 2 | 2 | 2 | 0 | — | — | básico | se queda (antes básico) |
| 53 | jab-recto, gancho-crochet y esquiva abajo | crece de #51 | 1 · 2 · 6 · 3 · esquiva abajo izquierda | 5 | 4 | 1 | — | final | medio | nueva |
| 54 | con esquiva abajo y crochet | variante de #52 | 1 · 5 · 2 · esquiva abajo derecha · 4 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 55 | devuelve gancho-crochet y esquiva | crece de #53 | 1 · 2 · 6 · 3 · esquiva abajo izquierda · 3 · 6 · 3 · esquiva izquierda | 9 | 7 | 2 | — | entre golpes, final | avanzado | cambia: amplía «3-6-3» |
| 56 | gancho al cuerpo y ballesteo | variante de #54 | 1 · 5 · 2 · esquiva abajo derecha · 5 al cuerpo · 4 · ballesteo · 2 | 8 | 6 | 2 | — | entre golpes | avanzado | nueva |

### F10. Doble jab

Doble jab para entrar, y lo que venga.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 57 | doble jab y recto | base | 1 · 1 · 2 | 3 | 3 | 0 | — | — | básico | se queda (antes básico) |
| 58 | doble jab, recto y crochet | variante de #57 | 1 · 1 · 2 · 3 | 4 | 4 | 0 | — | — | básico | se queda (antes medio) |
| 59 | esquiva y crochet | crece de #57 | 1 · 1 · 2 · esquiva izquierda · 3 | 5 | 4 | 1 | — | entre golpes | medio | cambia: amplía «1-1-2» |
| 60 | ballesteo y recto-crochet | variante de #59 | 1 · 1 · 2 · ballesteo · 2 · 3 | 6 | 5 | 1 | — | entre golpes | medio | cambia: amplía «1-1-2» |
| 61 | esquiva abajo y doble crochet | crece de #59 | 1 · 1 · 2 · esquiva izquierda · 3 · 2 · esquiva abajo derecha · 4 · 3 | 9 | 7 | 2 | — | entre golpes | avanzado | cambia: amplía «3-2-esquiva abajo-4-3» |
| 62 | bloquea y devuelve | variante de #60 | 1 · 1 · 2 · ballesteo · 2 · 3 · bloqueo · 3 · 2 | 9 | 7 | 2 | — | entre golpes | avanzado | cambia: amplía «1-1-2» |

### F11. Flexión y cuerpo

Se baja con flexión y se ataca al cuerpo.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 63 | flexión y crochet abajo y arriba | base | flexión · 3 al cuerpo · 3 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 64 | recto y bloqueo | crece de #63 | flexión · 3 al cuerpo · 3 · 2 · bloqueo | 5 | 3 | 2 | — | inicio, final | medio | nueva |
| 65 | esquiva abajo y doble crochet | variante de #64 | flexión · 3 al cuerpo · 3 · esquiva abajo derecha · 4 · 3 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 66 | gancho al cuerpo, crochet y esquiva | crece de #64 | flexión · 3 al cuerpo · 3 · 2 · bloqueo · 6 al cuerpo · 3 · esquiva izquierda | 8 | 5 | 3 | — | inicio, entre golpes, final | avanzado | nueva |
| 67 | otra flexión y recto | variante de #65 | flexión · 3 al cuerpo · 3 · esquiva abajo derecha · 4 · 3 · flexión · 2 | 8 | 5 | 3 | — | inicio, entre golpes | avanzado | nueva |

## Sueltas

### Básico

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 68 | recto, gancho de izquierda y recto | — | 2 · 5 · 2 | 3 | 3 | 0 | — | — | básico | se queda (antes medio) |
| 69 | jab, gancho-crochet y recto | — | 1 · 6 · 3 · 2 | 4 | 4 | 0 | — | — | básico | se queda (antes medio) |
| 70 | doble crochet y recto | — | 4 · 3 · 2 | 3 | 3 | 0 | — | — | básico | nueva |
| 71 | jab, gancho al cuerpo y crochet | — | 1 · 6 al cuerpo · 3 | 3 | 3 | 0 | — | — | básico | nueva |
| 72 | esquiva abajo y crochet a los dos lados | — | esquiva abajo izquierda · 3 · esquiva abajo derecha · 4 | 4 | 2 | 2 | — | inicio, entre golpes | básico | nueva |
| 73 | bloqueo, recto, esquiva y crochet | — | bloqueo · 2 · esquiva izquierda · 3 | 4 | 2 | 2 | — | inicio, entre golpes | básico | nueva |
| 74 | esquiva, recto y ballesteo | — | 1 · esquiva derecha · 2 · ballesteo | 4 | 2 | 2 | — | entre golpes, final | básico | nueva |
| 75 | flexión, crochet abajo y arriba y bloqueo | — | flexión · 4 al cuerpo · 3 · bloqueo | 4 | 2 | 2 | — | inicio, final | básico | nueva |

### Medio

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 76 | esquiva, recto-crochet, esquiva abajo, crochet y pivote | — | esquiva derecha · 2 · 3 · esquiva abajo derecha · 4 · pivote | 6 | 3 | 2 | pivote | inicio, entre golpes | medio | cambia: amplía «esquiva-2-3» |
| 77 | bloqueo, gancho-crochet y esquiva | — | 1 · 2 · bloqueo · 6 · 3 · esquiva izquierda | 6 | 4 | 2 | — | entre golpes, final | medio | nueva |
| 78 | flexión, recto al cuerpo, crochet-recto y paso atrás | — | flexión · 2 al cuerpo · 3 · 2 · paso atrás | 5 | 3 | 2 | — | inicio, final | medio | nueva |
| 79 | parada, recto, esquiva abajo y gancho-recto | — | parada · 2 · esquiva abajo izquierda · 5 · 2 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 80 | bloqueo, crochet, bloqueo, recto, esquiva y recto | — | bloqueo · 3 · bloqueo · 2 · esquiva derecha · 2 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 81 | esquiva, crochet, esquiva abajo, crochet, ballesteo y recto | — | esquiva izquierda · 3 · esquiva abajo derecha · 4 · ballesteo · 2 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 82 | jab, esquivas a los dos lados y esquiva abajo | — | 1 · esquiva derecha · 2 · esquiva izquierda · 3 · esquiva abajo derecha | 6 | 3 | 3 | — | entre golpes, final | medio | nueva |
| 83 | flexión, recto-crochet, esquiva abajo, crochet y bloqueo | — | flexión · 2 · 3 · esquiva abajo izquierda · 3 · bloqueo | 6 | 3 | 3 | — | inicio, entre golpes, final | medio | nueva |

### Avanzado

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 84 | esquiva, esquiva abajo y paso atrás con contra | — | 1 · 2 · esquiva derecha · 6 · 3 · esquiva abajo izquierda · 3 · paso atrás · 2 | 9 | 6 | 3 | — | entre golpes | avanzado | nueva |
| 85 | bloqueo, flexión, crochet abajo-arriba, esquiva y gancho | — | bloqueo · 3 · 2 · flexión · 3 al cuerpo · 3 · esquiva izquierda · 6 | 8 | 5 | 3 | — | inicio, entre golpes | avanzado | cambia: amplía «bloqueo-3-2» |
| 86 | parada, ballesteo, esquiva abajo y sale | — | parada · 1 · 2 · 3 · ballesteo · 2 · esquiva abajo derecha · 4 · paso lateral derecha | 9 | 5 | 3 | paso lateral derecha | inicio, entre golpes | avanzado | cambia: amplía «1-2-3» |
| 87 | gancho al cuerpo, esquiva abajo, bloqueo, esquiva y sale | — | 1 · 6 al cuerpo · 3 · esquiva abajo izquierda · 3 · bloqueo · 2 · esquiva izquierda · paso lateral izquierda | 9 | 5 | 3 | paso lateral izquierda | entre golpes, final | avanzado | nueva |
| 88 | esquivas y esquivas abajo a los dos lados y cambio de ángulo | — | esquiva derecha · 2 · esquiva izquierda · 3 · esquiva abajo derecha · 4 · esquiva abajo izquierda · 3 · cambio de ángulo | 9 | 4 | 4 | cambio de ángulo | inicio, entre golpes | avanzado | nueva |
| 89 | bloqueo, flexión con recto al cuerpo, ballesteo y paso atrás | — | 1 · bloqueo · 2 · flexión · 2 al cuerpo · ballesteo · 2 · paso atrás | 8 | 4 | 4 | — | entre golpes, final | avanzado | nueva |
| 90 | cinco defensas, cada una con su contra | — | parada · 2 · esquiva derecha · 2 · esquiva abajo izquierda · 3 · esquiva abajo derecha · 4 · ballesteo · 2 | 10 | 5 | 5 | — | inicio, entre golpes | avanzado | nueva |

## Las de la biblioteca actual que salen

De las 83 de hoy se quedan 11 y salen 72. Las que salen con su nivel de hoy, el que les daría `nivel_de` y si alguna nueva las amplía:

| Hoy | Nivel de hoy | Con nivel_de | Ampliada en la propuesta |
|---|---|---|---|
| 1 | básico | ninguno | — |
| 2 | básico | ninguno | — |
| 1 · 1 | básico | básico | — |
| 1 · 3 | básico | básico | — |
| 3 · 2 | básico | básico | — |
| 2 · 3 | básico | básico | — |
| 1 · 6 | básico | básico | — |
| 2 · 1 | básico | básico | — |
| 2 · 5 | básico | básico | — |
| 3 · 4 | básico | básico | — |
| esquiva derecha · 2 · 3 | básico | básico | sí |
| esquiva izquierda · 3 · 2 | básico | básico | sí |
| bloqueo · 2 · 3 | básico | básico | — |
| 1 · 2 · 1 | básico | básico | — |
| 1 · 2 · 5 | básico | básico | — |
| esquiva derecha · 2 · 1 | básico | básico | — |
| 1 · 2 · 1 · 2 | básico | básico | — |
| 1 · 1 · 1 · 2 | básico | básico | — |
| 1 · 2 · bloqueo · 2 | básico | básico | — |
| 1 · 1 · 2 · 1 | básico | básico | — |
| 5 · 6 | medio | básico | — |
| 1 al cuerpo · 2 · pivote | medio | básico | — |
| 1 · 3 · 2 | medio | básico | — |
| 6 · 5 · 2 | medio | básico | — |
| 3 · 6 · 3 | medio | básico | sí |
| 2 · 3 · 2 | medio | básico | sí |
| 6 · 3 · 2 | medio | básico | — |
| 3 · 2 · 3 | medio | básico | — |
| 5 · 2 · 3 | medio | básico | — |
| esquiva abajo izquierda · 3 · 2 | medio | básico | — |
| 1 · 2 · 3 · esquiva derecha | medio | básico | sí |
| esquiva derecha · 6 · 3 · pivote | medio | básico | — |
| bloqueo · 3 · 2 · paso lateral izquierda | medio | básico | sí |
| 1 · 2 · 3 · 2 | medio | básico | — |
| 1 · 2 · 5 · 2 | medio | básico | — |
| 1 · 2 · 3 · 4 | medio | básico | — |
| 1 · 2 · 1 · 6 | medio | básico | — |
| 1 · 2 · esquiva abajo derecha · 4 | medio | básico | — |
| 1 · 2 · esquiva derecha · 2 | medio | básico | sí |
| 1 · 2 · paso atrás · 2 | medio | básico | sí |
| bloqueo · 2 · 3 · 2 | medio | básico | — |
| 1 · 2 · 3 · 6 | medio | básico | — |
| 5 · 2 · 3 · 2 | medio | básico | — |
| 1 · 1 · 2 · 5 | medio | básico | — |
| 1 · 6 · 5 · 2 | medio | básico | — |
| esquiva abajo derecha · 4 · 3 · 2 | medio | básico | — |
| 1 · esquiva derecha · 2 · 1 · 1 | medio | medio | — |
| 1 · 2 · 3 · bloqueo · 2 | medio | medio | — |
| 6 · 5 · 2 · 1 | avanzado | básico | — |
| 3 · 4 · 3 · 2 | avanzado | básico | — |
| 5 · 6 · 5 · 2 | avanzado | básico | — |
| esquiva derecha · 6 · 3 · 2 | avanzado | básico | — |
| 1 · 2 · 3 · 3 al cuerpo · cambio de ángulo | avanzado | medio | — |
| bloqueo · 3 al cuerpo · 2 · 3 · esquiva derecha | avanzado | medio | — |
| 1 · 2 · 3 · 2 · 3 | avanzado | medio | — |
| 1 · 3 · 6 · 3 · 2 | avanzado | medio | — |
| 2 · 3 · 2 · 5 · 2 | avanzado | medio | — |
| 1 · esquiva derecha · 2 · 3 · 2 | avanzado | medio | — |
| 3 · 2 · esquiva abajo derecha · 4 · 3 | avanzado | medio | sí |
| 6 · 3 · paso atrás · 2 · 3 | avanzado | medio | — |
| 2 · esquiva derecha · 2 · 3 · 2 | avanzado | medio | — |
| 1 · 2 · esquiva abajo izquierda · 3 · 2 · pivote | avanzado | medio | — |
| 1 · 2 · 3 · 6 · 3 · 2 | avanzado | medio | — |
| 1 · 6 · 3 · 2 · 1 · 2 | avanzado | medio | — |
| 1 · 2 · 5 · 2 · 3 · 2 | avanzado | medio | — |
| 1 · 2 · esquiva abajo derecha · 4 · 3 · 2 | avanzado | medio | — |
| 1 · 2 · esquiva derecha · 2 · 3 · 2 | avanzado | medio | — |
| 1 · 2 · 3 · esquiva abajo izquierda · 3 · 2 | avanzado | medio | — |
| 1 · 2 · 3 · 2 · 5 · 2 | avanzado | medio | — |
| 1 · 1 · 2 · 3 · 4 · 3 | avanzado | medio | — |
| 1 · 2 · esquiva abajo derecha · 4 · esquiva abajo izquierda · 3 · 2 | avanzado | avanzado | — |
| 1 · 2 · 3 · esquiva abajo izquierda · 3 · 6 · 3 | avanzado | avanzado | — |
