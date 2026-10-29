"""Vocabulario de acciones (cargado de data/acciones.json) y modo zurdo (espejo)."""
import json
from dataclasses import dataclass, replace
from functools import lru_cache
from pathlib import Path

RUTA_DATOS = Path(__file__).resolve().parent.parent / "data"

_PALABRA = {"izq": "izquierda", "der": "derecha"}
_PALABRA_CORTA = {"izq": "izq.", "der": "dcha."}
_LADO_CONTRARIO = {"izq": "der", "der": "izq"}


@dataclass(frozen=True)
class Accion:
    """Una acción en guardia ortodoxa (o ya reflejada si viene de espejo())."""
    id: str
    familia: str
    plantilla: str
    tipo: str            # golpe | defensa | movimiento
    mano: str            # izq | der | ninguna
    objetivo: str        # cabeza | cuerpo | ninguno
    peso_despues: str    # delante | detras | izq | der | centro
    nivel_minimo: int
    lado: str = "ninguno"  # lado de defensas/movimientos (izq | der | ninguno)
    poder: bool = False
    plantilla_corta: str = ""  # nombre para la pantalla de la sesión


    @property
    def nombre_hablado(self) -> str:
        # El nombre se genera a partir de mano/lado, nunca reemplazando texto.
        return self.plantilla.format(mano=_PALABRA.get(self.mano, ""),
                                     lado=_PALABRA.get(self.lado, ""))

    @property
    def nombre_corto(self) -> str:
        # Igual que el hablado pero abreviado ("gancho dcha."): lo que se lee en la sesión.
        return self.plantilla_corta.format(mano=_PALABRA_CORTA.get(self.mano, ""),
                                           lado=_PALABRA_CORTA.get(self.lado, ""))


def _desde_json(d: dict) -> Accion:
    return Accion(id=d["id"], familia=d["familia"], plantilla=d["nombre_hablado"],
                  tipo=d["tipo"], mano=d["mano"], objetivo=d["objetivo"],
                  peso_despues=d["peso_despues"], nivel_minimo=d["nivel_minimo"],
                  lado=d.get("lado", "ninguno"), poder=d.get("poder", False),
                  plantilla_corta=d["nombre_corto"])


@lru_cache
def _leer_json() -> dict:
    with open(RUTA_DATOS / "acciones.json", encoding="utf-8") as f:
        return json.load(f)


@lru_cache
def catalogo() -> dict[str, Accion]:
    """Todas las acciones ortodoxas indexadas por id."""
    return {d["id"]: _desde_json(d) for d in _leer_json()["acciones"]}


@lru_cache
def repeticiones_permitidas() -> dict[tuple[str, ...], str]:
    """Pares (o tríos) de la misma mano que sí están permitidos: {(id1, id2): nombre}."""
    return {tuple(r["ids"]): r["nombre"] for r in _leer_json()["repeticiones_permitidas"]}


def acciones_por_ids(ids: list[str]) -> list[Accion]:
    cat = catalogo()
    return [cat[i] for i in ids]


@dataclass(frozen=True)
class ComboClasico:
    nombre: str
    nivel: int
    acciones: tuple[Accion, ...]


@lru_cache
def combos_clasicos() -> tuple[ComboClasico, ...]:
    """Biblioteca de combinaciones escritas a mano (data/combos.json)."""
    with open(RUTA_DATOS / "combos.json", encoding="utf-8") as f:
        datos = json.load(f)
    return tuple(ComboClasico(c["nombre"], c["nivel"], tuple(acciones_por_ids(c["ids"])))
                 for c in datos["combos"])


def _contrario(valor: str) -> str:
    return _LADO_CONTRARIO.get(valor, valor)


def espejo(accion: Accion) -> Accion:
    """Refleja izquierda ↔ derecha (mano, lado y peso).

    Si en el catálogo existe la acción simétrica (gancho_izq ↔ gancho_der) se
    devuelve esa, con su id. Si no (jab, directo, paso atrás...) se devuelve la
    misma acción con los campos reflejados: el jab de un zurdo es con la derecha
    pero se sigue llamando "jab".
    """
    reflejada = replace(accion, mano=_contrario(accion.mano), lado=_contrario(accion.lado),
                        peso_despues=_contrario(accion.peso_despues))
    for candidata in catalogo().values():
        if replace(reflejada, id=candidata.id) == candidata:
            return candidata
    return reflejada


def espejo_combo(combo: list[Accion]) -> list[Accion]:
    return [espejo(a) for a in combo]
