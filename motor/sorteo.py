"""Sorteo de la sesión: combinaciones de la biblioteca (data/combinaciones.json) y, si se eligen,
las propias del usuario (las del creador, que guarda el almacén del navegador).

- Solo las del nivel elegido, todas con la misma probabilidad salvo "Practicar más" (perfil
  "practicar"): las que llevan un movimiento elegido pesan más, nunca se excluye ninguna.
- No repite ninguna de las últimas SIN_REPETIR (por su identidad: el número en la biblioteca, el
  id en las propias); en un grupo de n, de las últimas mín(SIN_REPETIR, n − 1).
- Hasta que hayan salido todos los golpes del 1 al 6, solo saca las que añaden alguno (en las
  6 primeras están todos seguro).
- Coletillas: las cortas (2-3 acciones) del nivel básico, para rellenar el final de un asalto
  donde ya no cabe una del nivel.
- Mezcla con las propias (SorteoMezcla): en cada sorteo, una moneda decide si sale una propia del
  nivel (PROBABILIDAD_PROPIAS) o una de la biblioteca. «Solo las mías»: todas las propias, sin
  mirar el nivel ni la cobertura.

Todo en ortodoxo; si es zurdo se refleja al final con espejo().
"""
import json
import math
import random
from dataclasses import dataclass

from motor.acciones import (RUTA_DATOS, Accion, ComboBiblioteca, acciones_por_ids, biblioteca, catalogo,
                            espejo_combo, numero, texto_hablado)
from motor.reglas import MAX_ACCIONES, nivel_de

SIN_REPETIR = 5
NUMEROS = frozenset(range(1, 7))
NIVEL_COLETILLA = 1
ACCIONES_COLETILLA = (2, 3)  # mínimo y máximo
# "Practicar más": cuánto multiplica cada movimiento elegido ("Un poco más", "Bastante más"). Si
# una combinación lleva varios elegidos se multiplican, como mucho TOPE_PRACTICAR.
FACTOR_PRACTICAR = {"poco": 2.0, "bastante": 4.0}
TOPE_PRACTICAR = 8.0
# Mezcla con las propias («Tus combinaciones» en Entrenar): probabilidad de que cada sorteo saque
# una propia del nivel. "ninguna" no tira moneda (sale lo mismo que sin propias); "solo", solo propias.
PROBABILIDAD_PROPIAS = {"poco": 0.20, "bastante": 0.35, "mucho": 0.50}
MEZCLAS = ("ninguna", *PROBABILIDAD_PROPIAS, "solo")
MIN_SOLO_PROPIAS = 3  # con menos, «Solo las mías» sortea como "ninguna"
MIN_ACCIONES_PROPIA = 2


def cargar_perfil() -> dict:
    with open(RUTA_DATOS / "perfil.json", encoding="utf-8") as f:
        return json.load(f)


@dataclass(frozen=True)
class ComboPropia:
    """Una combinación del creador, en ortodoxo. Nunca se nombra: se dice por sus acciones."""
    id: str                    # "p-<uuid>", lo da el almacén
    acciones: tuple[Accion, ...]

    @property
    def nivel(self) -> int:
        return nivel_de(self.acciones)


def propias_validas(propias: list[dict] | None) -> list[ComboPropia]:
    """Las propias del almacén ([{"id", "ids", ...}]) que se pueden sortear: ids del catálogo y de
    MIN_ACCIONES_PROPIA a MAX_ACCIONES acciones. Las demás se ignoran."""
    cat = catalogo()
    return [ComboPropia(p["id"], tuple(acciones_por_ids(p["ids"]))) for p in propias or []
            if isinstance(p.get("id"), str) and isinstance(p.get("ids"), list)
            and MIN_ACCIONES_PROPIA <= len(p["ids"]) <= MAX_ACCIONES and all(i in cat for i in p["ids"])]


def mezcla_efectiva(mezcla: str, propias: list[ComboPropia], nivel: int) -> str:
    """La mezcla con la que se sortea de verdad: "solo" con menos de MIN_SOLO_PROPIAS propias, y
    poco/bastante/mucho sin propias del nivel, sortean como "ninguna"."""
    if mezcla == "solo":
        return mezcla if len(propias) >= MIN_SOLO_PROPIAS else "ninguna"
    if mezcla in PROBABILIDAD_PROPIAS:
        return mezcla if any(p.nivel == nivel for p in propias) else "ninguna"
    return "ninguna"


@dataclass(frozen=True)
class Combinacion:
    acciones: tuple[Accion, ...]
    origen: str               # "biblioteca" | "propia"
    nombre: str | None = None  # nombre o notación de la de biblioteca; las propias, None

    @property
    def texto(self) -> str:
        return texto_hablado(self.acciones)


def movimiento(accion: Accion) -> str:
    """El movimiento de "Practicar más" de una acción ortodoxa: "1"-"6" los golpes a la cara,
    "cuerpo" cualquier golpe al cuerpo (aunque lleven número, del 7 al 12) y la familia las defensas
    y salidas ("rodar", "pivote")."""
    if accion.tipo == "golpe":
        return "cuerpo" if accion.objetivo == "cuerpo" else str(accion.numero)
    return accion.familia


def movimientos() -> list[str]:
    """Los que se pueden elegir en "Practicar más", en el orden del catálogo."""
    return list(dict.fromkeys(movimiento(a) for a in catalogo().values()))


def peso_practicar(acciones, practicar: list[dict]) -> float:
    """Cuánto pesa una combinación (ortodoxa) con "Practicar más": [{"movimiento", "cuanto"}].
    Cada movimiento elegido cuenta una vez aunque salga varias; lo desconocido no cuenta."""
    factores = {p["movimiento"]: FACTOR_PRACTICAR[p["cuanto"]] for p in practicar
                if p.get("cuanto") in FACTOR_PRACTICAR}
    lleva = {movimiento(a) for a in acciones} & factores.keys()
    return min(TOPE_PRACTICAR, math.prod(factores[m] for m in lleva))


def numeros(combo: ComboBiblioteca) -> set[int]:
    return {a.numero for a in combo.acciones if a.numero}


def identidad(combo: ComboBiblioteca | ComboPropia) -> int | str:
    """Lo que distingue una combinación en la ventana de no repetir: su número en la biblioteca o
    el id de la propia. No sus acciones, para que dos iguales no se confundan y Python y JS cuenten
    lo mismo."""
    return combo.id if isinstance(combo, ComboPropia) else combo.n


def es_corta(combo) -> bool:
    """Si vale de coletilla por su número de acciones (ACCIONES_COLETILLA)."""
    minimo, maximo = ACCIONES_COLETILLA
    return minimo <= len(combo.acciones) <= maximo


def ventana(n_combos: int) -> int:
    """Cuántas de las últimas no se repiten en un grupo de n_combos: SIN_REPETIR, o n − 1 si son
    menos (siempre queda alguna libre)."""
    return max(0, min(SIN_REPETIR, n_combos - 1))


def orden_ponderado(combos, practicar: list[dict], rng: random.Random) -> list:
    """Las combinaciones en un orden al azar ponderado por "Practicar más": la primera de la lista
    que cumpla una condición sale con la probabilidad de su peso entre las que la cumplen."""
    def clave(peso):  # u^(1/peso): ordenar por ella es sortear sin reemplazo con esos pesos
        u = rng.random()
        return u ** (1 / peso) if peso > 0 else 0.0
    claves = {id(c): clave(peso_practicar(c.acciones, practicar)) for c in combos}
    return sorted(combos, key=lambda c: claves[id(c)], reverse=True)


class SorteoGrupo:
    """Sortea dentro de un grupo de combinaciones (ortodoxas): pesos de "Practicar más", ventana de
    no repetir y, si `cobertura`, primero las que añaden golpes del 1 al 6 que falten."""

    def __init__(self, combos, practicar: list[dict], zurdo: bool, rng: random.Random, cobertura: bool):
        self.combos = list(combos)
        self.practicar = practicar
        self.zurdo = zurdo
        self.rng = rng
        self.recientes: list[int | str] = []  # identidad de las últimas sacadas
        self.faltan = set(NUMEROS) if cobertura else set()

    def _candidatas(self) -> list:
        libres = [c for c in self.combos if identidad(c) not in self.recientes]
        return [c for c in libres if numeros(c) & self.faltan] or libres

    def siguiente(self) -> Combinacion:
        candidatas = self._candidatas()
        # Mientras falten golpes, pesan más las que añaden más: así están todos antes.
        pesos = [peso_practicar(c.acciones, self.practicar) * max(1, len(numeros(c) & self.faltan))
                 for c in candidatas]
        elegida = self.rng.choices(candidatas, weights=pesos)[0]
        k = ventana(len(self.combos))
        self.recientes = (self.recientes + [identidad(elegida)])[-k:] if k else []
        self.faltan -= numeros(elegida)
        return self._combinacion(elegida)

    def _combinacion(self, combo) -> Combinacion:
        acciones = tuple(espejo_combo(list(combo.acciones))) if self.zurdo else combo.acciones
        if isinstance(combo, ComboPropia):
            return Combinacion(acciones, "propia")
        return Combinacion(acciones, "biblioteca", combo.nombre or combo.notacion)

    def guardar(self):
        """Lo que recuerda el sorteo, para sacar reservas sin que cuenten (ver restaurar)."""
        return list(self.recientes), set(self.faltan)

    def restaurar(self, estado) -> None:
        self.recientes, self.faltan = list(estado[0]), set(estado[1])


class SorteoBiblioteca(SorteoGrupo):
    """Da la siguiente combinación de la biblioteca para un nivel y perfil."""

    def __init__(self, nivel: int, perfil: dict | None = None, zurdo: bool = False,
                 rng: random.Random | None = None):
        self.nivel = nivel
        self.perfil = perfil if perfil is not None else cargar_perfil()
        super().__init__([c for c in biblioteca() if c.nivel == nivel], self.perfil.get("practicar") or [],
                         zurdo, rng or random.Random(), cobertura=True)

    def coletillas(self) -> list[Combinacion]:
        """Todas las coletillas en un orden al azar ponderado por "Practicar más": la primera de la
        lista que cumpla una condición sale con la probabilidad de su peso entre las que la
        cumplen. No cambia lo que recuerda el sorteo (recientes ni golpes que faltan)."""
        cortas = [c for c in biblioteca() if c.nivel == NIVEL_COLETILLA and es_corta(c)]
        return [self._combinacion(c) for c in orden_ponderado(cortas, self.practicar, self.rng)]


class SorteoMezcla:
    """El sorteo de la sesión con las propias, con la misma interfaz que SorteoBiblioteca
    (siguiente, coletillas, guardar, restaurar): el guion, las reservas y Reacción no cambian.

    - "ninguna" (o una mezcla que no se puede cumplir, ver mezcla_efectiva): exactamente
      SorteoBiblioteca, sin tirar moneda.
    - poco/bastante/mucho: en cada sorteo, con probabilidad PROBABILIDAD_PROPIAS una propia del
      nivel y si no, una de la biblioteca. Cada grupo con su ventana y sus pesos de "Practicar
      más"; la cobertura del 1 al 6 solo filtra la biblioteca, pero los golpes de las propias
      cuentan como ya salidos.
    - "solo": todas las propias, de cualquier nivel, sin cobertura.

    Coletillas: las propias cortas (2-3 acciones, de cualquier nivel) entre las de la biblioteca,
    con la misma moneda en cada puesto de la lista. Con «Solo las mías», primero todas las propias
    cortas y detrás las de la biblioteca, solo para rellenar: el guion dice la primera que quepa y
    no se haya dicho hace poco, y las propias suelen estar entre las recientes (son las del asalto).
    Sin propias cortas, las de la biblioteca (y Entrenar lo avisa).
    """

    def __init__(self, nivel: int, perfil: dict | None = None, zurdo: bool = False,
                 rng: random.Random | None = None, propias: list[dict] | None = None,
                 mezcla: str = "ninguna"):
        self.rng = rng or random.Random()
        self.biblioteca = SorteoBiblioteca(nivel, perfil, zurdo, self.rng)
        validas = propias_validas(propias)
        self.cortas = [p for p in validas if es_corta(p)]
        self.mezcla = mezcla_efectiva(mezcla, validas, nivel)
        del_grupo = validas if self.mezcla == "solo" else [p for p in validas if p.nivel == nivel]
        self.propias = SorteoGrupo(del_grupo, self.biblioteca.practicar, zurdo, self.rng, cobertura=False)

    def siguiente(self) -> Combinacion:
        if self.mezcla == "ninguna":
            return self.biblioteca.siguiente()
        if self.mezcla == "solo" or self.rng.random() < PROBABILIDAD_PROPIAS[self.mezcla]:
            combo = self.propias.siguiente()
            self.biblioteca.faltan -= {numero(a, self.biblioteca.zurdo) for a in combo.acciones}
            return combo
        return self.biblioteca.siguiente()

    def coletillas(self) -> list[Combinacion]:
        de_biblioteca = self.biblioteca.coletillas()
        if self.mezcla == "ninguna" or not self.cortas:
            return de_biblioteca
        propias = [self.propias._combinacion(c)
                   for c in orden_ponderado(self.cortas, self.biblioteca.practicar, self.rng)]
        if self.mezcla == "solo":
            return propias + de_biblioteca
        p = PROBABILIDAD_PROPIAS[self.mezcla]
        mezcladas = []
        while propias and de_biblioteca:
            mezcladas.append((propias if self.rng.random() < p else de_biblioteca).pop(0))
        return mezcladas + propias + de_biblioteca

    def guardar(self):
        """Lo que recuerdan los dos grupos (ver SorteoGrupo.guardar)."""
        return self.biblioteca.guardar(), self.propias.guardar()

    def restaurar(self, estado) -> None:
        self.biblioteca.restaurar(estado[0])
        self.propias.restaurar(estado[1])
