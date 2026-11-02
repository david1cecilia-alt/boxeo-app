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
Los clásicos 1-2-3-2, 1-3-2, 1-2-5-2, 1-2-1-2, 3-2-3, 1-2-3, 1-1-2 están en básico sin defensa.

### Cuántas veces sale cada una

| Nivel | Combinaciones | Se dicen por sesión Amateur 3×3 (mín · media · máx) | Veces que sale cada una (media) | Con 25 | Con 15 |
|---|---|---|---|---|---|
| básico | 50 | 50 · 73 · 100 | 1,5 | 2,9 | 4,9 |
| medio | 50 | 38 · 52 · 66 | 1,0 | 2,1 | 3,4 |
| avanzado | 50 | 28 · 34 · 42 | 0,7 | 1,4 | 2,3 |

Sale de simular 60 sesiones Amateur por nivel (ritmos 1, 3 y 5) con estas combinaciones, sorteando solo de su
nivel y sin repetir ninguna de las 5 últimas. Las columnas «Con 25» y «Con 15» dicen cuántas veces saldría cada
una si el nivel tuviera solo 25 o 15 combinaciones.

### Balance de golpes, defensas y salidas

Comprobado por el script (en total y en cada nivel para los golpes a la cara): cada golpe a la cara dentro de su
rango; cada golpe al cuerpo, al menos 6 veces; cada defensa, al menos 12; derecha e izquierda de
cada defensa con lado, a menos de un 20 % de diferencia; cada salida, al menos 6; de las
que empiezan por golpe, al menos el 50 % empiezan con el jab; como mucho el 10 % de
todas empiezan con 5 o 6 (a la cara o al cuerpo).

**Cómo empiezan:** 78 de 150 empiezan por golpe y, de ellas, 57 con el jab (73 %). Empiezan con 5 o 6: 4 (3 % de todas).

**Golpes a la cara** (% sobre los golpes a la cara)

| Golpe | Rango | Veces | Total | Básico | Medio | Avanzado |
|---|---|---|---|---|---|---|
| 1 jab | 20-30 % | 127 | 25,2 % | 27,2 % | 24,7 % | 24,7 % |
| 2 recto | 18-26 % | 115 | 22,8 % | 22,3 % | 22,2 % | 23,4 % |
| 3 crochet adelantado | 14-20 % | 85 | 16,9 % | 18,4 % | 16,0 % | 16,7 % |
| 4 crochet trasero | 8-14 % | 60 | 11,9 % | 10,7 % | 13,0 % | 11,7 % |
| 5 gancho adelantado | 8-14 % | 60 | 11,9 % | 11,7 % | 12,3 % | 11,7 % |
| 6 gancho trasero | 8-14 % | 57 | 11,3 % | 9,7 % | 11,7 % | 11,7 % |

**Golpes al cuerpo**

| Golpe | Veces |
|---|---|
| 1 al cuerpo | 14 |
| 2 al cuerpo | 9 |
| 3 al cuerpo | 12 |
| 4 al cuerpo | 8 |
| 5 al cuerpo | 9 |
| 6 al cuerpo | 9 |

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
| 1 | jab-crochet y esquiva abajo derecha | base | 1 · 3 · esquiva abajo derecha | 3 | 2 | 1 | — | final | básico | nueva |
| 2 | jab-crochet y esquiva abajo izquierda | variante de #1 | 1 · 3 · esquiva abajo izquierda | 3 | 2 | 1 | — | final | básico | nueva |
| 3 | jab-crochet, esquiva abajo y gancho-crochet | crece de #1 | 1 · 3 · esquiva abajo derecha · 6 · 4 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 4 | jab-crochet, esquiva abajo y crochet-recto | variante de #3 | 1 · 3 · esquiva abajo derecha · 4 · 2 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 5 | esquiva abajo, gancho-crochet, cambio de ángulo y crochet | crece de #3 | 1 · 3 · esquiva abajo derecha · 6 · 4 · cambio de ángulo · 3 | 7 | 5 | 1 | cambio de ángulo | entre golpes | avanzado | nueva |
| 6 | esquiva abajo, gancho-crochet, pivote y crochet | variante de #5 | 1 · 3 · esquiva abajo derecha · 6 · 4 · pivote · 3 | 7 | 5 | 1 | pivote | entre golpes | avanzado | nueva |

### F2. Jab-recto

La base de todo, a la que se le añaden esquivas y contras.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 7 | jab-recto | base | 1 · 2 | 2 | 2 | 0 | — | — | básico | se queda (antes básico) |
| 8 | doble jab y recto | variante de #7 | 1 · 1 · 2 | 3 | 3 | 0 | — | — | básico | se queda (antes básico) |
| 9 | jab-recto, esquiva y gancho-recto | crece de #7 | 1 · 2 · esquiva izquierda · 5 · 2 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 10 | doble jab-recto, esquiva y gancho | variante de #9 | 1 · 1 · 2 · esquiva derecha · 6 | 5 | 4 | 1 | — | entre golpes | medio | cambia: amplía «1-1-2» |
| 11 | jab-recto con esquiva, esquiva abajo, jab y paso lateral | crece de #9 | 1 · 2 · esquiva izquierda · 5 · 2 · esquiva abajo derecha · 1 · paso lateral izquierda | 8 | 5 | 2 | paso lateral izquierda | entre golpes | avanzado | nueva |
| 12 | doble jab-recto, esquiva, gancho-crochet, bloqueo y gancho | variante de #11 | 1 · 1 · 2 · esquiva derecha · 6 · 3 · bloqueo · 6 | 8 | 6 | 2 | — | entre golpes | avanzado | cambia: amplía «1-1-2» |

### F3. Ballesteo y contra

Se saca la cara hacia atrás y se contesta.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 13 | ballesteo y recto | base | ballesteo · 2 | 2 | 1 | 1 | — | inicio | básico | nueva |
| 14 | ballesteo, jab y crochet de derecha | variante de #13 | ballesteo · 1 · 4 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 15 | jab, ballesteo, recto y doble crochet | crece de #13 | 1 · ballesteo · 2 · 3 · 4 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 16 | ballesteo, jab-crochet, esquiva abajo y crochet | variante de #15 | ballesteo · 1 · 4 · esquiva abajo izquierda · 3 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 17 | dos ballesteos, gancho y pivote | crece de #15 | 1 · ballesteo · 2 · 3 · 4 · ballesteo · 5 · pivote | 8 | 5 | 2 | pivote | entre golpes | avanzado | nueva |
| 18 | ballesteo, esquiva abajo, flexión y paso lateral | variante de #17 | ballesteo · 1 · 4 · esquiva abajo izquierda · 3 · flexión · 4 al cuerpo · 3 · paso lateral derecha | 9 | 5 | 3 | paso lateral derecha | inicio, entre golpes | avanzado | nueva |

### F4. Parada y contra

Se para el jab con la derecha y se contesta.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 19 | parada y jab-recto | base | parada · 1 · 2 | 3 | 2 | 1 | — | inicio | básico | se queda (antes básico) |
| 20 | parada, gancho-crochet y bloqueo | variante de #19 | parada · 6 · 3 · bloqueo | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 21 | parada, jab-recto, esquiva y doble crochet | crece de #19 | parada · 1 · 2 · esquiva derecha · 4 · 3 | 6 | 4 | 2 | — | inicio, entre golpes | medio | cambia: amplía «parada-1-2» |
| 22 | parada, bloqueo, jab y gancho | variante de #21 | parada · 6 · 3 · bloqueo · 1 · 6 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 23 | parada, esquiva, bloqueo y gancho-recto | crece de #21 | parada · 1 · 2 · esquiva derecha · 4 · 3 · bloqueo · 5 · 2 | 9 | 6 | 3 | — | inicio, entre golpes | avanzado | cambia: amplía «parada-1-2» |
| 24 | parada, esquiva, paso atrás, jab-recto y paso lateral | variante de #23 | parada · 1 · 2 · esquiva derecha · 4 · 3 · paso atrás · 1 · 2 · paso lateral izquierda | 10 | 6 | 3 | paso lateral izquierda | inicio, entre golpes | avanzado | cambia: amplía «parada-1-2» |

### F5. Abajo y arriba

Golpes al cuerpo para bajar la guardia del rival y subir a la cara.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 25 | jab al cuerpo y recto | base | 1 al cuerpo · 2 | 2 | 2 | 0 | — | — | básico | nueva |
| 26 | gancho y crochet abajo y arriba | variante de #25 | 6 · 3 al cuerpo · 3 | 3 | 3 | 0 | — | — | básico | nueva |
| 27 | jab al cuerpo, recto, flexión y crochet abajo y arriba | crece de #25 | 1 al cuerpo · 2 · flexión · 3 al cuerpo · 3 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 28 | crochet abajo y arriba, flexión y jab-recto | variante de #27 | 6 · 3 al cuerpo · 3 · flexión · 1 · 2 | 6 | 5 | 1 | — | entre golpes | medio | nueva |
| 29 | flexión, crochet abajo y arriba, esquiva abajo, crochet al cuerpo y gancho | crece de #27 | 1 al cuerpo · 2 · flexión · 3 al cuerpo · 3 · esquiva abajo derecha · 4 al cuerpo · 6 | 8 | 6 | 2 | — | entre golpes | avanzado | nueva |
| 30 | crochet abajo y arriba, flexión, bloqueo y gancho | variante de #29 | 6 · 3 al cuerpo · 3 · flexión · 1 · 2 · bloqueo · 6 | 8 | 6 | 2 | — | entre golpes | avanzado | nueva |

### F6. Esquiva a los dos lados

Esquiva lateral, se suelta y se vuelve a esquivar.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 31 | esquiva derecha, dos ganchos y esquiva izquierda | base | esquiva derecha · 6 · 5 · esquiva izquierda | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 32 | esquiva izquierda, gancho-crochet y esquiva derecha | variante de #31 | esquiva izquierda · 5 · 4 · esquiva derecha | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 33 | esquivas a los dos lados con ganchos y jab-recto | crece de #31 | esquiva derecha · 6 · 5 · esquiva izquierda · 1 · 2 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 34 | esquivas a los dos lados, gancho y bloqueo | variante de #33 | esquiva izquierda · 5 · 4 · esquiva derecha · 6 · bloqueo | 6 | 3 | 3 | — | inicio, entre golpes, final | medio | nueva |
| 35 | esquivas a los dos lados, esquiva abajo y crochet-gancho | crece de #33 | esquiva derecha · 6 · 5 · esquiva izquierda · 1 · 2 · esquiva abajo derecha · 4 · 5 | 9 | 6 | 3 | — | inicio, entre golpes | avanzado | cambia: amplía «1-2-esquiva abajo-4» |
| 36 | esquivas, bloqueo, gancho-recto y pivote | variante de #35 | esquiva izquierda · 5 · 4 · esquiva derecha · 6 · bloqueo · 5 · 2 · pivote | 9 | 5 | 3 | pivote | inicio, entre golpes | avanzado | nueva |

### F7. Bloqueo

Bloquear, devolver y, si toca, volver a bloquear.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 37 | bloqueo y crochet-recto | base | bloqueo · 3 · 2 | 3 | 2 | 1 | — | inicio | básico | se queda (antes básico) |
| 38 | bloqueo, gancho-recto y bloqueo | variante de #37 | bloqueo · 5 · 2 · bloqueo | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 39 | jab-recto y bloqueo | variante de #37 | 1 · 2 · bloqueo | 3 | 2 | 1 | — | final | básico | nueva |
| 40 | jab, bloqueo, crochet-recto, paso atrás y recto | crece de #37 | 1 · bloqueo · 3 · 2 · paso atrás · 2 | 6 | 4 | 2 | — | entre golpes | medio | cambia: amplía «bloqueo-3-2» |
| 41 | dos bloqueos, jab y crochet | variante de #40 | bloqueo · 5 · 2 · bloqueo · 1 · 4 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 42 | bloqueo, paso atrás, esquiva, crochet y paso lateral | crece de #40 | 1 · bloqueo · 3 · 2 · paso atrás · 2 · esquiva derecha · 4 · paso lateral derecha | 9 | 5 | 3 | paso lateral derecha | entre golpes | avanzado | cambia: amplía «bloqueo-3-2» |
| 43 | dos bloqueos, esquiva, gancho, ballesteo y recto | variante de #42 | bloqueo · 5 · 2 · bloqueo · 1 · 4 · esquiva izquierda · 5 · ballesteo · 2 | 10 | 6 | 4 | — | inicio, entre golpes | avanzado | nueva |

### F8. Paso atrás y contra

Se rompe la distancia y se contesta.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 44 | paso atrás y recto | base | paso atrás · 2 | 2 | 1 | 1 | — | inicio | básico | se queda (antes básico) |
| 45 | paso atrás, jab-crochet y paso atrás | variante de #44 | paso atrás · 1 · 4 · paso atrás | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 46 | doble jab, paso atrás y recto-gancho | crece de #44 | 1 · 1 · paso atrás · 2 · 5 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 47 | doble jab, paso atrás, recto-gancho y pivote | variante de #46 | 1 · 1 · paso atrás · 2 · 5 · pivote | 6 | 4 | 1 | pivote | entre golpes | medio | nueva |
| 48 | paso atrás, flexión, crochet al cuerpo, gancho y paso lateral | crece de #46 | 1 · 1 · paso atrás · 2 · 5 · flexión · 3 al cuerpo · 6 · paso lateral derecha | 9 | 6 | 2 | paso lateral derecha | entre golpes | avanzado | nueva |
| 49 | paso atrás, pivote, esquiva y jab-gancho | variante de #48 | 1 · 1 · paso atrás · 2 · 5 · pivote · esquiva derecha · 1 · 5 | 9 | 6 | 2 | pivote | entre golpes | avanzado | nueva |

### F9. Gancho y crochet

Ganchos (5 y 6) en la corta, rematados con crochet o recto.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 50 | gancho de derecha y crochet | base | 6 · 3 | 2 | 2 | 0 | — | — | básico | se queda (antes básico) |
| 51 | crochet, gancho y recto | variante de #50 | 4 · 5 · 2 | 3 | 3 | 0 | — | — | básico | nueva |
| 52 | jab-recto, gancho-crochet y esquiva abajo | crece de #50 | 1 · 2 · 6 · 3 · esquiva abajo izquierda | 5 | 4 | 1 | — | final | medio | nueva |
| 53 | jab-crochet-gancho-recto y esquiva abajo | variante de #52 | 1 · 4 · 5 · 2 · esquiva abajo derecha | 5 | 4 | 1 | — | final | medio | nueva |
| 54 | jab-recto, gancho-crochet, esquiva abajo, jab-recto y esquiva | crece de #52 | 1 · 2 · 6 · 3 · esquiva abajo izquierda · 1 · 2 · esquiva izquierda | 8 | 6 | 2 | — | entre golpes, final | avanzado | nueva |
| 55 | jab-crochet-gancho-recto, esquiva abajo, gancho al cuerpo y ballesteo | variante de #54 | 1 · 4 · 5 · 2 · esquiva abajo derecha · 5 al cuerpo · 3 · ballesteo | 8 | 6 | 2 | — | entre golpes, final | avanzado | nueva |

### F10. Doble jab

Doble jab para entrar, y lo que venga.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 56 | doble jab y gancho | base | 1 · 1 · 5 | 3 | 3 | 0 | — | — | básico | nueva |
| 57 | doble jab, gancho y crochet | variante de #56 | 1 · 1 · 6 · 3 | 4 | 4 | 0 | — | — | básico | nueva |
| 58 | doble jab, gancho, esquiva y crochet | crece de #56 | 1 · 1 · 5 · esquiva izquierda · 4 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 59 | doble jab, gancho-crochet, ballesteo y recto | variante de #58 | 1 · 1 · 6 · 3 · ballesteo · 2 | 6 | 5 | 1 | — | entre golpes | medio | nueva |
| 60 | doble jab, esquiva, jab, esquiva abajo y crochet-gancho | crece de #58 | 1 · 1 · 5 · esquiva izquierda · 4 · 1 · esquiva abajo derecha · 4 · 5 | 9 | 7 | 2 | — | entre golpes | avanzado | nueva |
| 61 | doble jab, ballesteo, bloqueo y jab-gancho | variante de #60 | 1 · 1 · 6 · 3 · ballesteo · 2 · bloqueo · 1 · 6 | 9 | 7 | 2 | — | entre golpes | avanzado | nueva |

### F11. Flexión y cuerpo

Se baja con flexión y se ataca al cuerpo.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 62 | flexión, crochet al cuerpo y gancho | base | flexión · 3 al cuerpo · 5 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 63 | flexión, gancho al cuerpo y crochet | variante de #62 | flexión · 6 al cuerpo · 3 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 64 | flexión, crochet al cuerpo, gancho-recto y bloqueo | crece de #62 | flexión · 3 al cuerpo · 5 · 2 · bloqueo | 5 | 3 | 2 | — | inicio, final | medio | nueva |
| 65 | flexión, gancho al cuerpo, esquiva abajo y jab-recto | variante de #64 | flexión · 6 al cuerpo · 3 · esquiva abajo derecha · 1 · 2 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 66 | flexión, bloqueo, gancho al cuerpo, crochet y esquiva | crece de #64 | flexión · 3 al cuerpo · 5 · 2 · bloqueo · 6 al cuerpo · 3 · esquiva izquierda | 8 | 5 | 3 | — | inicio, entre golpes, final | avanzado | nueva |
| 67 | dos flexiones, esquiva abajo, jab al cuerpo y recto | variante de #66 | flexión · 6 al cuerpo · 3 · esquiva abajo derecha · 1 · 2 · flexión · 1 al cuerpo · 2 | 9 | 6 | 3 | — | inicio, entre golpes | avanzado | nueva |

### F12. Esquiva abajo a los dos lados

Esquivar abajo, soltar y cambiar de lado.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 68 | esquiva abajo y crochet a los dos lados | base | esquiva abajo izquierda · 3 · esquiva abajo derecha · 4 | 4 | 2 | 2 | — | inicio, entre golpes | básico | nueva |
| 69 | esquiva abajo derecha, crochet, esquiva abajo izquierda y gancho | variante de #68 | esquiva abajo derecha · 4 · esquiva abajo izquierda · 5 | 4 | 2 | 2 | — | inicio, entre golpes | básico | nueva |
| 70 | esquivas abajo con crochet y jab-recto | crece de #68 | esquiva abajo izquierda · 3 · esquiva abajo derecha · 4 · 1 · 2 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 71 | esquivas abajo con crochet y gancho, recto y flexión | variante de #70 | esquiva abajo derecha · 4 · esquiva abajo izquierda · 5 · 2 · flexión | 6 | 3 | 3 | — | inicio, entre golpes, final | medio | nueva |
| 72 | esquivas abajo, esquiva, jab y crochet al cuerpo | crece de #70 | esquiva abajo izquierda · 3 · esquiva abajo derecha · 4 · 1 · 2 · esquiva derecha · 1 · 4 al cuerpo | 9 | 6 | 3 | — | inicio, entre golpes | avanzado | nueva |
| 73 | esquivas abajo, flexión, gancho abajo y arriba, paso atrás y recto | variante de #72 | esquiva abajo derecha · 4 · esquiva abajo izquierda · 5 · 2 · flexión · 5 al cuerpo · 5 · paso atrás · 2 | 10 | 6 | 4 | — | inicio, entre golpes | avanzado | nueva |

### F13. Jab arriba y abajo

El jab cambia de altura para abrir hueco.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 74 | jab arriba, jab abajo y gancho | base | 1 · 1 al cuerpo · 6 | 3 | 3 | 0 | — | — | básico | nueva |
| 75 | jab abajo, jab arriba y crochet | variante de #74 | 1 al cuerpo · 1 · 3 | 3 | 3 | 0 | — | — | básico | nueva |
| 76 | jab arriba y abajo, gancho, esquiva y recto | crece de #74 | 1 · 1 al cuerpo · 6 · esquiva derecha · 2 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 77 | jab abajo y arriba, crochet, paso atrás y gancho | variante de #76 | 1 al cuerpo · 1 · 3 · paso atrás · 6 | 5 | 4 | 1 | — | entre golpes | medio | nueva |
| 78 | jab arriba y abajo, esquiva, jab, bloqueo y crochet abajo y arriba | crece de #76 | 1 · 1 al cuerpo · 6 · esquiva derecha · 2 · 1 · bloqueo · 4 al cuerpo · 4 | 9 | 7 | 2 | — | entre golpes | avanzado | cambia: amplía «esquiva-2-1» |
| 79 | jab abajo y arriba, paso atrás, flexión, ganchos y paso lateral | variante de #78 | 1 al cuerpo · 1 · 3 · paso atrás · 6 · flexión · 5 al cuerpo · 6 · paso lateral izquierda | 9 | 6 | 2 | paso lateral izquierda | entre golpes | avanzado | nueva |

### F14. Parada y al cuerpo

Se para el jab y se contesta abajo.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 80 | parada, recto al cuerpo y gancho | base | parada · 2 al cuerpo · 5 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 81 | parada, jab y recto al cuerpo | variante de #80 | parada · 1 · 2 al cuerpo | 3 | 2 | 1 | — | inicio | básico | nueva |
| 82 | parada, recto al cuerpo, gancho, esquiva abajo y gancho-recto | crece de #80 | parada · 2 al cuerpo · 5 · esquiva abajo izquierda · 6 · 2 | 6 | 4 | 2 | — | inicio, entre golpes | medio | nueva |
| 83 | parada, jab, recto al cuerpo, ballesteo y crochet | variante de #82 | parada · 1 · 2 al cuerpo · ballesteo · 4 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 84 | parada, esquiva abajo, esquiva, jab y cambio de ángulo | crece de #82 | parada · 2 al cuerpo · 5 · esquiva abajo izquierda · 6 · 2 · esquiva derecha · 1 · cambio de ángulo | 9 | 5 | 3 | cambio de ángulo | inicio, entre golpes | avanzado | nueva |
| 85 | parada, ballesteo, bloqueo, jab-recto y pivote | variante de #84 | parada · 1 · 2 al cuerpo · ballesteo · 4 · bloqueo · 1 · 2 · pivote | 9 | 5 | 3 | pivote | inicio, entre golpes | avanzado | nueva |

### F15. Cambio de ángulo

Se suelta, se cambia de ángulo y se ataca desde el nuevo sitio.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 86 | jab-recto y cambio de ángulo | base | 1 · 2 · cambio de ángulo | 3 | 2 | 0 | cambio de ángulo | — | básico | nueva |
| 87 | doble crochet y cambio de ángulo | variante de #86 | 4 · 3 · cambio de ángulo | 3 | 2 | 0 | cambio de ángulo | — | básico | nueva |
| 88 | jab-recto, cambio de ángulo, gancho-recto y esquiva | crece de #86 | 1 · 2 · cambio de ángulo · 5 · 2 · esquiva izquierda | 6 | 4 | 1 | cambio de ángulo | final | medio | nueva |
| 89 | doble crochet, cambio de ángulo, gancho y paso atrás | variante de #88 | 4 · 3 · cambio de ángulo · 5 · paso atrás | 5 | 3 | 1 | cambio de ángulo | final | medio | nueva |
| 90 | cambio de ángulo, esquiva, gancho, bloqueo y gancho | crece de #88 | 1 · 2 · cambio de ángulo · 5 · 2 · esquiva izquierda · 5 · bloqueo · 6 | 9 | 6 | 2 | cambio de ángulo | entre golpes | avanzado | nueva |
| 91 | cambio de ángulo, paso atrás, esquiva abajo y paso lateral | variante de #90 | 4 · 3 · cambio de ángulo · 5 · paso atrás · 1 · esquiva abajo derecha · 4 · paso lateral izquierda | 9 | 5 | 2 | cambio de ángulo, paso lateral izquierda | entre golpes | avanzado | nueva |

### F16. Pivote

Se suelta y se pivota para no quedarse delante.

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 92 | crochet-gancho y pivote | base | 3 · 6 · pivote | 3 | 2 | 0 | pivote | — | básico | nueva |
| 93 | doble crochet y pivote | variante de #92 | 4 · 3 · pivote | 3 | 2 | 0 | pivote | — | básico | nueva |
| 94 | bloqueo, crochet-gancho, pivote y jab | crece de #92 | bloqueo · 3 · 6 · pivote · 1 | 5 | 3 | 1 | pivote | inicio | medio | nueva |
| 95 | doble crochet, pivote, esquiva abajo y gancho | variante de #94 | 4 · 3 · pivote · esquiva abajo derecha · 6 | 5 | 3 | 1 | pivote | entre golpes | medio | nueva |
| 96 | bloqueo, pivote, esquiva, jab, ballesteo y gancho | crece de #94 | bloqueo · 3 · 6 · pivote · 1 · esquiva izquierda · 1 · ballesteo · 6 | 9 | 5 | 3 | pivote | inicio, entre golpes | avanzado | nueva |
| 97 | doble crochet, pivote, esquiva abajo, flexión y esquiva | variante de #96 | 4 · 3 · pivote · esquiva abajo derecha · 6 · 3 · flexión · 6 al cuerpo · esquiva derecha | 9 | 5 | 3 | pivote | entre golpes, final | avanzado | nueva |

## Sueltas

### Básico

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 98 | jab-recto-crochet-recto | — | 1 · 2 · 3 · 2 | 4 | 4 | 0 | — | — | básico | se queda (antes medio) |
| 99 | jab-crochet-recto | — | 1 · 3 · 2 | 3 | 3 | 0 | — | — | básico | se queda (antes medio) |
| 100 | jab-recto-gancho-recto | — | 1 · 2 · 5 · 2 | 4 | 4 | 0 | — | — | básico | se queda (antes medio) |
| 101 | jab-recto-jab-recto | — | 1 · 2 · 1 · 2 | 4 | 4 | 0 | — | — | básico | se queda (antes básico) |
| 102 | crochet-recto-crochet | — | 3 · 2 · 3 | 3 | 3 | 0 | — | — | básico | se queda (antes medio) |
| 103 | jab-recto-crochet | — | 1 · 2 · 3 | 3 | 3 | 0 | — | — | básico | se queda (antes básico) |
| 104 | esquiva izquierda y gancho-recto | — | esquiva izquierda · 5 · 2 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 105 | jab, gancho al cuerpo, crochet y bloqueo | — | 1 · 5 al cuerpo · 4 · bloqueo | 4 | 3 | 1 | — | final | básico | nueva |
| 106 | esquiva derecha y gancho-crochet | — | esquiva derecha · 6 · 3 | 3 | 2 | 1 | — | inicio | básico | nueva |
| 107 | jab, esquiva, gancho y ballesteo | — | 1 · esquiva derecha · 6 · ballesteo | 4 | 2 | 2 | — | entre golpes, final | básico | nueva |
| 108 | paso atrás, jab-gancho y bloqueo | — | paso atrás · 1 · 6 · bloqueo | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 109 | esquiva y crochet, esquiva y gancho | — | esquiva derecha · 4 · esquiva izquierda · 5 | 4 | 2 | 2 | — | inicio, entre golpes | básico | nueva |
| 110 | flexión, gancho al cuerpo, recto y bloqueo | — | flexión · 5 al cuerpo · 2 · bloqueo | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 111 | parada, jab y esquiva abajo | — | parada · 1 · esquiva abajo derecha | 3 | 1 | 2 | — | inicio, final | básico | nueva |
| 112 | esquiva abajo, crochet al cuerpo, gancho y paso atrás | — | esquiva abajo izquierda · 4 al cuerpo · 5 · paso atrás | 4 | 2 | 2 | — | inicio, final | básico | nueva |
| 113 | jab, ballesteo, recto y flexión | — | 1 · ballesteo · 2 · flexión | 4 | 2 | 2 | — | entre golpes, final | básico | nueva |
| 114 | esquiva, gancho al cuerpo, crochet y esquiva | — | esquiva izquierda · 6 al cuerpo · 4 · esquiva derecha | 4 | 2 | 2 | — | inicio, final | básico | nueva |

### Medio

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 115 | jab-recto, doble crochet y esquiva | — | 1 · 2 · 4 · 3 · esquiva izquierda | 5 | 4 | 1 | — | final | medio | nueva |
| 116 | esquiva, recto-gancho, esquiva abajo, jab y pivote | — | esquiva derecha · 2 · 5 · esquiva abajo izquierda · 1 · pivote | 6 | 3 | 2 | pivote | inicio, entre golpes | medio | nueva |
| 117 | jab-recto, bloqueo, gancho-crochet y esquiva | — | 1 · 2 · bloqueo · 6 · 3 · esquiva izquierda | 6 | 4 | 2 | — | entre golpes, final | medio | nueva |
| 118 | flexión, recto al cuerpo, doble crochet y paso atrás | — | flexión · 2 al cuerpo · 3 · 4 · paso atrás | 5 | 3 | 2 | — | inicio, final | medio | nueva |
| 119 | parada, jab, esquiva abajo y gancho-recto | — | parada · 1 · esquiva abajo izquierda · 5 · 2 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 120 | ballesteo, recto-crochet, esquiva abajo y gancho | — | ballesteo · 2 · 3 · esquiva abajo izquierda · 6 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 121 | jab al cuerpo, recto, bloqueo, crochet y esquiva | — | 1 al cuerpo · 2 · bloqueo · 4 · esquiva derecha | 5 | 3 | 2 | — | entre golpes, final | medio | nueva |
| 122 | paso atrás, recto-gancho, flexión y crochet al cuerpo | — | paso atrás · 2 · 5 · flexión · 3 al cuerpo | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 123 | esquiva, gancho al cuerpo, crochet, ballesteo y jab | — | esquiva izquierda · 5 al cuerpo · 3 · ballesteo · 1 | 5 | 3 | 2 | — | inicio, entre golpes | medio | nueva |
| 124 | jab, esquiva abajo, crochet-gancho, bloqueo y paso lateral | — | 1 · esquiva abajo izquierda · 3 · 5 · bloqueo · paso lateral derecha | 6 | 3 | 2 | paso lateral derecha | entre golpes, final | medio | nueva |
| 125 | dos bloqueos con crochet, esquiva y gancho | — | bloqueo · 4 · bloqueo · 3 · esquiva derecha · 6 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 126 | esquiva, gancho, esquiva abajo, crochet, ballesteo y recto | — | esquiva izquierda · 5 · esquiva abajo derecha · 4 · ballesteo · 2 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 127 | jab, esquivas a los dos lados con ganchos y esquiva abajo | — | 1 · esquiva derecha · 6 · esquiva izquierda · 5 · esquiva abajo izquierda | 6 | 3 | 3 | — | entre golpes, final | medio | nueva |
| 128 | flexión, jab-recto, esquiva abajo, gancho y bloqueo | — | flexión · 1 · 2 · esquiva abajo izquierda · 5 · bloqueo | 6 | 3 | 3 | — | inicio, entre golpes, final | medio | nueva |
| 129 | parada, jab, paso atrás, recto, flexión y crochet al cuerpo | — | parada · 1 · paso atrás · 2 · flexión · 4 al cuerpo | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 130 | esquiva abajo, gancho al cuerpo, crochet, esquiva, bloqueo y crochet | — | esquiva abajo izquierda · 6 al cuerpo · 3 · esquiva derecha · bloqueo · 4 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 131 | ballesteo, recto, flexión, recto al cuerpo, esquiva abajo y crochet | — | ballesteo · 2 · flexión · 2 al cuerpo · esquiva abajo izquierda · 3 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |
| 132 | paso atrás, jab, esquiva, crochet, bloqueo y gancho | — | paso atrás · 1 · esquiva derecha · 4 · bloqueo · 6 | 6 | 3 | 3 | — | inicio, entre golpes | medio | nueva |

### Avanzado

| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel | Respecto a la actual |
|---|---|---|---|---|---|---|---|---|---|---|
| 133 | jab-recto-crochet-gancho, esquiva, recto-crochet y paso lateral | — | 1 · 2 · 3 · 6 · esquiva derecha · 2 · 3 · paso lateral izquierda | 8 | 6 | 1 | paso lateral izquierda | entre golpes | avanzado | cambia: amplía «1-2-3-6» |
| 134 | jab, crochet al cuerpo, recto-crochet, gancho-recto y bloqueo | — | 1 · 4 al cuerpo · 2 · 3 · 5 · 2 · bloqueo | 7 | 6 | 1 | — | final | avanzado | nueva |
| 135 | jab-recto-crochet, esquiva abajo, gancho al cuerpo y cambio de ángulo | — | 1 · 2 · 4 · esquiva abajo izquierda · 5 al cuerpo · 3 · 2 · cambio de ángulo | 8 | 6 | 1 | cambio de ángulo | entre golpes | avanzado | nueva |
| 136 | jab-recto, esquiva, esquiva abajo y paso atrás con contra | — | 1 · 2 · esquiva derecha · 4 · 3 · esquiva abajo izquierda · 5 · paso atrás · 2 | 9 | 6 | 3 | — | entre golpes | avanzado | nueva |
| 137 | bloqueo, jab-recto, flexión, crochet al cuerpo, jab, esquiva y gancho | — | bloqueo · 1 · 2 · flexión · 3 al cuerpo · 1 · esquiva izquierda · 6 | 8 | 5 | 3 | — | inicio, entre golpes | avanzado | nueva |
| 138 | parada, jab-recto-crochet, ballesteo, esquiva abajo y paso lateral | — | parada · 1 · 2 · 3 · ballesteo · 2 · esquiva abajo derecha · 4 · paso lateral derecha | 9 | 5 | 3 | paso lateral derecha | inicio, entre golpes | avanzado | cambia: amplía «1-2-3» |
| 139 | jab, gancho al cuerpo, esquiva abajo, bloqueo, esquiva y paso lateral | — | 1 · 6 al cuerpo · 3 · esquiva abajo izquierda · 3 · bloqueo · 2 · esquiva izquierda · paso lateral izquierda | 9 | 5 | 3 | paso lateral izquierda | entre golpes, final | avanzado | nueva |
| 140 | esquiva, flexión con jab al cuerpo, paso atrás, jab y paso lateral | — | esquiva derecha · 2 · 3 · flexión · 1 al cuerpo · 6 · paso atrás · 1 · paso lateral derecha | 9 | 5 | 3 | paso lateral derecha | inicio, entre golpes | avanzado | cambia: amplía «esquiva-2-3» |
| 141 | jab al cuerpo, bloqueo, gancho, esquiva abajo, crochet-jab y ballesteo | — | 1 al cuerpo · 2 · bloqueo · 6 · esquiva abajo izquierda · 3 · 1 · ballesteo | 8 | 5 | 3 | — | entre golpes, final | avanzado | nueva |
| 142 | doble jab, esquiva, bloqueo, gancho al cuerpo y esquiva abajo | — | 1 · 1 · esquiva izquierda · 2 · 5 · bloqueo · 5 al cuerpo · 4 · esquiva abajo derecha | 9 | 6 | 3 | — | entre golpes, final | avanzado | nueva |
| 143 | esquivas y esquivas abajo a los dos lados y cambio de ángulo | — | esquiva derecha · 2 · esquiva izquierda · 3 · esquiva abajo derecha · 4 · esquiva abajo izquierda · 5 · cambio de ángulo | 9 | 4 | 4 | cambio de ángulo | inicio, entre golpes | avanzado | nueva |
| 144 | bloqueo, flexión con recto al cuerpo, ballesteo y paso atrás | — | 1 · bloqueo · 2 · flexión · 2 al cuerpo · ballesteo · 6 · paso atrás | 8 | 4 | 4 | — | entre golpes, final | avanzado | nueva |
| 145 | cinco defensas, cada una con su contra | — | parada · 1 · esquiva derecha · 2 · esquiva abajo izquierda · 3 · esquiva abajo derecha · 4 · ballesteo · 4 | 10 | 5 | 5 | — | inicio, entre golpes | avanzado | nueva |
| 146 | dos bloqueos, esquiva, gancho, flexión y crochet al cuerpo | — | bloqueo · 1 · bloqueo · 2 · esquiva izquierda · 5 · flexión · 3 al cuerpo | 8 | 4 | 4 | — | inicio, entre golpes | avanzado | nueva |
| 147 | esquiva abajo, esquiva, paso atrás, jab al cuerpo, gancho y ballesteo | — | esquiva abajo izquierda · 3 · esquiva derecha · 2 · paso atrás · 1 al cuerpo · 6 · ballesteo | 8 | 4 | 4 | — | inicio, entre golpes, final | avanzado | nueva |
| 148 | esquiva, esquiva abajo, flexión con gancho y bloqueo | — | 1 · esquiva izquierda · 4 al cuerpo · 2 · esquiva abajo derecha · 3 · flexión · 5 · bloqueo | 9 | 5 | 4 | — | entre golpes, final | avanzado | nueva |
| 149 | ballesteo, esquiva, esquiva abajo y paso atrás con jab | — | ballesteo · 2 · esquiva derecha · 6 al cuerpo · 3 · esquiva abajo izquierda · 4 · paso atrás · 1 | 9 | 5 | 4 | — | inicio, entre golpes | avanzado | nueva |
| 150 | flexión, bloqueo, esquiva, esquiva abajo y cambio de ángulo | — | flexión · 5 al cuerpo · bloqueo · 2 · esquiva izquierda · 3 · esquiva abajo derecha · 6 · cambio de ángulo | 9 | 4 | 4 | cambio de ángulo | inicio, entre golpes | avanzado | nueva |

## Las de la biblioteca actual que salen

De las 83 de hoy se quedan 12 y salen 71. Las que salen, con su nivel de hoy, el que les daría `nivel_de` y si alguna nueva las amplía:

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
| esquiva derecha · 2 · 3 | básico | básico | sí |
| esquiva izquierda · 3 · 2 | básico | básico | — |
| bloqueo · 2 · 3 | básico | básico | — |
| 1 · 2 · 1 | básico | básico | — |
| 1 · 2 · 5 | básico | básico | — |
| esquiva derecha · 2 · 1 | básico | básico | sí |
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
| 1 · 2 · esquiva abajo derecha · 4 | medio | básico | sí |
| 1 · 2 · esquiva derecha · 2 | medio | básico | — |
| 1 · 2 · paso atrás · 2 | medio | básico | — |
| bloqueo · 2 · 3 · 2 | medio | básico | — |
| 1 · 2 · 3 · 6 | medio | básico | sí |
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
