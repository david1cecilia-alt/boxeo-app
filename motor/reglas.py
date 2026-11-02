"""Reglas que debe cumplir toda combinación (en guardia ortodoxa).

Solo son estructurales: el boxeo es situacional, así que tras una defensa puede ir cualquier
golpe, se puede acabar bloqueando y se puede repetir mano. El nivel lo da la longitud.
validar() devuelve la lista de infracciones; lista vacía = combinación válida.
"""
from motor.acciones import Accion

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


def ultimo_golpe(combo: list[Accion]) -> Accion | None:
    """El último GOLPE, aunque después vaya una salida (para los pesos del perfil)."""
    golpes = [a for a in combo if a.tipo == "golpe"]
    return golpes[-1] if golpes else None
