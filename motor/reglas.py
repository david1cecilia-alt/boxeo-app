"""Reglas que debe cumplir toda combinación (en guardia ortodoxa).

Solo son estructurales: el boxeo es situacional, así que tras una defensa puede ir cualquier
golpe, se puede acabar bloqueando y se puede repetir mano. El nivel lo da la longitud.
validar() devuelve la lista de infracciones; lista vacía = combinación válida.
"""
from motor.acciones import Accion

# Nivel por número total de acciones (golpes, defensas y salidas): 1 básico, 2 medio, 3 avanzado.
ACCIONES_POR_NIVEL = {1: (2, 4), 2: (5, 6), 3: (7, 10)}
MAX_ACCIONES = 10

# Ninguna acción tiene nivel mínimo: los golpes al cuerpo y todas las defensas valen desde básico.
# REVISAR CON ENTRENADOR: ¿alguna acción no es para principiantes?


def _regla_tiene_golpe(combo):
    if not any(a.tipo == "golpe" for a in combo):
        return "no hay ningún golpe"


REGLAS = [_regla_tiene_golpe]


def validar(combo: list[Accion]) -> list[str]:
    """Infracciones de la combinación (lista vacía si es válida)."""
    return [error for regla in REGLAS if (error := regla(combo))]


def es_valida(combo: list[Accion]) -> bool:
    return not validar(combo)


def nivel_de(combo: list[Accion]) -> int | None:
    """Nivel de una combinación por su número de acciones: 2-4 básico, 5-6 medio, 7-10 avanzado.
    None si tiene menos de 2 o más de MAX_ACCIONES."""
    return next((nivel for nivel, (minimo, maximo) in ACCIONES_POR_NIVEL.items()
                 if minimo <= len(combo) <= maximo), None)


def ultimo_golpe(combo: list[Accion]) -> Accion | None:
    """El último GOLPE, aunque después vaya una salida (para los pesos del perfil)."""
    golpes = [a for a in combo if a.tipo == "golpe"]
    return golpes[-1] if golpes else None
