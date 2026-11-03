"""Sorteo de la sesión: combinaciones de la biblioteca (data/combinaciones.json).

- Solo las del nivel elegido, todas con la misma probabilidad salvo "Practicar más" (perfil
  "practicar"): las que llevan un movimiento elegido pesan más, nunca se excluye ninguna.
- No repite ninguna de las últimas SIN_REPETIR.
- Hasta que hayan salido todos los golpes del 1 al 6, solo saca las que añaden alguno (en las
  6 primeras están todos seguro).
- Coletillas: las cortas (2-3 acciones) del nivel básico, para rellenar el final de un asalto
  donde ya no cabe una del nivel.

Todo en ortodoxo; si es zurdo se refleja al final con espejo().
"""
import json
import math
import random
from dataclasses import dataclass

from motor.acciones import (RUTA_DATOS, Accion, ComboBiblioteca, biblioteca, catalogo, espejo_combo,
                            texto_hablado)

SIN_REPETIR = 5
NUMEROS = frozenset(range(1, 7))
NIVEL_COLETILLA = 1
ACCIONES_COLETILLA = (2, 3)  # mínimo y máximo
# "Practicar más": cuánto multiplica cada movimiento elegido ("Un poco más", "Bastante más"). Si
# una combinación lleva varios elegidos se multiplican, como mucho TOPE_PRACTICAR.
FACTOR_PRACTICAR = {"poco": 2.0, "bastante": 4.0}
TOPE_PRACTICAR = 8.0


def cargar_perfil() -> dict:
    with open(RUTA_DATOS / "perfil.json", encoding="utf-8") as f:
        return json.load(f)


@dataclass(frozen=True)
class Combinacion:
    acciones: tuple[Accion, ...]
    origen: str               # "biblioteca"
    nombre: str | None = None  # nombre o notación de la combinación

    @property
    def texto(self) -> str:
        return texto_hablado(self.acciones)


def movimiento(accion: Accion) -> str:
    """El movimiento de "Practicar más" de una acción ortodoxa: "1"-"6" los golpes a la cara,
    "cuerpo" cualquier golpe al cuerpo y la familia las defensas y salidas ("rodar", "pivote")."""
    if accion.numero:
        return str(accion.numero)
    return "cuerpo" if accion.tipo == "golpe" else accion.familia


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


class SorteoBiblioteca:
    """Da la siguiente combinación de la biblioteca para un nivel y perfil."""

    def __init__(self, nivel: int, perfil: dict | None = None, zurdo: bool = False,
                 rng: random.Random | None = None):
        self.nivel = nivel
        self.perfil = perfil if perfil is not None else cargar_perfil()
        self.zurdo = zurdo
        self.rng = rng or random.Random()
        self.practicar = self.perfil.get("practicar") or []
        self.combos = [c for c in biblioteca() if c.nivel == nivel]
        self.recientes: list[ComboBiblioteca] = []
        self.faltan = set(NUMEROS)

    def _candidatas(self) -> list[ComboBiblioteca]:
        libres = [c for c in self.combos if c not in self.recientes]
        return [c for c in libres if numeros(c) & self.faltan] or libres

    def siguiente(self) -> Combinacion:
        candidatas = self._candidatas()
        # Mientras falten golpes, pesan más las que añaden más: así están todos antes.
        pesos = [peso_practicar(c.acciones, self.practicar) * max(1, len(numeros(c) & self.faltan))
                 for c in candidatas]
        elegida = self.rng.choices(candidatas, weights=pesos)[0]
        self.recientes = (self.recientes + [elegida])[-SIN_REPETIR:]
        self.faltan -= numeros(elegida)
        return self._combinacion(elegida)

    def _combinacion(self, combo: ComboBiblioteca) -> Combinacion:
        acciones = tuple(espejo_combo(list(combo.acciones))) if self.zurdo else combo.acciones
        return Combinacion(acciones, "biblioteca", combo.nombre or combo.notacion)

    def coletillas(self) -> list[Combinacion]:
        """Todas las coletillas en un orden al azar ponderado por "Practicar más": la primera de la
        lista que cumpla una condición sale con la probabilidad de su peso entre las que la
        cumplen. No cambia lo que recuerda el sorteo (recientes ni golpes que faltan)."""
        minimo, maximo = ACCIONES_COLETILLA
        cortas = [c for c in biblioteca() if c.nivel == NIVEL_COLETILLA and minimo <= len(c.acciones) <= maximo]
        def clave(peso):  # u^(1/peso): ordenar por ella es sortear sin reemplazo con esos pesos
            u = self.rng.random()
            return u ** (1 / peso) if peso > 0 else 0.0
        claves = {id(c): clave(peso_practicar(c.acciones, self.practicar)) for c in cortas}
        return [self._combinacion(c) for c in sorted(cortas, key=lambda c: claves[id(c)], reverse=True)]

    def guardar(self):
        """Lo que recuerda el sorteo, para sacar reservas sin que cuenten (ver restaurar)."""
        return list(self.recientes), set(self.faltan)

    def restaurar(self, estado) -> None:
        self.recientes, self.faltan = list(estado[0]), set(estado[1])
