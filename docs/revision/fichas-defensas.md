# Fichas de Aprende: defensas y salidas (borrador)

Borrador para la pestaña Aprende (bloque 2). Redactado en el chat el 03-11-2026.
**TODO el contenido técnico va marcado REVISAR CON ENTRENADOR** hasta que Iván lo vea.

Criterios de redacción:
- Idea de Iván: el boxeo es situacional. Nada de «siempre X»: cada ficha dice *cuándo suele servir*, no una regla fija.
- Guardia de referencia: barbilla al pecho (bajada), manos arriba, codos cerrados.
- Español de España. El término en inglés solo entre paréntesis, para buscar vídeos.
- Los textos de «Cómo se hace» están pensados para un diestro (ortodoxo). **En zurdo cambia cuál de tus manos y de tus pies va delante; lo que se refiere al rival no se invierte:** su hígado sigue en su lado derecho y su crochet de izquierda te sigue llegando por tu derecha.
- Los identificadores (`id`) hay que comprobarlos contra `data/acciones.json`; aquí van los que se esperan.
- **Lo que se ve y «Mostrar más»:** a la vista solo van Qué es (1–2 frases), Cómo se hace (máximo 4 pasos) y Errores típicos (máximo 3, los que más castigan). Plegado en **«Mostrar más»** van Cuándo suele servir, Ventajas, Inconvenientes, las notas (derecha o izquierda…) y el nombre en inglés, una línea cada uno. Las fuentes no salen en la app: están al final de este documento.
- Versión corta (10-11-2026): solo se ha acortado, sin técnica nueva. Lo que se quitó sigue en el historial de git de este documento.

---

## 1. Esquiva (derecha / izquierda)
- **id esperado:** `esquiva_der`, `esquiva_izq`
- **Qué es:** apartar la cabeza un palmo hacia un lado para que el golpe pase sin tocarte, con las manos libres para devolver.
- **Cómo se hace:**
  1. Gira un poco el tronco y flexiona algo la rodilla del lado al que vas.
  2. Mueve la cabeza lo justo para salir de la línea, sin dejar de mirar al rival.
  3. Las manos se quedan en guardia.
  4. Vuelve al centro o devuelve desde ahí.
- **Errores típicos:**
  - Moverte demasiado: pierdes el equilibrio y tardas en volver.
  - Bajar las manos.
  - Dejar de mirar al rival.
- **Mostrar más:**
  - **Cuándo suele servir:** contra golpes rectos (jab y recto); cuesta más contra los curvos y no sirve para los golpes al cuerpo.
  - **Ventajas:** no recibes nada y el rival queda abierto tras fallar.
  - **Inconvenientes:** pide buena vista; si te amagan o fallas el lado, recibes el golpe de lleno.
  - **Derecha o izquierda:** el lado es hacia dónde va la cabeza: en la esquiva derecha te apartas hacia tu derecha.
  - **En inglés:** slip
- **REVISAR CON ENTRENADOR:** cuánto se gira el tronco y si la rodilla se flexiona en la esquiva lateral.

## 2. Rueda (derecha / izquierda)
- **id:** `rodar_der`, `rodar_izq` (en el borrador se esperaba `esquiva_abajo_*`)
- **Qué es:** bajar flexionando las piernas y pasar por debajo del golpe en «U», para subir al otro lado del brazo del rival.
- **Cómo se hace:**
  1. Ve venir el crochet.
  2. Baja flexionando las rodillas, no la espalda.
  3. Pasa en «U» por debajo del brazo que golpea.
  4. Sube al otro lado con la guardia puesta, listo para devolver.
- **Errores típicos:**
  - Doblar la cintura: pierdes el equilibrio y te expones al gancho.
  - Bajar la vista o las manos.
  - Bajar más de lo necesario.
- **Mostrar más:**
  - **Cuándo suele servir:** contra el crochet a la cabeza; te deja cerca del rival y en ángulo para golpear.
  - **Ventajas:** neutraliza golpes fuertes y te deja listo para contraatacar.
  - **Inconvenientes:** cansa las piernas; si el rival la espera, puede responder con un gancho.
  - **Derecha o izquierda:** en la rueda derecha bajas y sales hacia tu derecha, contra el crochet de su mano izquierda; la izquierda, al revés.
  - **En inglés:** roll, bob and weave
- **REVISAR CON ENTRENADOR:** el nombre («rueda», antes «esquiva abajo»; también «rotativa»…; Iván no lo ha confirmado) y si en su escuela se distingue de la flexión. El lado es hacia dónde va el cuerpo (decidido el 04-11-2026, también por revisar). Y contra qué crochet va cada lado: rueda derecha contra su mano izquierda, rueda izquierda contra su derecha.

## 3. Ballesteo
- **id esperado:** `ballesteo`
- **Qué es:** echar el tronco y la cabeza hacia atrás para que el golpe se quede corto, sin mover los pies (o con un paso muy corto).
- **Cómo se hace:**
  1. Pasa algo de peso a la pierna de atrás.
  2. Echa el tronco atrás lo justo para que el golpe no llegue.
  3. Barbilla abajo y manos arriba.
  4. Vuelve hacia delante: esa vuelta puede ser ya tu golpe.
- **Errores típicos:**
  - Echarte demasiado atrás: pierdes el equilibrio y no puedes devolver.
  - Levantar la barbilla.
  - Usarlo contra golpes largos que te siguen alcanzando.
- **Mostrar más:**
  - **Cuándo suele servir:** contra el jab o golpes rectos a la cara, cuando quieres quedarte a distancia para devolver con un recto.
  - **Ventajas:** rápido y sencillo; te deja a la distancia justa para contraatacar.
  - **Inconvenientes:** si el rival da un paso adelante o encadena golpes, te alcanza.
  - **En inglés:** pull back, lean back
- **REVISAR CON ENTRENADOR:** si Iván lo llama así, si va con paso o solo con el cuerpo, y si es adecuado para un principiante.

## 4. Flexión
- **id esperado:** `flexion`
- **Qué es:** bajar recto flexionando las piernas para que el golpe pase por encima de la cabeza, sin irte hacia ningún lado.
- **Cómo se hace:**
  1. Flexiona las rodillas con la espalda recta.
  2. Baja lo justo para que el golpe pase por encima.
  3. Manos arriba y mirada al rival.
  4. Sube enseguida o golpea al cuerpo desde abajo.
- **Errores típicos:**
  - Doblar la cintura en lugar de las piernas.
  - Bajar la cabeza por debajo de la cintura del rival.
  - Quedarte abajo demasiado tiempo.
- **Mostrar más:**
  - **Cuándo suele servir:** contra golpes a la altura de la cabeza (crochets amplios, golpes por encima).
  - **Ventajas:** sencilla y te deja cerca del cuerpo del rival.
  - **Inconvenientes:** te expone al gancho y cansa las piernas.
  - **Diferencia con la rueda:** es como la rueda, pero sin el movimiento en «U».
  - **En inglés:** duck
- **REVISAR CON ENTRENADOR:** la definición es nuestra, no de Iván. Confirmar qué entiende él por «flexión» y en qué se diferencia de la rueda.

## 5. Bloqueo
- **id esperado:** `bloqueo`
- **Qué es:** recibir el golpe en los guantes, los antebrazos o los codos en vez de en la cara o el cuerpo.
- **Cómo se hace:**
  1. Guardia cerrada: guantes junto a la cara y codos pegados al cuerpo.
  2. Recibe con el guante o el antebrazo del lado por el que viene.
  3. Al cuerpo, baja un poco el codo para cubrir las costillas.
  4. No te quedes encerrado: devuelve en cuanto acabe el golpe.
- **Errores típicos:**
  - Cerrar los ojos.
  - Quedarte encerrado sin devolver.
  - Apartar el guante de la cara al recibir.
- **Mostrar más:**
  - **Cuándo suele servir:** casi contra cualquier golpe, también al cuerpo; es la defensa más fácil y la base para empezar.
  - **Ventajas:** fácil, gasta poco y te deja a distancia para devolver.
  - **Inconvenientes:** recibes parte de la fuerza; un rival que pega fuerte o mucho te va empujando.
  - **En inglés:** block, cover
- **REVISAR CON ENTRENADOR:** cómo quiere Iván que se bloquee el crochet (guante a la sien, codo arriba…).

## 6. Parada
- **id esperado:** `parada`
- **Qué es:** desviar el golpe con un toque corto del guante para sacarlo de la línea, en vez de aguantarlo.
- **Cómo se hace:**
  1. Usa la mano de atrás para el jab del rival.
  2. Toque corto, lateral o hacia abajo, sin alejar la mano de la cara.
  3. La cabeza puede apartarse un poco a la vez.
  4. Con su brazo desviado, devuelve.
- **Errores típicos:**
  - Salir al encuentro del golpe con la mano (te abres).
  - Hacer un movimiento demasiado grande.
  - Picar en los amagos.
- **Mostrar más:**
  - **Cuándo suele servir:** contra golpes rectos, sobre todo el jab; funciona peor contra los curvos y al cuerpo.
  - **Ventajas:** gasta poco y descoloca al rival, que tarda más en recoger el brazo.
  - **Inconvenientes:** pide coordinación; si te amagan, dejas la cara descubierta.
  - **En inglés:** parry, catch
- **REVISAR CON ENTRENADOR:** dirección del desvío (lateral o hacia abajo) que prefiere Iván.

## 7. Paso atrás
- **id esperado:** `paso_atras`
- **Qué es:** retroceder con un paso para quedar fuera del alcance del golpe.
- **Cómo se hace:**
  1. Empuja con el pie de delante y mueve primero el de atrás.
  2. El de delante lo sigue, hasta la distancia de tu guardia.
  3. Sin cruzar los pies ni saltar.
  4. Guardia puesta durante todo el paso.
- **Errores típicos:**
  - Retroceder en línea recta una y otra vez: te acaban arrinconando.
  - Cruzar los pies.
  - Echar el peso atrás y quedarte sin poder devolver.
- **Mostrar más:**
  - **Cuándo suele servir:** contra casi cualquier golpe que veas venir con tiempo; luego, según la distancia, respondes con recto, crochet o gancho.
  - **Ventajas:** evita el golpe del todo.
  - **Inconvenientes:** para devolver tienes que volver a entrar; si lo repites mucho, acabas en las cuerdas.
  - **En inglés:** step back
- **REVISAR CON ENTRENADOR:** longitud del paso y qué golpe de respuesta recomienda según la distancia.

---

## Salidas

Las salidas no son defensas: sirven para salir de la línea del rival o cambiar de ángulo después de una combinación o de una defensa.

## 8. Pivote
- **id esperado:** `pivote`
- **Qué es:** girar sobre la punta del pie de delante, moviendo el de atrás en arco, para cambiar de ángulo respecto al rival.
- **Cómo se hace:**
  1. Apoya el peso en la parte delantera del pie de delante.
  2. Gira sobre él y lleva el pie de atrás en arco (empieza con unos 45°).
  3. Guardia y mirada en el rival durante el giro.
  4. Termina en guardia, con el rival delante y fuera de ángulo.
- **Errores típicos:**
  - Girar sobre el talón.
  - Bajar las manos al girar.
  - Girar tanto que pierdes al rival de vista.
- **Mostrar más:**
  - **Cuándo suele servir:** para salir del sitio tras golpear, cuando te meten presión o para buscar un ángulo nuevo desde el que golpear.
  - **Ventajas:** te saca de la línea sin alejarte y te deja en ángulo para golpear.
  - **Inconvenientes:** si te pillan a mitad del giro, estás desequilibrado.
  - **En inglés:** pivot
- **REVISAR CON ENTRENADOR:** hacia qué lado se pivota por defecto en guardia diestra y cuántos grados.

## 9. Paso lateral (izquierda / derecha)
- **id esperado:** `paso_lateral_izq`, `paso_lateral_der`
- **Qué es:** desplazarte de lado con pasos cortos para salir de la línea de ataque del rival.
- **Cómo se hace:**
  1. Mueve primero el pie del lado al que vas.
  2. El otro lo sigue sin juntarse ni cruzarse.
  3. Pasos cortos, sin saltar.
  4. Guardia y mirada en el rival.
- **Errores típicos:**
  - Cruzar los pies.
  - Juntarlos.
  - Dar pasos tan largos que te descolocas.
- **Mostrar más:**
  - **Cuándo suele servir:** para no retroceder siempre en línea recta, salir de una esquina o de las cuerdas, o buscar un ángulo.
  - **Ventajas:** sencillo y te mantiene a distancia de golpear.
  - **Inconvenientes:** cansa si lo haces mucho; si es predecible, el rival te corta el paso.
  - **Derecha o izquierda:** el lado es hacia dónde vas: en el paso lateral derecha te mueves hacia tu derecha.
  - **En inglés:** side step
- **REVISAR CON ENTRENADOR:** si conviene más moverse hacia el lado de la mano adelantada del rival.

## 10. Cambio de ángulo (salir)
- **Nota:** también se dice «salir». La ficha se titula como lo dice la app; el dictado no cambia.
- **id esperado:** `salir`
- **Qué es:** acabar la combinación saliendo de la línea del rival, para que no pueda devolverte enseguida.
- **Cómo se hace:**
  1. Termina el último golpe con la guardia ya volviendo.
  2. Sal de la línea con lo que mejor te venga: pivote o paso lateral.
  3. No te quedes delante del rival en línea.
- **Errores típicos:**
  - Quedarte quieto admirando el golpe.
  - Salir siempre igual.
  - Bajar las manos al salir.
- **Mostrar más:**
  - **Cuándo suele servir:** justo al terminar una combinación, cuando el rival suele intentar contestar.
  - **Ventajas:** evita el contraataque y te prepara para la siguiente entrada.
  - **Inconvenientes:** si sales demasiado lejos, tienes que volver a entrar.
  - **También se dice salir:** es una salida libre, sin movimiento fijo. El paso atrás no sirve aquí: no cambia el ángulo.
  - **En inglés:** angle out, exit
- **REVISAR CON ENTRENADOR:** si «salir» y «cambio de ángulo» son lo mismo para Iván o dos cosas distintas.

---

## Fuentes consultadas
- ExpertBoxing, *Boxing Defense Techniques* (Johnny Nguyen): https://expertboxing.com/boxing-defense-techniques — ventajas e inconvenientes de bloqueo, parada, esquiva, juego de pies y contraataque.
- Myprotein, *Entrenamiento de boxeo*: https://www.myprotein.com/thezone/entrenamiento/entrenamiento-de-boxeo/ — juego de pies (arrastre y pivote, giros pequeños y grandes).
- Evolve MMA, *Boxing Defense 101: How To Block Punches*: https://evolve-mma.com/blog/boxing-defense-101-how-to-block-punches-in-boxing/ — bloqueo y parada.
- Soloboxeo, *Técnica del boxeo*: https://soloboxeo.com/?p=208 — la guardia como defensa pasiva y los desplazamientos como parte de la defensa.
- EFDeportes, *Percepción visual y boxeo defensivo* (Federación Nacional de Boxeo de Cuba): https://efdeportes.com/efd127/percepcion-visual-y-boxeo-defensivo.htm — definición general de las acciones defensivas.
- Respuestas de Iván, 02-11-2026 (`claude/respuestas-entrenador-2026-11-02.md`): barbilla al pecho, el boxeo es situacional, tras el paso atrás puede ir recto, crochet o gancho según la distancia.

Los textos son redacción propia a partir de estas fuentes; no hay citas literales.