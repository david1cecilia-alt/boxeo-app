"""Generador de combinaciones inventadas: reglas + biblioteca + pesos del perfil.

Todo se genera en ortodoxo; si el perfil es zurdo se refleja al final con espejo().
"""
import json
import random
from dataclasses import dataclass

from motor.acciones import (RUTA_DATOS, Accion, biblioteca, catalogo, espejo_combo,
                            repeticiones_permitidas, texto_hablado)
from motor.reglas import LONGITUD, SOLTAR_TRAS, es_valida, ultimo_golpe

# Peso base de cada tipo al elegir la siguiente acción del paseo.
PESO_TIPO = {"golpe": 4.0, "defensa": 1.5, "movimiento": 1.0}
# Hay tantas versiones al cuerpo como a la cabeza: sin esto saldrían la mitad de las veces.
PESO_CUERPO = 0.5


def _peso_paso(a: Accion) -> float:
    return PESO_TIPO[a.tipo] * (PESO_CUERPO if a.objetivo == "cuerpo" else 1.0)

PERFIL_NEUTRO = {"pesos": {}, "proporcion_clasicos": 0.3}


def cargar_perfil() -> dict:
    with open(RUTA_DATOS / "perfil.json", encoding="utf-8") as f:
        return json.load(f)


@dataclass(frozen=True)
class Combinacion:
    acciones: tuple[Accion, ...]
    origen: str               # "reglas" | "clasico"
    nombre: str | None = None  # nombre del combo clásico, si lo es

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


def _candidatas(previa: Accion | None, combo: list[Accion], es_ultima: bool,
                nivel: int, disponibles: list[Accion]) -> list[Accion]:
    """Acciones que pueden ir en la siguiente posición sin romper reglas locales."""
    opciones = []
    hay_golpe = any(a.tipo == "golpe" for a in combo)
    for a in disponibles:
        # Los movimientos solo como salida final (decisión del generador, no regla).
        if a.tipo == "movimiento" and not es_ultima:
            continue
        if es_ultima:
            if a.familia == "bloqueo":
                continue
            if not hay_golpe and a.tipo != "golpe":
                continue
            if nivel >= 2 and a.tipo == "golpe" and a.poder:
                continue
        if previa is not None:
            if previa.familia == "bloqueo" and a.tipo != "golpe":
                continue
            # Dos defensas seguidas no rompen reglas, pero el generador las evita:
            # se entrena defender Y devolver.
            if previa.tipo == "defensa" and a.tipo == "defensa":
                continue
            if a.tipo == "golpe":
                if previa.familia == "rodar" and (a.familia, a.mano) != ("gancho", previa.peso_despues):
                    continue
                permitidos = SOLTAR_TRAS.get(previa.id)
                if permitidos and (a.familia, a.mano) not in permitidos:
                    continue
                if (previa.tipo == "golpe" and previa.mano == a.mano
                        and (previa.id, a.id) not in repeticiones_permitidas()):
                    continue
        opciones.append(a)
    return opciones


def _paseo(nivel: int, rng: random.Random) -> list[Accion] | None:
    disponibles = [a for a in catalogo().values() if a.nivel_minimo <= nivel]
    longitud = rng.randint(*LONGITUD[nivel])
    combo: list[Accion] = []
    for i in range(longitud):
        previa = combo[-1] if combo else None
        opciones = _candidatas(previa, combo, i == longitud - 1, nivel, disponibles)
        if not opciones:
            return None
        combo.append(rng.choices(opciones, weights=[_peso_paso(a) for a in opciones])[0])
    return combo


class GeneradorCombos:
    """Da la siguiente combinación a dictar para un nivel y perfil."""

    def __init__(self, nivel: int, perfil: dict | None = None, zurdo: bool = False,
                 rng: random.Random | None = None):
        self.nivel = nivel
        self.perfil = perfil if perfil is not None else cargar_perfil()
        self.zurdo = zurdo
        self.rng = rng or random.Random()
        self.pesos = self.perfil.get("pesos", {})
        self._peso_max = 1.0
        for valor in self.pesos.values():
            self._peso_max *= max(valor, 1.0)
        self.refuerzo = self.perfil.get("refuerzo")
        if self.refuerzo:
            self._peso_max *= max(self.refuerzo["factor"], 1.0)
        # Solo los de la biblioteca que cumplen TODAS las reglas de ESTE nivel.
        self._clasicos = [c for c in biblioteca() if es_valida(list(c.acciones), nivel)]
        self._anterior: tuple[Accion, ...] | None = None

    def _candidata(self, clasico: bool) -> Combinacion | None:
        if clasico:
            c = self.rng.choice(self._clasicos)
            return Combinacion(c.acciones, "clasico", c.nombre or c.notacion)
        combo = _paseo(self.nivel, self.rng)
        if combo is None or not es_valida(combo, self.nivel):
            return None
        return Combinacion(tuple(combo), "reglas")

    def siguiente(self) -> Combinacion:
        # Primero se decide la rama, para que la proporción de clásicos sea la del perfil.
        clasico = bool(self._clasicos) and self.rng.random() < self.perfil.get("proporcion_clasicos", 0.3)
        while True:
            candidata = self._candidata(clasico)
            if candidata is None or candidata.acciones == self._anterior:
                continue
            aceptar = peso_perfil(list(candidata.acciones), self.pesos, self.refuerzo) / self._peso_max
            if self.rng.random() < aceptar:
                break
        self._anterior = candidata.acciones
        if self.zurdo:
            return Combinacion(tuple(espejo_combo(list(candidata.acciones))),
                               candidata.origen, candidata.nombre)
        return candidata
