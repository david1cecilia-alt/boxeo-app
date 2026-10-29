"""Cuánto se tarda en dictar una combinación y hueco hasta la siguiente según el ritmo (1-5).

Se golpea MIENTRAS se oye la combinación: no hay tiempo de ejecución aparte; el ritmo es solo el
hueco desde que la voz termina hasta que empieza la siguiente."""
import random
import re

from motor.acciones import Accion, texto_hablado

# Lo que tarda la voz en decir un texto, de que empieza a hablar a que termina: medido con la voz
# del navegador (Microsoft Helena, es-ES, velocidad 1,1 como static/voz.js) sobre 75 combinaciones
# en los tres modos y ajustado con un poco de margen (error ±0,4 s). Recalibrar si cambia la voz.
HABLA_BASE = 1.0
HABLA_POR_SILABA = 0.15
HABLA_POR_COMA = 0.55   # pausa entre una acción y la siguiente
_SILABA = re.compile(r"[aeiouáéíóúü]+", re.IGNORECASE)
# Hueco desde que la voz termina de decir una combinación hasta que empieza la siguiente, según el
# ritmo elegido: se sortea en el rango (mín, máx), igual para combinaciones cortas y largas.
# 1 Calmado (mover los pies) … 5 Intenso (encadenar: 1 s fijo).
PAUSA_POR_RITMO = {1: (5.0, 7.0), 2: (4.0, 5.0), 3: (2.0, 4.0), 4: (1.0, 3.0), 5: (1.0, 1.0)}
RITMO_POR_DEFECTO = 3


def segundos_habla(texto: str) -> float:
    """Lo que tarda la voz en decir `texto` (sílabas aproximadas por grupos de vocales)."""
    silabas = len(_SILABA.findall(texto))
    return HABLA_BASE + HABLA_POR_SILABA * silabas + HABLA_POR_COMA * texto.count(",")


def duracion_estimada(combo: list[Accion] | tuple[Accion, ...], texto: str | None = None) -> float:
    """Tiempo desde que empieza el dictado de `texto` (lo que se dice, según el modo de voz)
    hasta que se termina de decir: se golpea mientras se oye y el hueco cuenta desde ahí."""
    texto = texto_hablado(combo) if texto is None else texto
    return round(segundos_habla(texto), 2)


def pausa_entre_combos(ritmo: int, rng: random.Random, pausa: float | None = None) -> float:
    """Hueco tras una combinación: el fijo del usuario o, si no hay, uno al azar del ritmo."""
    if pausa is not None:
        return pausa
    return round(rng.uniform(*PAUSA_POR_RITMO[ritmo]), 2)


def rango_pausa(ritmo: int, pausa: float | None = None) -> tuple[float, float]:
    """Hueco mínimo y máximo que puede salir (para comprobar guiones)."""
    return (pausa, pausa) if pausa is not None else PAUSA_POR_RITMO[ritmo]
