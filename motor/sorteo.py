"""Sorteo de la sesión: combinaciones de la biblioteca (data/combinaciones.json).

- Solo las del nivel elegido o inferiores.
- No repite ninguna de las últimas SIN_REPETIR.
- Hasta que hayan salido todos los golpes del 1 al 6, solo saca las que añaden alguno (en las
  6 primeras están todos seguro).
- La proporción de combinaciones con defensa es la del nivel (defensa_por_nivel).
- Los pesos del perfil y el refuerzo de "Practicar" multiplican la probabilidad de cada una.

Todo en ortodoxo; si es zurdo se refleja al final con espejo().
"""
import json
import random
from dataclasses import dataclass

from motor.acciones import (RUTA_DATOS, Accion, ComboBiblioteca, biblioteca, defensa_por_nivel,
                            espejo_combo, texto_hablado)
from motor.reglas import ultimo_golpe

SIN_REPETIR = 5
NUMEROS = frozenset(range(1, 7))


PERFIL_NEUTRO = {"pesos": {}}


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


def peso_perfil(combo: list[Accion], pesos: dict, refuerzo: dict | None = None) -> float:
    """Multiplica los pesos del perfil que cumple la combinación (ortodoxa).

    `refuerzo` ({"acciones": [ids], "factor": x}) sube las combinaciones que llevan alguna
    de esas acciones: es el "Practicar" de una ficha, solo para una sesión.
    """
    peso = 1.0
    ultimo = ultimo_golpe(combo)
    if ultimo and ultimo.familia == "gancho":
        peso *= pesos.get("termina_en_gancho", 1.0)
    if any(a.familia == "bloqueo" for a in combo):
        peso *= pesos.get("bloquear_y_devolver", 1.0)
    if combo[0].id == "jab":
        peso *= pesos.get("entrada_con_jab", 1.0)
    if refuerzo and any(a.id in refuerzo["acciones"] for a in combo):
        peso *= refuerzo["factor"]
    return peso


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
        self.pesos = self.perfil.get("pesos", {})
        self.refuerzo = self.perfil.get("refuerzo")
        self.combos = [c for c in biblioteca() if c.nivel <= nivel]
        self.prob_defensa = defensa_por_nivel()[nivel]
        self.recientes: list[ComboBiblioteca] = []
        self.faltan = set(NUMEROS)

    def _candidatas(self) -> list[ComboBiblioteca]:
        con_defensa = self.rng.random() < self.prob_defensa
        libres = [c for c in self.combos if c not in self.recientes]
        del_tipo = [c for c in libres if c.con_defensa == con_defensa] or libres
        if not self.faltan:
            return del_tipo
        # La cobertura del 1 al 6 manda sobre la proporción de defensa.
        def nuevas(grupo): return [c for c in grupo if numeros(c) & self.faltan]
        return nuevas(del_tipo) or nuevas(libres) or del_tipo

    def siguiente(self) -> Combinacion:
        candidatas = self._candidatas()
        # Mientras falten golpes, pesan más las que añaden más: así están todos antes.
        pesos = [peso_perfil(list(c.acciones), self.pesos, self.refuerzo) * max(1, len(numeros(c) & self.faltan))
                 for c in candidatas]
        elegida = self.rng.choices(candidatas, weights=pesos)[0]
        self.recientes = (self.recientes + [elegida])[-SIN_REPETIR:]
        self.faltan -= numeros(elegida)
        acciones = tuple(espejo_combo(list(elegida.acciones))) if self.zurdo else elegida.acciones
        return Combinacion(acciones, "biblioteca", elegida.nombre or elegida.notacion)
