"""Cuánto se tarda en dictar y ejecutar una combinación, y pausas según el ritmo (1-5)."""
import random

from motor.acciones import Accion

# Segundos que tarda la voz en decir cada acción (aprox., nombres de 1 a 4 palabras).
SEGUNDOS_HABLA_POR_ACCION = 0.6
# Segundos para ejecutar cada acción después de oírla.
SEGUNDOS_EJECUCION = {"golpe": 0.5, "defensa": 0.8, "movimiento": 1.0}
# Pausa (recuperar guardia) entre el final de una combinación y la siguiente, según el ritmo
# elegido: se sortea en el rango (mín, máx). 1 = Calmado … 5 = Intenso.
PAUSA_POR_RITMO = {1: (6.0, 8.0), 2: (4.9, 6.6), 3: (3.8, 5.3), 4: (2.6, 3.9), 5: (1.5, 2.5)}
RITMO_POR_DEFECTO = 3
# Las combinaciones largas piden recuperar más: segundos de más por cada acción a partir de la 4.ª.
ACCIONES_SIN_EXTRA = 3
EXTRA_POR_ACCION = 0.3


def duracion_estimada(combo: list[Accion] | tuple[Accion, ...]) -> float:
    """Tiempo desde que empieza el dictado hasta que se termina de ejecutar."""
    habla = SEGUNDOS_HABLA_POR_ACCION * len(combo)
    ejecucion = sum(SEGUNDOS_EJECUCION[a.tipo] for a in combo)
    return round(habla + ejecucion, 2)


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
