# Siguiente paso: unir `biblioteca-nueva` a main

Hecho en la rama: `data/combinaciones.json` (150, 50 por nivel), sorteo solo del nivel elegido, «Practicar más»
(almacén v6, tres huecos) y la captura a 390 con «croch. dcha. abajo» (`herramientas/capturas_practicar.py`).
main no tiene nada que no esté en la rama.

## Antes de unir

1. ~~David revisa las 22 dudas de técnica~~ **Hecho**: David las ha revisado y la biblioteca se queda como está.
   No bloquean la unión. Siguen marcadas en `revisar` (REVISAR CON ENTRENADOR), pendientes de Iván. Si
   Iván cambia algo, regenerar la propuesta, `data/combinaciones.json` y `data/revisar.json` con
   `herramientas/biblioteca.py` y `herramientas/extraer_revisar.py` (sus comprobaciones dicen si un cambio
   rompe el crecimiento de la familia, el reparto de golpes o un nombre).
2. `.venv\Scripts\python -m pytest -q` en verde.

## Dudas pendientes de Iván (revisadas por David)

| # | Nivel | Nombre | Acciones | Duda |
|---|---|---|---|---|
| 31 | básico | esquiva derecha, dos ganchos y esquiva izquierda | esquiva derecha · 6 · 5 · esquiva izquierda | dos ganchos seguidos |
| 33 | medio | esquiva derecha, dos ganchos, esquiva izquierda y jab-recto | esquiva derecha · 6 · 5 · esquiva izquierda · 1 · 2 | dos ganchos seguidos |
| 35 | avanzado | esquivas a los dos lados, rueda y crochet-gancho | esquiva derecha · 6 · 5 · esquiva izquierda · 1 · 2 · rueda derecha · 4 · 5 | dos ganchos seguidos |
| 38 | básico | bloqueo, dos ganchos y bloqueo | bloqueo · 5 · 6 · bloqueo | dos ganchos seguidos |
| 39 | básico | jab-gancho y bloqueo | 1 · 6 · bloqueo | jab y gancho trasero |
| 41 | medio | dos bloqueos, jab y crochet | bloqueo · 5 · 6 · bloqueo · 1 · 4 | dos ganchos seguidos |
| 43 | avanzado | dos bloqueos, esquiva, gancho, ballesteo y recto | bloqueo · 5 · 6 · bloqueo · 1 · 4 · esquiva izquierda · 5 · ballesteo · 2 | dos ganchos seguidos |
| 51 | básico | crochet y dos ganchos | 4 · 5 · 6 | dos ganchos seguidos |
| 52 | medio | jab-recto, gancho-crochet y rueda | 1 · 2 · 6 · 3 · rueda izquierda | recto y gancho trasero seguidos (misma mano) |
| 53 | medio | jab-crochet, dos ganchos y rueda | 1 · 4 · 5 · 6 · rueda derecha | dos ganchos seguidos |
| 54 | avanzado | jab-recto, gancho-crochet, rueda, jab-recto y esquiva | 1 · 2 · 6 · 3 · rueda izquierda · 1 · 2 · esquiva izquierda | recto y gancho trasero seguidos (misma mano) |
| 55 | avanzado | jab-crochet, dos ganchos, rueda, gancho al cuerpo y ballesteo | 1 · 4 · 5 · 6 · rueda derecha · 5 al cuerpo · 3 · ballesteo | dos ganchos seguidos |
| 57 | básico | doble jab y dos ganchos | 1 · 1 · 6 · 5 | dos ganchos seguidos |
| 59 | medio | doble jab, dos ganchos, ballesteo y recto | 1 · 1 · 6 · 5 · ballesteo · 2 | dos ganchos seguidos |
| 61 | avanzado | doble jab, ballesteo, bloqueo y jab-gancho | 1 · 1 · 6 · 5 · ballesteo · 2 · bloqueo · 1 · 6 | dos ganchos seguidos |
| 63 | básico | flexión y gancho abajo y arriba | flexión · 6 al cuerpo · 5 | dos ganchos seguidos |
| 65 | medio | flexión, gancho abajo y arriba, rueda y jab-recto | flexión · 6 al cuerpo · 5 · rueda derecha · 1 · 2 | dos ganchos seguidos |
| 67 | avanzado | flexión, gancho abajo y arriba, rueda, flexión y recto | flexión · 6 al cuerpo · 5 · rueda derecha · 1 · 2 · flexión · 1 al cuerpo · 2 | dos ganchos seguidos |
| 75 | básico | jab abajo, jab arriba y crochet | 1 al cuerpo · 1 · 4 | crochet trasero tras dos jabs |
| 113 | básico | jab, ballesteo, gancho y flexión | 1 · ballesteo · 6 · flexión | tras el ballesteo, gancho y no recto |
| 144 | avanzado | jab, bloqueo, gancho, flexión, ballesteo y paso atrás | 1 · bloqueo · 5 · flexión · 2 al cuerpo · ballesteo · 6 · paso atrás | tras el bloqueo, gancho y no recto |
| 146 | avanzado | dos bloqueos, esquiva, gancho, flexión y crochet al cuerpo | bloqueo · 1 · bloqueo · 5 · esquiva izquierda · 5 · flexión · 3 al cuerpo | tras el bloqueo, gancho y no recto |

## Preguntas para Iván

Sin cambiar ninguna combinación hasta que conteste.

- **#52 y #54:** ¿recto y gancho de derecha seguidos (2 · 6) o mejor 5 · 4? Si cambia, afecta a la base F9-B
  («gancho-crochet», 6 · 3), de la que crecen.
- **#75 (y #77 y #78, que heredan de ella):** ¿crochet de derecha tras dos jabs o mejor recto?
- **#113 y #144:** tras el ballesteo, ¿gancho o recto?
- **Ballesteo:** ¿cómo lo llama él, con paso o solo cuerpo, y es adecuado para el nivel de David?
- **Flexión:** ¿qué es exactamente y en qué se diferencia de la «rueda»?

## Aparcado (no bloquea la unión)

- PDF para Iván con la biblioteca agrupada por familias.
