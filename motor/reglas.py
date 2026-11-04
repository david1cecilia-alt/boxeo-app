"""Reglas que debe cumplir toda combinación (en guardia ortodoxa).

Solo son estructurales: el boxeo es situacional, así que tras una defensa puede ir cualquier
golpe, se puede acabar bloqueando y se puede repetir mano. El nivel lo da la longitud.
validar() devuelve la lista de infracciones; lista vacía = combinación válida.
"""
from motor.acciones import Accion, acciones_por_ids, biblioteca, catalogo

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


# ---------- Creador de combinaciones propias ----------

MAX_PROPIAS = 20  # cuántas combinaciones propias se pueden guardar
NOMBRE_NIVEL = {1: "básico", 2: "medio", 3: "avanzado"}


def avisos_creador(ids: list[str], propias: list[dict] | None = None, editando: str | None = None) -> dict:
    """Lo que el creador dice de una combinación antes de guardarla (en ortodoxo).

    `propias`: las ya guardadas ([{"id", "ids"}], en su orden: la primera es «Combinación 1»);
    `editando`: el id de la que se edita, que ni cuenta para el máximo ni se compara consigo.
    Devuelve {"nivel", "avisos", "puede_guardar", "motivo"}: los avisos ([{"tipo", "texto", ...}])
    no impiden guardar, solo se avisan; `motivo` dice por qué no se puede guardar (o None)."""
    propias = propias or []
    cat = catalogo()
    conocidas = all(i in cat for i in ids)
    combo = acciones_por_ids(ids) if conocidas else []
    avisos = []
    if conocidas and ids and validar(combo):
        avisos.append({"tipo": "sin_golpes", "texto": "No lleva ningún golpe."})
    igual = next((c for c in biblioteca() if [a.id for a in c.acciones] == ids), None)
    if igual:
        avisos.append({"tipo": "biblioteca", "nivel": igual.nivel,
                       "texto": f"Ya está en la biblioteca, en nivel {NOMBRE_NIVEL[igual.nivel]}."})
    for numero, p in enumerate(propias, 1):
        if p.get("id") != editando and p.get("ids") == ids:
            avisos.append({"tipo": "propia", "numero": numero, "texto": f"Es igual que tu combinación {numero}."})
            break
    otras = sum(p.get("id") != editando for p in propias)
    if not conocidas:
        motivo = "Lleva una acción que la app no conoce."
    elif len(ids) < ACCIONES_POR_NIVEL[1][0]:
        motivo = f"Añade al menos {ACCIONES_POR_NIVEL[1][0]} acciones."
    elif len(ids) > MAX_ACCIONES:
        motivo = f"Como mucho {MAX_ACCIONES} acciones."
    elif otras >= MAX_PROPIAS:
        motivo = f"Ya tienes {MAX_PROPIAS} combinaciones: borra alguna para guardar otra."
    else:
        motivo = None
    return {"nivel": nivel_de(combo) if conocidas else None, "avisos": avisos,
            "puede_guardar": motivo is None, "motivo": motivo}
