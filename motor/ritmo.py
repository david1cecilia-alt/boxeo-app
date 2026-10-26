"""Cuánto se tarda en dictar y ejecutar una combinación, y pausas por nivel."""
from motor.acciones import Accion

# Segundos que tarda la voz en decir cada acción (aprox., nombres de 1 a 4 palabras).
SEGUNDOS_HABLA_POR_ACCION = 0.6
# Segundos para ejecutar cada acción después de oírla.
SEGUNDOS_EJECUCION = {"golpe": 0.5, "defensa": 0.8, "movimiento": 1.0}
# Pausa (recuperar guardia) entre el final de una combinación y la siguiente.
PAUSA_POR_NIVEL = {1: 4.0, 2: 3.0, 3: 2.0}


def duracion_estimada(combo: list[Accion] | tuple[Accion, ...]) -> float:
    """Tiempo desde que empieza el dictado hasta que se termina de ejecutar."""
    habla = SEGUNDOS_HABLA_POR_ACCION * len(combo)
    ejecucion = sum(SEGUNDOS_EJECUCION[a.tipo] for a in combo)
    return round(habla + ejecucion, 2)


def pausa_entre_combos(nivel: int, pausa: float | None = None) -> float:
    """Pausa configurada por el usuario o, si no hay, la del nivel."""
    return PAUSA_POR_NIVEL[nivel] if pausa is None else pausa
