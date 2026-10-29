"""Cuánto se tarda en dictar y ejecutar una combinación, y pausas según el ritmo (1-5)."""
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
# Segundos para ejecutar cada acción después de oírla.
SEGUNDOS_EJECUCION = {"golpe": 0.5, "defensa": 0.8, "movimiento": 1.0}
# Pausa (recuperar guardia) entre el final de una combinación y la siguiente, según el ritmo
# elegido: se sortea en el rango (mín, máx). 1 = Calmado … 5 = Intenso.
PAUSA_POR_RITMO = {1: (6.0, 8.0), 2: (4.9, 6.6), 3: (3.8, 5.3), 4: (2.6, 3.9), 5: (1.5, 2.5)}
RITMO_POR_DEFECTO = 3
# Las combinaciones largas piden recuperar más: segundos de más por cada acción a partir de la 4.ª.
ACCIONES_SIN_EXTRA = 3
EXTRA_POR_ACCION = 0.3


def segundos_habla(texto: str) -> float:
    """Lo que tarda la voz en decir `texto` (sílabas aproximadas por grupos de vocales)."""
    silabas = len(_SILABA.findall(texto))
    return HABLA_BASE + HABLA_POR_SILABA * silabas + HABLA_POR_COMA * texto.count(",")


def duracion_estimada(combo: list[Accion] | tuple[Accion, ...], texto: str | None = None) -> float:
    """Tiempo desde que empieza el dictado de `texto` (lo que se dice, según el modo de voz)
    hasta que se termina de decir y de ejecutar: la pausa entre combinaciones cuenta desde ahí."""
    texto = texto_hablado(combo) if texto is None else texto
    ejecucion = sum(SEGUNDOS_EJECUCION[a.tipo] for a in combo)
    return round(segundos_habla(texto) + ejecucion, 2)


def extra_por_longitud(combo) -> float:
    return EXTRA_POR_ACCION * max(0, len(combo) - ACCIONES_SIN_EXTRA)


def pausa_entre_combos(ritmo: int, combo, rng: random.Random, pausa: float | None = None) -> float:
    """Pausa tras `combo`: la fija del usuario o, si no hay, una al azar del ritmo más lo que
    pida su longitud."""
    if pausa is not None:
        return pausa
    minimo, maximo = PAUSA_POR_RITMO[ritmo]
    return round(rng.uniform(minimo, maximo) + extra_por_longitud(combo), 2)


def rango_pausa(ritmo: int, combo, pausa: float | None = None) -> tuple[float, float]:
    """Pausa mínima y máxima que puede salir tras `combo` (para comprobar guiones)."""
    if pausa is not None:
        return pausa, pausa
    extra = extra_por_longitud(combo)
    minimo, maximo = PAUSA_POR_RITMO[ritmo]
    return minimo + extra, maximo + extra
