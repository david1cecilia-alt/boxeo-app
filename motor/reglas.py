"""Reglas técnicas que debe cumplir toda combinación (en guardia ortodoxa).

validar() devuelve la lista de infracciones; lista vacía = combinación válida.
El generador y los tests usan este mismo validador.
"""
from motor.acciones import Accion, espejo_combo, repeticiones_permitidas

# Número de acciones (mín, máx) por nivel.
LONGITUD = {1: (2, 3), 2: (3, 4), 3: (4, 6)}

# Cargar y soltar: tras esta defensa, SI viene un golpe, debe ser uno de estos
# (familia, mano). Rodar se resuelve aparte: gancho del lado donde queda el peso.
SOLTAR_TRAS = {
    "esquiva_der": {("directo", "der"), ("uppercut", "der")},
    "esquiva_izq": {("gancho", "izq"), ("uppercut", "izq")},
    "paso_atras": {("directo", "der")},
}
# REVISAR CON ENTRENADOR: tras "parada" (para el jab) no impongo ningún golpe concreto.

# Acciones válidas para cerrar tras un golpe de poder en nivel 2 y 3 (confirmado por el usuario).
# Rodar ya es de nivel 2 por su nivel_minimo; "salir" se dice "sal en ángulo".
FAMILIAS_SALIDA = {"pivote", "paso_lateral", "esquiva", "rodar", "salir"}


def _regla_longitud(combo, nivel):
    minimo, maximo = LONGITUD[nivel]
    if not minimo <= len(combo) <= maximo:
        return f"longitud {len(combo)} fuera de {minimo}-{maximo} para nivel {nivel}"


def _regla_nivel_minimo(combo, nivel):
    altas = [a.id for a in combo if a.nivel_minimo > nivel]
    if altas:
        return f"acciones de nivel superior: {altas}"


def _regla_tiene_golpe(combo, nivel):
    if not any(a.tipo == "golpe" for a in combo):
        return "no hay ningún golpe"


def _regla_cargar_y_soltar(combo, nivel):
    for defensa, siguiente in zip(combo, combo[1:]):
        if siguiente.tipo != "golpe":
            continue  # solo obliga si después viene un golpe
        if defensa.familia == "rodar":
            # REVISAR CON ENTRENADOR: rodar a la izquierda deja el peso a la izquierda → gancho de izquierda.
            permitidos = {("gancho", defensa.peso_despues)}
        else:
            permitidos = SOLTAR_TRAS.get(defensa.id)
        if permitidos and (siguiente.familia, siguiente.mano) not in permitidos:
            return f"tras {defensa.id} no va {siguiente.id} (cargar y soltar)"


def _regla_bloquear_y_devolver(combo, nivel):
    for i, accion in enumerate(combo):
        if accion.familia != "bloqueo":
            continue
        if i == len(combo) - 1:
            return "la combinación termina en bloqueo"
        if combo[i + 1].tipo != "golpe":
            return f"tras el bloqueo va {combo[i + 1].id}, no un golpe"


def _regla_alternar_manos(combo, nivel):
    permitidas = repeticiones_permitidas()
    for a, b in zip(combo, combo[1:]):
        if a.tipo == b.tipo == "golpe" and a.mano == b.mano and (a.id, b.id) not in permitidas:
            return f"{a.id} y {b.id} repiten mano sin ser excepción"
    for a, b, c in zip(combo, combo[1:], combo[2:]):
        if (a.tipo == b.tipo == c.tipo == "golpe" and a.mano == b.mano == c.mano
                and (a.id, b.id, c.id) not in permitidas):
            return f"tres golpes seguidos con la misma mano ({a.id}, {b.id}, {c.id})"


def _regla_salida_tras_poder(combo, nivel):
    if nivel < 2:
        return None  # nivel 1: puede terminar en golpe de poder sin salida
    ultima = combo[-1]
    if ultima.tipo == "golpe" and ultima.poder:
        return f"nivel {nivel}: termina en golpe de poder ({ultima.id}) sin salida"
    if ultima.tipo != "golpe" and ultima.familia not in FAMILIAS_SALIDA:
        return f"{ultima.id} no es una salida válida"


REGLAS = [
    _regla_longitud,
    _regla_nivel_minimo,
    _regla_tiene_golpe,
    _regla_cargar_y_soltar,
    _regla_bloquear_y_devolver,
    _regla_alternar_manos,
    _regla_salida_tras_poder,
]


def validar(combo: list[Accion], nivel: int, zurdo: bool = False) -> list[str]:
    """Infracciones de la combinación. Si es zurda, se valida su espejo ortodoxo."""
    if zurdo:
        combo = espejo_combo(combo)
    errores = []
    for regla in REGLAS:
        error = regla(combo, nivel)
        if error:
            errores.append(error)
    return errores


def es_valida(combo: list[Accion], nivel: int, zurdo: bool = False) -> bool:
    return not validar(combo, nivel, zurdo)


def ultimo_golpe(combo: list[Accion]) -> Accion | None:
    """El último GOLPE, aunque después vaya una salida (para los pesos del perfil)."""
    golpes = [a for a in combo if a.tipo == "golpe"]
    return golpes[-1] if golpes else None
