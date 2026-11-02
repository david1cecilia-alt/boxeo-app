# Biblioteca nueva: propuesta para revisar

> **REVISAR CON ENTRENADOR: toda esta propuesta.** Las combinaciones, sus familias y variantes, los nombres y el
> reparto. Es una propuesta: `data/combinaciones.json` y el sorteo no cambian hasta que esté revisada.
> Se genera con `python herramientas/biblioteca.py`: no editar a mano.

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
| básico | 50 | 0 | 20 | 40 % | 40 % | +0 |
| básico | 50 | 1 | 15 | 30 % | 30 % | +0 |
| básico | 50 | 2 | 15 | 30 % | 30 % | +0 |
| medio | 50 | 1 | 20 | 40 % | 40 % | +0 |
| medio | 50 | 2 | 20 | 40 % | 40 % | +0 |
| medio | 50 | 3 | 10 | 20 % | 20 % | +0 |
| avanzado | 50 | 1 | 5 | 10 % | 10 % | +0 |
| avanzado | 50 | 2 | 15 | 30 % | 30 % | +0 |
| avanzado | 50 | 3 | 20 | 40 % | 40 % | +0 |
| avanzado | 50 | 4-5 | 10 | 20 % | 20 % | +0 |

**Total: 150 combinaciones**, 50 por nivel (97 en 16 familias y 53 sueltas). El reparto cuadra exacto: desviación 0 en todos.
Los clásicos 1-2-3-2, 1-3-2, 1-2-5-2, 1-2-1-2, 3-2-3 están en básico sin defensa.

### Cuántas veces sale cada una

| Nivel | Combinaciones | Se dicen por sesión Amateur 3×3 (mín · media · máx) | Veces que sale cada una (media) | Con 25 | Con 15 |
|---|---|---|---|---|---|
| básico | 50 | 48 · 72 · 98 | 1,4 | 2,9 | 4,8 |
| medio | 50 | 37 · 49 · 62 | 1,0 | 2,0 | 3,3 |
| avanzado | 50 | 27 · 32 · 39 | 0,6 | 1,3 | 2,2 |

Sale de simular 60 sesiones Amateur por nivel (ritmos 1, 3 y 5) con estas combinaciones, sorteando solo de su
nivel y sin repetir ninguna de las 5 últimas. Las columnas «Con 25» y «Con 15» dicen cuántas veces saldría cada
una si el nivel tuviera solo 25 o 15 combinaciones.

### Balance de golpes, defensas y salidas

Comprobado por el script: cada golpe a la cara entre el 12 y el 22 % de los golpes a la cara (en total y en cada nivel); cada golpe al cuerpo, al menos 6 veces; cada defensa, al menos 12; derecha e izquierda de cada defensa con lado, a menos de un 20 % de diferencia; cada salida, al menos 6.

**Golpes a la cara** (% sobre los golpes a la cara)

| Golpe | Veces | Total | Básico | Medio | Avanzado |
|---|---|---|---|---|---|
| 1 jab | 74 | 14,8 % | 21,0 % | 14,9 % | 12,1 % |
| 2 recto | 73 | 14,6 % | 21,0 % | 13,0 % | 13,0 % |
| 3 crochet adelantado | 91 | 18,2 % | 20,0 % | 16,8 % | 18,4 % |
| 4 crochet trasero | 94 | 18,8 % | 12,0 % | 21,1 % | 20,1 % |
| 5 gancho adelantado | 74 | 14,8 % | 12,0 % | 14,9 % | 15,9 % |
| 6 gancho trasero | 94 | 18,8 % | 14,0 % | 19,3 % | 20,5 % |

**Golpes al cuerpo**

| Golpe | Veces |
|---|---|
| 1 al cuerpo | 14 |
| 2 al cuerpo | 9 |
| 3 al cuerpo | 12 |
| 4 al cuerpo | 8 |
| 5 al cuerpo | 9 |
| 6 al cuerpo | 11 |

**Defensas y salidas**

| Acción | Veces | Derecha | Izquierda |
|---|---|---|---|
| esquiva | 66 | 35 | 31 |
| esquiva abajo | 60 | 30 | 30 |
| ballesteo | 26 | — | — |
| flexión | 30 | — | — |
| bloqueo | 46 | — | — |
| parada | 17 | — | — |
| paso atrás | 26 | — | — |
| paso lateral | 12 | 6 | 6 |
| pivote | 13 | — | — |
| cambio de ángulo | 11 | — | — |

## Familias

### F1. Crochet y esquiva abajo

Jab, crochet, se esquiva abajo y se devuelve.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | jab, crochet y esquiva abajo | base | 1 · 3 · esquiva abajo derecha | 3 | 2 | 1 | — | final | básico | nueva |
| 2 | esquivando al otro lado | variante de #1 | 1 · 3 · esquiva abajo izquierda | 3 | 2 | 1 | — | final | básico | nueva |
| 3 | y devuelve gancho y crochet | crece de #1 | 1 · 3 · esquiva abajo derecha · 6 · 4 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 4 | devuelve 4-2 en vez de 6-4 | variante de #3 | 1 · 3 · esquiva abajo derecha · 4 · 2 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 5 | cambio de ángulo y crochet | crece de #3 | 1 · 3 · esquiva abajo derecha · 6 · 4 · cambio de ángulo · 3 | 7 | 5 | 1 | cambio de ángulo | entre golpes | avanzado | nueva |
| 6 | sale con pivote | variante de #5 | 1 · 3 · esquiva abajo derecha · 6 · 4 · pivote · 3 | 7 | 5 | 1 | pivote | entre golpes | avanzado | nueva |

### F2. Jab-recto

La base de todo, a la que se le añaden esquivas y contras.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 7 | jab-recto | base | 1 · 2 | 2 | 2 | 0 | — | — | básico | se queda (antes básico) |
| 8 | doble jab y recto | variante de #7 | 1 · 1 · 2 | 3 | 3 | 0 | — | — | básico | se queda (antes básico) |
| 9 | esquiva y gancho-recto | crece de #7 | 1 · 2 · esquiva izquierda · 5 · 2 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 10 | doble jab, esquiva y gancho | variante de #9 | 1 · 1 · 2 · esquiva derecha · 6 | 5 | 4 | 1 | — | entre golpes | medio | cambia: amplía «1-1-2» |
| 11 | esquiva abajo, crochet y sale | crece de #9 | 1 · 2 · esquiva izquierda · 5 · 2 · esquiva abajo derecha · 4 · paso lateral izquierda | 8 | 5 | 2 | paso lateral izquierda | entre golpes | avanzado | nueva |
| 12 | crochet, bloqueo y crochet | variante de #11 | 1 · 1 · 2 · esquiva derecha · 6 · 3 · bloqueo · 4 | 8 | 6 | 2 | — | entre golpes | avanzado | cambia: amplía «1-1-2» |

### F3. Ballesteo y contra

Se saca la cara hacia atrás y se contesta.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 13 | ballesteo y recto | base | ballesteo · 2 | 2 | 1 | 1 | — | inicio | básico | nueva |
| 14 | ballesteo, gancho y crochet | variante de #13 | ballesteo · 6 · 3 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 15 | jab, ballesteo y tres golpes | crece de #13 | 1 · ballesteo · 2 · 3 · 4 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 16 | con esquiva abajo y crochet | variante de #15 | ballesteo · 6 · 3 · esquiva abajo izquierda · 4 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 17 | otro ballesteo, gancho y pivote | crece de #15 | 1 · ballesteo · 2 · 3 · 4 · ballesteo · 5 · pivote | 8 | 5 | 2 | pivote | entre golpes | avanzado | nueva |
| 18 | flexión, crochet abajo y arriba y sale | variante de #17 | ballesteo · 6 · 3 · esquiva abajo izquierda · 4 · flexión · 4 al cuerpo · 3 · paso lateral derecha | 9 | 5 | 3 | paso lateral derecha | inicio, entre golpes | avanzado | nueva |

### F4. Parada y contra

Se para el jab con la derecha y se contesta.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 19 | parada y jab-recto | base | parada · 1 · 2 | 3 | 2 | 1 | — | inicio | básico | se queda (antes básico) |
| 20 | parada, recto-crochet y bloqueo | variante de #19 | parada · 2 · 3 · bloqueo | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 21 | esquiva y gancho-crochet | crece de #19 | parada · 1 · 2 · esquiva derecha · 6 · 3 | 6 | 4 | 2 | — | inicio, entre golpes | medio | cambia: amplía «parada-1-2» |
| 22 | bloqueo, crochet y gancho | variante de #21 | parada · 2 · 3 · bloqueo · 4 · 5 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 23 | bloqueo y gancho-recto | crece de #21 | parada · 1 · 2 · esquiva derecha · 6 · 3 · bloqueo · 5 · 2 | 9 | 6 | 3 | — | inicio, entre golpes | avanzado | cambia: amplía «parada-1-2» |
| 24 | paso atrás, jab-recto y sale | variante de #23 | parada · 1 · 2 · esquiva derecha · 6 · 3 · paso atrás · 1 · 2 · paso lateral izquierda | 10 | 6 | 3 | paso lateral izquierda | inicio, entre golpes | avanzado | cambia: amplía «parada-1-2» |

### F5. Abajo y arriba

Golpes al cuerpo para bajar la guardia del rival y subir a la cara.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 25 | jab al cuerpo y recto | base | 1 al cuerpo · 2 | 2 | 2 | 0 | — | — | básico | nueva |
| 26 | gancho y crochet abajo y arriba | variante de #25 | 6 · 3 al cuerpo · 3 | 3 | 3 | 0 | — | — | básico | nueva |
| 27 | flexión y crochet abajo y arriba | crece de #25 | 1 al cuerpo · 2 · flexión · 3 al cuerpo · 3 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 28 | flexión y ganchos abajo y arriba | variante de #27 | 6 · 3 al cuerpo · 3 · flexión · 6 al cuerpo · 5 | 6 | 5 | 1 | — | entre golpes | medio | nueva |
| 29 | esquiva abajo y crochet abajo y arriba | crece de #27 | 1 al cuerpo · 2 · flexión · 3 al cuerpo · 3 · esquiva abajo derecha · 4 al cuerpo · 4 | 8 | 6 | 2 | — | entre golpes | avanzado | nueva |
| 30 | bloqueo y crochet | variante de #29 | 6 · 3 al cuerpo · 3 · flexión · 6 al cuerpo · 5 · bloqueo · 4 | 8 | 6 | 2 | — | entre golpes | avanzado | nueva |

### F6. Esquiva a los dos lados

Esquiva lateral, se suelta y se vuelve a esquivar.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 31 | esquiva, gancho-crochet y esquiva | base | esquiva derecha · 6 · 3 · esquiva izquierda | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 32 | empezando por la izquierda, con gancho-recto | variante de #31 | esquiva izquierda · 5 · 2 · esquiva derecha | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 33 | y devuelve gancho-crochet | crece de #31 | esquiva derecha · 6 · 3 · esquiva izquierda · 5 · 4 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 34 | gancho y bloqueo | variante de #33 | esquiva izquierda · 5 · 2 · esquiva derecha · 6 · bloqueo | 6 | 3 | 3 | — | inicio, entre golpes, final | medio | nueva |
| 35 | esquiva abajo y gancho-crochet | crece de #33 | esquiva derecha · 6 · 3 · esquiva izquierda · 5 · 4 · esquiva abajo derecha · 6 · 4 | 9 | 6 | 3 | — | inicio, entre golpes | avanzado | nueva |
| 36 | gancho-recto y pivote | variante de #35 | esquiva izquierda · 5 · 2 · esquiva derecha · 6 · bloqueo · 5 · 2 · pivote | 9 | 5 | 3 | pivote | inicio, entre golpes | avanzado | nueva |

### F7. Bloqueo

Bloquear, devolver y, si toca, volver a bloquear.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 37 | bloqueo, crochet y recto | base | bloqueo · 3 · 2 | 3 | 2 | 1 | — | inicio | básico | se queda (antes básico) |
| 38 | y vuelve a bloquear | variante de #37 | bloqueo · 3 · 2 · bloqueo | 4 | 2 | 2 | — | inicio, final | básico | cambia: amplía «bloqueo-3-2» |
| 39 | gancho-recto y bloqueo | variante de #37 | 5 · 2 · bloqueo | 3 | 2 | 1 | — | final | básico | nueva |
| 40 | paso atrás y gancho | crece de #37 | 1 · bloqueo · 3 · 2 · paso atrás · 6 | 6 | 4 | 2 | — | entre golpes | medio | cambia: amplía «bloqueo-3-2» |
| 41 | doble bloqueo y gancho-crochet | variante de #40 | bloqueo · 3 · 2 · bloqueo · 6 · 3 | 6 | 4 | 2 | — | inicio, entre golpes | medio | cambia: amplía «bloqueo-3-2» |
| 42 | esquiva, crochet y paso lateral | crece de #40 | 1 · bloqueo · 3 · 2 · paso atrás · 6 · esquiva derecha · 4 · paso lateral derecha | 9 | 5 | 3 | paso lateral derecha | entre golpes | avanzado | cambia: amplía «bloqueo-3-2» |
| 43 | esquiva, gancho, ballesteo y recto | variante de #42 | bloqueo · 3 · 2 · bloqueo · 6 · 3 · esquiva izquierda · 5 · ballesteo · 2 | 10 | 6 | 4 | — | inicio, entre golpes | avanzado | cambia: amplía «bloqueo-3-2» |

### F8. Paso atrás y contra

Se rompe la distancia y se contesta.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 44 | paso atrás y recto | base | paso atrás · 2 | 2 | 1 | 1 | — | inicio | básico | se queda (antes básico) |
| 45 | paso atrás, jab-recto y paso atrás | variante de #44 | paso atrás · 1 · 2 · paso atrás | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 46 | jab-crochet, paso atrás y recto-crochet | crece de #44 | 1 · 4 · paso atrás · 2 · 3 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 47 | y pivota | variante de #46 | 1 · 4 · paso atrás · 2 · 3 · pivote | 6 | 4 | 1 | pivote | entre golpes | medio | nueva |
| 48 | flexión, crochet al cuerpo, gancho y sale | crece de #46 | 1 · 4 · paso atrás · 2 · 3 · flexión · 3 al cuerpo · 6 · paso lateral derecha | 9 | 6 | 2 | paso lateral derecha | entre golpes | avanzado | nueva |
| 49 | pivota, esquiva y gancho-crochet | variante de #48 | 1 · 4 · paso atrás · 2 · 3 · pivote · esquiva derecha · 5 · 4 | 9 | 6 | 2 | pivote | entre golpes | avanzado | nueva |

### F9. Gancho y crochet

Ganchos (5 y 6) en la corta, rematados con crochet.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 50 | gancho de derecha y crochet | base | 6 · 3 | 2 | 2 | 0 | — | — | básico | se queda (antes básico) |
| 51 | gancho de izquierda y crochet de derecha | variante de #50 | 5 · 4 | 2 | 2 | 0 | — | — | básico | nueva |
| 52 | jab-recto, gancho-crochet y esquiva abajo | crece de #50 | 1 · 2 · 6 · 3 · esquiva abajo izquierda | 5 | 4 | 1 | — | final | medio | nueva |
| 53 | esquiva abajo y crochet | variante de #52 | 1 · 5 · 4 · esquiva abajo derecha · 3 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 54 | devuelve crochet y dos ganchos y esquiva | crece de #52 | 1 · 2 · 6 · 3 · esquiva abajo izquierda · 3 · 6 · 5 · esquiva izquierda | 9 | 7 | 2 | — | entre golpes, final | avanzado | nueva |
| 55 | gancho al cuerpo, gancho y ballesteo | variante de #54 | 1 · 5 · 4 · esquiva abajo derecha · 3 · 5 al cuerpo · 6 · ballesteo | 8 | 6 | 2 | — | entre golpes, final | avanzado | nueva |

### F10. Doble jab

Doble jab para entrar, y lo que venga.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 56 | doble jab y crochet de derecha | base | 1 · 1 · 4 | 3 | 3 | 0 | — | — | básico | nueva |
| 57 | doble jab, gancho y crochet | variante de #56 | 1 · 1 · 6 · 3 | 4 | 4 | 0 | — | — | básico | nueva |
| 58 | esquiva y crochet | crece de #56 | 1 · 1 · 4 · esquiva izquierda · 3 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 59 | ballesteo y crochet | variante de #58 | 1 · 1 · 6 · 3 · ballesteo · 4 | 6 | 5 | 1 | — | entre golpes | medio | nueva |
| 60 | esquiva abajo y gancho-crochet | crece de #58 | 1 · 1 · 4 · esquiva izquierda · 3 · 2 · esquiva abajo derecha · 5 · 4 | 9 | 7 | 2 | — | entre golpes | avanzado | cambia: amplía «esquiva-3-2» |
| 61 | bloqueo y gancho-recto | variante de #60 | 1 · 1 · 6 · 3 · ballesteo · 4 · bloqueo · 5 · 2 | 9 | 7 | 2 | — | entre golpes | avanzado | nueva |

### F11. Flexión y cuerpo

Se baja con flexión y se ataca al cuerpo.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 62 | flexión y doble crochet, abajo y arriba | base | flexión · 3 al cuerpo · 4 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 63 | flexión y ganchos abajo y arriba | variante de #62 | flexión · 6 al cuerpo · 5 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 64 | recto y bloqueo | crece de #62 | flexión · 3 al cuerpo · 4 · 2 · bloqueo | 5 | 3 | 2 | — | inicio, final | medio | nueva |
| 65 | esquiva abajo y doble crochet | variante de #64 | flexión · 6 al cuerpo · 5 · esquiva abajo derecha · 4 · 3 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 66 | gancho al cuerpo, crochet y esquiva | crece de #64 | flexión · 3 al cuerpo · 4 · 2 · bloqueo · 6 al cuerpo · 3 · esquiva izquierda | 8 | 5 | 3 | — | inicio, entre golpes, final | avanzado | nueva |
| 67 | otra flexión, jab al cuerpo y gancho | variante de #66 | flexión · 6 al cuerpo · 5 · esquiva abajo derecha · 4 · 3 · flexión · 1 al cuerpo · 6 | 9 | 6 | 3 | — | inicio, entre golpes | avanzado | nueva |

### F12. Esquiva abajo a los dos lados

Esquivar abajo, soltar el crochet del lado y cambiar.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 68 | esquiva abajo y crochet a los dos lados | base | esquiva abajo izquierda · 3 · esquiva abajo derecha · 4 | 4 | 2 | 2 | — | inicio, entre golpes | básico | nueva |
| 69 | empezando por la derecha | variante de #68 | esquiva abajo derecha · 4 · esquiva abajo izquierda · 3 | 4 | 2 | 2 | — | inicio, entre golpes | básico | nueva |
| 70 | y gancho-recto | crece de #68 | esquiva abajo izquierda · 3 · esquiva abajo derecha · 4 · 5 · 2 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 71 | gancho y flexión | variante de #70 | esquiva abajo derecha · 4 · esquiva abajo izquierda · 3 · 6 · flexión | 6 | 3 | 3 | — | inicio, entre golpes, final | medio | nueva |
| 72 | esquiva, gancho y crochet al cuerpo | crece de #70 | esquiva abajo izquierda · 3 · esquiva abajo derecha · 4 · 5 · 2 · esquiva derecha · 6 · 4 al cuerpo | 9 | 6 | 3 | — | inicio, entre golpes | avanzado | nueva |
| 73 | ganchos abajo y arriba, paso atrás y recto | variante de #72 | esquiva abajo derecha · 4 · esquiva abajo izquierda · 3 · 6 · flexión · 5 al cuerpo · 5 · paso atrás · 2 | 10 | 6 | 4 | — | inicio, entre golpes | avanzado | nueva |

### F13. Jab arriba y abajo

El jab cambia de altura para abrir hueco.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 74 | jab arriba, jab abajo y recto | base | 1 · 1 al cuerpo · 2 | 3 | 3 | 0 | — | — | básico | nueva |
| 75 | jab abajo, jab arriba y crochet | variante de #74 | 1 al cuerpo · 1 · 4 | 3 | 3 | 0 | — | — | básico | nueva |
| 76 | esquiva y gancho | crece de #74 | 1 · 1 al cuerpo · 2 · esquiva derecha · 6 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 77 | paso atrás y recto | variante de #76 | 1 al cuerpo · 1 · 4 · paso atrás · 2 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 78 | crochet, bloqueo y crochet abajo y arriba | crece de #76 | 1 · 1 al cuerpo · 2 · esquiva derecha · 6 · 3 · bloqueo · 4 al cuerpo · 4 | 9 | 7 | 2 | — | entre golpes | avanzado | nueva |
| 79 | flexión, ganchos abajo y arriba y sale | variante de #78 | 1 al cuerpo · 1 · 4 · paso atrás · 2 · flexión · 5 al cuerpo · 6 · paso lateral izquierda | 9 | 6 | 2 | paso lateral izquierda | entre golpes | avanzado | nueva |

### F14. Parada y al cuerpo

Se para el jab y se contesta abajo.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 80 | parada, recto al cuerpo y crochet | base | parada · 2 al cuerpo · 3 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 81 | parada, jab y recto al cuerpo | variante de #80 | parada · 1 · 2 al cuerpo | 3 | 2 | 1 | — | inicio | básico | nueva |
| 82 | esquiva abajo y dos ganchos | crece de #80 | parada · 2 al cuerpo · 3 · esquiva abajo izquierda · 6 · 5 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 83 | ballesteo y crochet | variante de #82 | parada · 1 · 2 al cuerpo · ballesteo · 4 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 84 | esquiva, crochet y cambio de ángulo | crece de #82 | parada · 2 al cuerpo · 3 · esquiva abajo izquierda · 6 · 5 · esquiva derecha · 4 · cambio de ángulo | 9 | 5 | 3 | cambio de ángulo | inicio, entre golpes | avanzado | nueva |
| 85 | bloqueo, gancho-crochet y pivote | variante de #84 | parada · 1 · 2 al cuerpo · ballesteo · 4 · bloqueo · 6 · 3 · pivote | 9 | 5 | 3 | pivote | inicio, entre golpes | avanzado | nueva |

### F15. Cambio de ángulo

Se suelta, se cambia de ángulo y se ataca desde el nuevo sitio.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 86 | dos ganchos y cambio de ángulo | base | 6 · 5 · cambio de ángulo | 3 | 2 | 0 | cambio de ángulo | — | básico | nueva |
| 87 | gancho-crochet y cambio de ángulo | variante de #86 | 6 · 3 · cambio de ángulo | 3 | 2 | 0 | cambio de ángulo | — | básico | nueva |
| 88 | doble crochet y esquiva | crece de #86 | 6 · 5 · cambio de ángulo · 3 · 4 · esquiva izquierda | 6 | 4 | 1 | cambio de ángulo | final | medio | nueva |
| 89 | gancho y paso atrás | variante de #88 | 6 · 3 · cambio de ángulo · 5 · paso atrás | 5 | 3 | 1 | cambio de ángulo | final | medio | nueva |
| 90 | gancho, bloqueo y gancho | crece de #88 | 6 · 5 · cambio de ángulo · 3 · 4 · esquiva izquierda · 5 · bloqueo · 6 | 9 | 6 | 2 | cambio de ángulo | entre golpes | avanzado | nueva |
| 91 | crochet, esquiva abajo, crochet y sale | variante de #90 | 6 · 3 · cambio de ángulo · 5 · paso atrás · 4 · esquiva abajo derecha · 3 · paso lateral izquierda | 9 | 5 | 2 | cambio de ángulo, paso lateral izquierda | entre golpes | avanzado | nueva |

### F16. Pivote

Se suelta y se pivota para no quedarse delante.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 92 | doble crochet y pivote | base | 3 · 4 · pivote | 3 | 2 | 0 | pivote | — | básico | nueva |
| 93 | crochet-gancho y pivote | variante de #92 | 4 · 5 · pivote | 3 | 2 | 0 | pivote | — | básico | nueva |
| 94 | bloqueo, doble crochet, pivote y recto | crece de #92 | bloqueo · 3 · 4 · pivote · 2 | 5 | 3 | 1 | pivote | inicio | medio | nueva |
| 95 | esquiva abajo y crochet | variante de #94 | 4 · 5 · pivote · esquiva abajo derecha · 4 | 5 | 3 | 1 | pivote | entre golpes | medio | nueva |
| 96 | esquiva, gancho, ballesteo y gancho | crece de #94 | bloqueo · 3 · 4 · pivote · 2 · esquiva izquierda · 5 · ballesteo · 6 | 9 | 5 | 3 | pivote | inicio, entre golpes | avanzado | nueva |
| 97 | crochet, flexión, gancho al cuerpo y esquiva | variante de #96 | 4 · 5 · pivote · esquiva abajo derecha · 4 · 3 · flexión · 6 al cuerpo · esquiva derecha | 9 | 5 | 3 | pivote | entre golpes, final | avanzado | nueva |

## Sueltas

### Básico

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 98 | jab-recto-crochet-recto | — | 1 · 2 · 3 · 2 | 4 | 4 | 0 | — | — | básico | se queda (antes medio) |
| 99 | jab-crochet-recto | — | 1 · 3 · 2 | 3 | 3 | 0 | — | — | básico | se queda (antes medio) |
| 100 | jab-recto-gancho-recto | — | 1 · 2 · 5 · 2 | 4 | 4 | 0 | — | — | básico | se queda (antes medio) |
| 101 | jab-recto-jab-recto | — | 1 · 2 · 1 · 2 | 4 | 4 | 0 | — | — | básico | se queda (antes básico) |
| 102 | crochet-recto-crochet | — | 3 · 2 · 3 | 3 | 3 | 0 | — | — | básico | se queda (antes medio) |
| 103 | dos ganchos y crochet | — | 5 · 6 · 3 | 3 | 3 | 0 | — | — | básico | nueva |
| 104 | esquiva, gancho y crochet | — | esquiva izquierda · 5 · 4 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 105 | gancho al cuerpo, gancho y bloqueo | — | 5 al cuerpo · 6 · bloqueo | 3 | 2 | 1 | — | final | básico | nueva |
| 106 | esquiva, gancho y crochet | — | esquiva derecha · 6 · 4 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 107 | esquiva, gancho y ballesteo | — | 1 · esquiva derecha · 6 · ballesteo | 4 | 2 | 2 | — | entre golpes, final | básico | nueva |
| 108 | paso atrás, gancho y bloqueo | — | paso atrás · 6 · bloqueo | 3 | 1 | 2 | — | inicio, final | básico | nueva |
| 109 | esquiva, crochet, esquiva y gancho | — | esquiva derecha · 4 · esquiva izquierda · 5 | 4 | 2 | 2 | — | inicio, entre golpes | básico | nueva |
| 110 | flexión, ganchos abajo y arriba y bloqueo | — | flexión · 5 al cuerpo · 6 · bloqueo | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 111 | parada, gancho y esquiva abajo | — | parada · 5 · esquiva abajo derecha | 3 | 1 | 2 | — | inicio, final | básico | nueva |
| 112 | esquiva abajo, crochet abajo y arriba y paso atrás | — | esquiva abajo izquierda · 4 al cuerpo · 4 · paso atrás | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 113 | jab, ballesteo, gancho y flexión | — | 1 · ballesteo · 5 · flexión | 4 | 2 | 2 | — | entre golpes, final | básico | nueva |
| 114 | esquiva, ganchos abajo y arriba y esquiva | — | esquiva izquierda · 6 al cuerpo · 6 · esquiva derecha | 4 | 2 | 2 | — | inicio, final | básico | nueva |

### Medio

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 115 | jab, dos ganchos, crochet y esquiva | — | 1 · 6 · 5 · 4 · esquiva izquierda | 5 | 4 | 1 | — | final | medio | nueva |
| 116 | esquiva, dos ganchos, esquiva abajo, crochet y pivote | — | esquiva derecha · 6 · 5 · esquiva abajo izquierda · 4 · pivote | 6 | 3 | 2 | pivote | inicio, entre golpes | medio | nueva |
| 117 | bloqueo, gancho-crochet y esquiva | — | 1 · 2 · bloqueo · 6 · 3 · esquiva izquierda | 6 | 4 | 2 | — | entre golpes, final | medio | nueva |
| 118 | flexión, recto al cuerpo, dos ganchos y paso atrás | — | flexión · 2 al cuerpo · 5 · 6 · paso atrás | 5 | 3 | 2 | — | inicio, final | medio | nueva |
| 119 | parada, crochet, esquiva abajo y gancho-recto | — | parada · 4 · esquiva abajo izquierda · 5 · 2 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 120 | ballesteo, crochet-gancho, esquiva abajo y gancho | — | ballesteo · 4 · 5 · esquiva abajo izquierda · 6 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 121 | jab al cuerpo, gancho, bloqueo, crochet y esquiva | — | 1 al cuerpo · 6 · bloqueo · 4 · esquiva derecha | 5 | 3 | 2 | — | entre golpes, final | medio | nueva |
| 122 | paso atrás, gancho-crochet, flexión y crochet al cuerpo | — | paso atrás · 5 · 4 · flexión · 3 al cuerpo | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 123 | esquiva, ganchos abajo y arriba, ballesteo y crochet | — | esquiva izquierda · 5 al cuerpo · 6 · ballesteo · 4 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 124 | esquiva abajo, dos ganchos, bloqueo y paso lateral | — | 1 · esquiva abajo izquierda · 6 · 5 · bloqueo · paso lateral derecha | 6 | 3 | 2 | paso lateral derecha | entre golpes, final | medio | nueva |
| 125 | dos bloqueos, esquiva y gancho | — | bloqueo · 5 · bloqueo · 4 · esquiva derecha · 6 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 126 | esquiva, esquiva abajo, ballesteo y gancho | — | esquiva izquierda · 3 · esquiva abajo derecha · 4 · ballesteo · 6 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 127 | jab, esquivas a los dos lados y esquiva abajo | — | 1 · esquiva derecha · 5 · esquiva izquierda · 4 · esquiva abajo izquierda | 6 | 3 | 3 | — | entre golpes, final | medio | nueva |
| 128 | flexión, gancho-crochet, esquiva abajo, gancho y bloqueo | — | flexión · 6 · 4 · esquiva abajo izquierda · 5 · bloqueo | 6 | 3 | 3 | — | inicio, entre golpes, final | medio | nueva |
| 129 | parada, paso atrás y flexión con contras | — | parada · 6 · paso atrás · 5 · flexión · 4 al cuerpo | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 130 | esquiva abajo, ganchos abajo y arriba, esquiva y bloqueo | — | esquiva abajo izquierda · 6 al cuerpo · 6 · esquiva derecha · bloqueo · 4 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 131 | ballesteo, flexión, recto al cuerpo y esquiva abajo | — | ballesteo · 6 · flexión · 2 al cuerpo · esquiva abajo izquierda · 5 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 132 | paso atrás, jab, esquiva, crochet y bloqueo | — | paso atrás · 1 · esquiva derecha · 4 · bloqueo · 6 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |

### Avanzado

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 133 | dos ganchos, esquiva, gancho-crochet y sale | — | 1 · 6 · 5 · 4 · esquiva derecha · 6 · 3 · paso lateral izquierda | 8 | 6 | 1 | paso lateral izquierda | entre golpes | avanzado | nueva |
| 134 | crochet abajo y arriba, dos ganchos y bloqueo | — | 1 · 4 al cuerpo · 4 · 5 · 6 · 3 · bloqueo | 7 | 6 | 1 | — | final | avanzado | nueva |
| 135 | esquiva abajo, ganchos abajo y arriba y cambio de ángulo | — | 2 · 5 · 4 · esquiva abajo izquierda · 5 al cuerpo · 6 · 3 · cambio de ángulo | 8 | 6 | 1 | cambio de ángulo | entre golpes | avanzado | nueva |
| 136 | esquiva, esquiva abajo y paso atrás con contra | — | 1 · 2 · esquiva derecha · 6 · 3 · esquiva abajo izquierda · 5 · paso atrás · 4 | 9 | 6 | 3 | — | entre golpes | avanzado | nueva |
| 137 | bloqueo, flexión, esquiva y ganchos | — | bloqueo · 4 · 5 · flexión · 3 al cuerpo · 6 · esquiva izquierda · 6 | 8 | 5 | 3 | — | inicio, entre golpes | avanzado | nueva |
| 138 | parada, ballesteo, esquiva abajo y sale | — | parada · 1 · 6 · 3 · ballesteo · 4 · esquiva abajo derecha · 5 · paso lateral derecha | 9 | 5 | 3 | paso lateral derecha | inicio, entre golpes | avanzado | nueva |
| 139 | gancho al cuerpo, esquiva abajo, bloqueo, esquiva y sale | — | 1 · 6 al cuerpo · 5 · esquiva abajo izquierda · 4 · bloqueo · 2 · esquiva izquierda · paso lateral izquierda | 9 | 5 | 3 | paso lateral izquierda | entre golpes, final | avanzado | nueva |
| 140 | esquiva, flexión, paso atrás y paso lateral | — | esquiva derecha · 5 · 4 · flexión · 1 al cuerpo · 6 · paso atrás · 3 · paso lateral derecha | 9 | 5 | 3 | paso lateral derecha | inicio, entre golpes | avanzado | nueva |
| 141 | bloqueo, esquiva abajo, doble crochet y ballesteo | — | 1 al cuerpo · 5 · bloqueo · 6 · esquiva abajo izquierda · 4 · 3 · ballesteo | 8 | 5 | 3 | — | entre golpes, final | avanzado | nueva |
| 142 | esquiva, bloqueo, ganchos abajo y arriba y esquiva abajo | — | 4 · 5 · esquiva izquierda · 6 · 4 · bloqueo · 5 al cuerpo · 6 · esquiva abajo derecha | 9 | 6 | 3 | — | entre golpes, final | avanzado | nueva |
| 143 | esquivas y esquivas abajo a los dos lados y cambio de ángulo | — | esquiva derecha · 2 · esquiva izquierda · 3 · esquiva abajo derecha · 4 · esquiva abajo izquierda · 5 · cambio de ángulo | 9 | 4 | 4 | cambio de ángulo | inicio, entre golpes | avanzado | nueva |
| 144 | bloqueo, flexión, ballesteo y paso atrás | — | 1 · bloqueo · 2 · flexión · 2 al cuerpo · ballesteo · 6 · paso atrás | 8 | 4 | 4 | — | entre golpes, final | avanzado | nueva |
| 145 | cinco defensas, cada una con su contra | — | parada · 2 · esquiva derecha · 6 · esquiva abajo izquierda · 5 · esquiva abajo derecha · 4 · ballesteo · 6 | 10 | 5 | 5 | — | inicio, entre golpes | avanzado | nueva |
| 146 | dos bloqueos, esquiva y flexión con contras | — | bloqueo · 6 · bloqueo · 5 · esquiva izquierda · 4 · flexión · 3 al cuerpo | 8 | 4 | 4 | — | inicio, entre golpes | avanzado | nueva |
| 147 | esquiva abajo, esquiva, paso atrás y ballesteo | — | esquiva abajo izquierda · 6 · esquiva derecha · 5 · paso atrás · 1 al cuerpo · 6 · ballesteo | 8 | 4 | 4 | — | inicio, entre golpes, final | avanzado | nueva |
| 148 | esquiva, esquiva abajo, flexión y bloqueo | — | 1 · esquiva izquierda · 4 al cuerpo · 5 · esquiva abajo derecha · 6 · flexión · 4 · bloqueo | 9 | 5 | 4 | — | entre golpes, final | avanzado | nueva |
| 149 | ballesteo, esquiva, esquiva abajo y paso atrás | — | ballesteo · 5 · esquiva derecha · 6 al cuerpo · 6 · esquiva abajo izquierda · 4 · paso atrás · 1 | 9 | 5 | 4 | — | inicio, entre golpes | avanzado | nueva |
| 150 | flexión, bloqueo, esquiva, esquiva abajo y cambio de ángulo | — | flexión · 5 al cuerpo · bloqueo · 6 · esquiva izquierda · 3 · esquiva abajo derecha · 4 · cambio de ángulo | 9 | 4 | 4 | cambio de ángulo | inicio, entre golpes | avanzado | nueva |

## Las de la biblioteca actual que salen

De las 83 de hoy se quedan 11 y salen 72. Las que salen, con su nivel de hoy, el que les daría `nivel_de` y si alguna nueva las amplía:

| Hoy | Nivel de hoy | Con nivel_de | Ampliada en la propuesta |
|---|---|---|---|
| 1 | básico | ninguno | — |
| 2 | básico | ninguno | — |
| 1 · 1 | básico | básico | — |
| 1 · 3 | básico | básico | — |
| 3 · 2 | básico | básico | — |
| 2 · 3 | básico | básico | — |
| 1 · 6 | básico | básico | — |
| 5 · 2 | básico | básico | — |
| 2 · 1 | básico | básico | — |
| 2 · 5 | básico | básico | — |
| 3 · 4 | básico | básico | — |
| 1 · 2 · 3 | básico | básico | — |
| esquiva derecha · 2 · 3 | básico | básico | — |
| esquiva izquierda · 3 · 2 | básico | básico | sí |
| bloqueo · 2 · 3 | básico | básico | — |
| 1 · 2 · 1 | básico | básico | — |
| 1 · 2 · 5 | básico | básico | — |
| esquiva derecha · 2 · 1 | básico | básico | — |
| 1 · 1 · 1 · 2 | básico | básico | — |
| 1 · 2 · bloqueo · 2 | básico | básico | — |
| 1 · 1 · 2 · 1 | básico | básico | — |
| 5 · 6 | medio | básico | — |
| 1 al cuerpo · 2 · pivote | medio | básico | — |
| 6 · 5 · 2 | medio | básico | — |
| 3 · 6 · 3 | medio | básico | — |
| 2 · 3 · 2 | medio | básico | — |
| 6 · 3 · 2 | medio | básico | — |
| 5 · 2 · 3 | medio | básico | — |
| esquiva abajo izquierda · 3 · 2 | medio | básico | — |
| 2 · 5 · 2 | medio | básico | — |
| 1 · 2 · 3 · esquiva derecha | medio | básico | — |
| esquiva derecha · 6 · 3 · pivote | medio | básico | — |
| bloqueo · 3 · 2 · paso lateral izquierda | medio | básico | — |
| 1 · 6 · 3 · 2 | medio | básico | — |
| 1 · 2 · 3 · 4 | medio | básico | — |
| 1 · 1 · 2 · 3 | medio | básico | — |
| 1 · 2 · 1 · 6 | medio | básico | — |
| 1 · 2 · esquiva abajo derecha · 4 | medio | básico | — |
| 1 · 2 · esquiva derecha · 2 | medio | básico | — |
| 1 · 2 · paso atrás · 2 | medio | básico | — |
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
| 3 · 2 · esquiva abajo derecha · 4 · 3 | avanzado | medio | — |
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
