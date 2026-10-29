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
    numero: int | None = None  # número del golpe EN ORTODOXO (1 jab … 6 uppercut trasero)
    orden: str = ""            # lo que se dice de una defensa en la sesión ("esquiva")

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
                  plantilla_corta=d["nombre_corto"], numero=d.get("numero"),
                  orden=d.get("orden", ""))


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


@lru_cache
def palabras_numero() -> dict[int, str]:
    return {int(n): palabra for n, palabra in _leer_json()["palabras_numero"].items()}


def acciones_por_ids(ids: list[str]) -> list[Accion]:
    cat = catalogo()
    return [cat[i] for i in ids]


@dataclass(frozen=True)
class ComboBiblioteca:
    notacion: str
    nivel: int                 # 1 básico, 2 medio, 3 avanzado
    acciones: tuple[Accion, ...]
    nombre: str | None = None  # los clásicos de antes conservan su nombre

    @property
    def con_defensa(self) -> bool:
        return any(a.tipo == "defensa" for a in self.acciones)


@lru_cache
def _leer_biblioteca() -> dict:
    with open(RUTA_DATOS / "combinaciones.json", encoding="utf-8") as f:
        return json.load(f)


@lru_cache
def biblioteca() -> tuple[ComboBiblioteca, ...]:
    """Combinaciones escritas a mano (data/combinaciones.json), en ortodoxo."""
    return tuple(ComboBiblioteca(c["notacion"], c["nivel"], tuple(acciones_por_ids(c["ids"])), c.get("nombre"))
                 for c in _leer_biblioteca()["combinaciones"])


def defensa_por_nivel() -> dict[int, float]:
    """Proporción de combinaciones con defensa en la sesión, por nivel."""
    return {int(n): p for n, p in _leer_biblioteca()["defensa_por_nivel"].items()}


def notacion(acciones) -> str:
    """Como "1-2-esquiva-2": número de cada golpe (en ortodoxo), orden de cada defensa o su id."""
    return "-".join(str(a.numero) if a.numero else (a.orden or a.id) for a in acciones)


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
        # El número no cuenta: el de gancho_izq (3) y el de gancho_der (4) son distintos.
        if replace(reflejada, id=candidata.id, numero=candidata.numero) == candidata:
            return candidata
    return reflejada


def espejo_combo(combo: list[Accion]) -> list[Accion]:
    return [espejo(a) for a in combo]


# Cómo se dicen las combinaciones en la sesión ("Nombrar combinaciones").
MODOS_VOZ = ("numeros", "nombres", "ambos")


def numero(accion: Accion, zurdo: bool = False) -> int | None:
    """Número del golpe por mano adelantada/trasera. El de un zurdo se lee de su espejo
    ortodoxo: su gancho de derecha es el gancho adelantado, el 3."""
    return (espejo(accion) if zurdo else accion).numero


def palabra_hablada(accion: Accion, modo: str = "nombres", zurdo: bool = False) -> str:
    """Lo que se dice de una acción: las defensas, su orden corta; los golpes con número,
    el número, el nombre o los dos ("uno jab")."""
    nombre = accion.orden or accion.nombre_hablado
    n = numero(accion, zurdo)
    if n is None or modo == "nombres":
        return nombre
    palabra = palabras_numero()[n]
    return palabra if modo == "numeros" else f"{palabra} {nombre}"


def texto_hablado(acciones, modo: str = "nombres", zurdo: bool = False) -> str:
    return ", ".join(palabra_hablada(a, modo, zurdo) for a in acciones)
