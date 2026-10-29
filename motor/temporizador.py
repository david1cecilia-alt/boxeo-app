"""Construye el guion de una sesión: lista de eventos con su segundo exacto.

El frontend solo reproduce este guion; aquí está toda la lógica de tiempos.
"""
import json
import random
from dataclasses import asdict, dataclass, field

from motor.acciones import RUTA_DATOS
from motor.sorteo import SorteoBiblioteca
from motor.ritmo import duracion_estimada, pausa_entre_combos

PREPARACION = 3.0         # segundos al inicio del asalto antes del primer combo
AVISO_ANTES_FIN = 10.0    # aviso a los 10 s del final
DURACION_AVISO = 1.5      # lo que ocupa decir "diez segundos"
DURACION_REACCION = 2.0   # señal + tiempo para reaccionar
INTERVALO_REACCION = (8.0, 20.0)  # separación aleatoria entre señales de reacción
MARGEN = 0.5              # hueco mínimo entre una combinación y una señal


@dataclass
class ConfigSesion:
    asaltos: int = 3
    duracion_asalto: float = 180
    descanso: float = 60
    nivel: int = 1
    zurdo: bool = False
    modo_reaccion: bool = False
    pausa: float | None = None  # None = la del nivel


@dataclass
class Evento:
    t: float           # segundo desde el inicio de la sesión
    tipo: str          # inicio_asalto | combo | reaccion | aviso | fin_asalto | descanso | fin_sesion
    asalto: int
    duracion: float = 0.0
    texto: str = ""
    ids: list[str] = field(default_factory=list)


def cargar_presets() -> dict:
    with open(RUTA_DATOS / "presets.json", encoding="utf-8") as f:
        return json.load(f)


def _solapa(ini: float, fin: float, reservados: list[tuple[float, float]]) -> tuple[float, float] | None:
    for r_ini, r_fin in reservados:
        if ini < r_fin + MARGEN and r_ini - MARGEN < fin:
            return r_ini, r_fin
    return None


def _reacciones(inicio: float, limite: float, rng: random.Random,
                reacciones: list[dict], asalto: int) -> list[Evento]:
    eventos = []
    t = inicio + rng.uniform(*INTERVALO_REACCION)
    while t + DURACION_REACCION <= limite:
        r = rng.choice(reacciones)
        eventos.append(Evento(round(t, 2), "reaccion", asalto, DURACION_REACCION, r["texto"], [r["id"]]))
        t += DURACION_REACCION + rng.uniform(*INTERVALO_REACCION)
    return eventos


def construir_guion(config: ConfigSesion, rng: random.Random | None = None,
                    generador=None) -> list[Evento]:
    """`generador`: cualquier objeto con siguiente() (por defecto, el sorteo de la biblioteca)."""
    rng = rng or random.Random()
    generador = generador or SorteoBiblioteca(config.nivel, zurdo=config.zurdo, rng=rng)
    reacciones = cargar_presets()["reacciones"]
    pausa = pausa_entre_combos(config.nivel, config.pausa)
    eventos: list[Evento] = []
    t_asalto = 0.0
    pendiente = None  # la que no cupo al final del asalto: abre el siguiente (no se pierde)

    for n in range(1, config.asaltos + 1):
        inicio, fin = t_asalto, t_asalto + config.duracion_asalto
        eventos.append(Evento(inicio, "inicio_asalto", n, texto=f"Asalto {n}"))

        aviso = fin - AVISO_ANTES_FIN
        reservados = [(aviso, aviso + DURACION_AVISO)]
        if config.modo_reaccion:
            senales = _reacciones(inicio + PREPARACION, aviso - MARGEN, rng, reacciones, n)
            eventos += senales
            reservados += [(e.t, e.t + e.duracion) for e in senales]
        reservados.sort()
        if aviso > inicio:
            eventos.append(Evento(aviso, "aviso", n, DURACION_AVISO, "diez segundos"))

        # Colocar combinaciones en los huecos libres.
        t = inicio + PREPARACION
        while True:
            combo, pendiente = pendiente or generador.siguiente(), None
            d = duracion_estimada(combo.acciones)
            while (choque := _solapa(t, t + d, reservados)):
                t = choque[1] + MARGEN
            if t + d > fin:
                pendiente = combo
                break
            eventos.append(Evento(round(t, 2), "combo", n, d, combo.texto,
                                  [a.id for a in combo.acciones]))
            t = round(t + d + pausa, 2)

        eventos.append(Evento(fin, "fin_asalto", n))
        t_asalto = fin
        if n < config.asaltos:
            eventos.append(Evento(fin, "descanso", n, config.descanso, "Descanso"))
            t_asalto += config.descanso

    eventos.append(Evento(t_asalto, "fin_sesion", config.asaltos, texto="Fin del entrenamiento"))
    eventos.sort(key=lambda e: e.t)
    return eventos


def guion_a_dict(eventos: list[Evento]) -> list[dict]:
    return [asdict(e) for e in eventos]
