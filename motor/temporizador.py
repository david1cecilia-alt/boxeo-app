"""Construye el guion de una sesión: lista de eventos con su segundo exacto.

El frontend solo reproduce este guion; aquí está toda la lógica de tiempos.
"""
import json
import random
from dataclasses import asdict, dataclass, field, replace

from motor.acciones import MODOS_VOZ, RUTA_DATOS, texto_hablado
from motor.sorteo import SIN_REPETIR, SorteoBiblioteca
from motor.ritmo import (RITMO_POR_DEFECTO, VELOCIDAD_MEDIDA, VELOCIDADES, duracion_estimada,
                         pausa_entre_combos, rango_pausa)

PREPARACION = 3.0         # segundos al inicio del asalto antes del primer combo
AVISO_ANTES_FIN = 10.0    # aviso a los 10 s del final
DURACION_AVISO = 1.5      # lo que ocupa decir "diez segundos"
DURACION_REACCION = 2.0   # señal + tiempo para reaccionar
INTERVALO_REACCION = (8.0, 20.0)  # separación aleatoria entre señales de reacción
MARGEN = 0.5              # hueco mínimo entre una combinación y una señal
REINTENTOS = 5            # combinaciones que se prueban si no cabe ninguna en un asalto aún vacío
# El dictado cuenta los huecos desde que la voz calla de verdad: si habla más rápido que la
# estimación, se come las combinaciones del guion antes de tiempo. Las reservas alcanzan aunque la
# voz tardara solo esta fracción de lo estimado.
FACTOR_VOZ_RAPIDA = 0.5


@dataclass
class ConfigSesion:
    asaltos: int = 3
    duracion_asalto: float = 180
    descanso: float = 60
    nivel: int = 1
    zurdo: bool = False
    modo_reaccion: bool = False
    pausa: float | None = None  # pausa fija entre combinaciones; None = la del ritmo
    ritmo: int = RITMO_POR_DEFECTO  # 1 Calmado … 5 Intenso
    voz: str = "nombres"        # cómo se dicen: uno de MODOS_VOZ
    velocidad: float = VELOCIDAD_MEDIDA  # de la voz: uno de VELOCIDADES

    def __post_init__(self):
        assert self.voz in MODOS_VOZ, self.voz
        assert self.velocidad in VELOCIDADES.values(), self.velocidad


@dataclass
class Evento:
    t: float           # segundo desde el inicio de la sesión
    tipo: str          # inicio_asalto | combo | reserva | coletilla | reaccion | aviso | fin_asalto
    asalto: int        # | descanso | fin_sesion
    duracion: float = 0.0
    texto: str = ""
    ids: list[str] = field(default_factory=list)
    hueco: float = 0.0  # combinaciones: pausa desde que se calla hasta la siguiente


# Las reservas no tienen hora: van al final del asalto (t = fin) y solo se dicen si el dictado
# llega a ellas, tras las combinaciones del asalto y en su orden. Las coletillas (cortas, para
# rellenar el final donde ya no cabe una del nivel) van todas con t = fin, en su orden al azar: de
# ahí elige el dictado. Las que dice el guion se repiten con su hora.
COMBINACIONES = ("combo", "reserva", "coletilla")


def cargar_presets() -> dict:
    with open(RUTA_DATOS / "presets.json", encoding="utf-8") as f:
        return json.load(f)


def _solapa(ini: float, fin: float, reservados: list[tuple[float, float]]) -> tuple[float, float] | None:
    for r_ini, r_fin in reservados:
        if ini < r_fin + MARGEN and r_ini - MARGEN < fin:
            return r_ini, r_fin
    return None


def _cabe(t: float, d: float, reservados: list[tuple[float, float]], fin: float) -> bool:
    return t + d <= fin and _solapa(t, t + d, reservados) is None


def elegir_siguiente(t: float, siguiente: Evento | None, coletillas: list[Evento],
                     reservados: list[tuple[float, float]], fin: float,
                     recientes: list[tuple[str, ...]]) -> tuple[Evento, float] | None:
    """Qué combinación decir desde el segundo t y cuándo: (combinación, empieza), o None si ya no
    cabe ninguna en el asalto. La usan el guion (con lo estimado) y el dictado (con la voz real).

    `siguiente`: la próxima del asalto (None si no quedan); `coletillas`: las cortas, en su orden
    al azar; `recientes`: ids de las últimas dichas, que una coletilla no repite;
    `reservados`: señales previstas, ordenadas (la última es el aviso).
    Si la siguiente no cabe (pisaría una señal o se pasa del final) y ya solo queda el aviso por
    delante, se dice la primera coletilla que quepa; si tampoco, se espera a que pase la señal."""
    while True:
        if siguiente and _cabe(t, siguiente.duracion, reservados, fin):
            return siguiente, t
        if all(ini <= t for ini, _ in reservados[:-1]):
            for c in coletillas:
                if tuple(c.ids) not in recientes and _cabe(t, c.duracion, reservados, fin):
                    return c, t
        despues = [r_fin + MARGEN for _, r_fin in reservados if r_fin + MARGEN > t]
        if not despues:
            return None
        t = min(despues)


def siguiente_tras_voz(fin_voz: float, hueco: float, hueco_minimo: float, siguiente: Evento | None,
                       coletillas: list[Evento], reservados: list[tuple[float, float]], fin: float,
                       recientes: list[tuple[str, ...]]) -> tuple[Evento, float] | None:
    """Como elegir_siguiente tras callar la voz en fin_voz y esperar el hueco. Si con ese hueco ya
    no cabe nada en el asalto, se prueba con el mínimo del ritmo: así el silencio final es como
    mucho ese mínimo más lo que dura la coletilla más corta."""
    return (elegir_siguiente(round(fin_voz + hueco, 2), siguiente, coletillas, reservados, fin, recientes)
            or elegir_siguiente(round(fin_voz + hueco_minimo, 2), siguiente, coletillas, reservados, fin,
                                recientes))


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
                    sorteo=None) -> list[Evento]:
    """`sorteo`: un SorteoBiblioteca (por defecto, el de la biblioteca) o cualquier objeto con
    siguiente(), coletillas(), guardar() y restaurar()."""
    rng = rng or random.Random()
    sorteo = sorteo or SorteoBiblioteca(config.nivel, zurdo=config.zurdo, rng=rng)
    reacciones = cargar_presets()["reacciones"]
    hueco_minimo = rango_pausa(config.ritmo, config.pausa)[0]
    eventos: list[Evento] = []
    t_asalto = 0.0
    pendiente = None  # la que no cupo al final del asalto: abre el siguiente (no se pierde)
    recientes: list[tuple[str, ...]] = []  # ids de las últimas dichas

    def a_evento(combo, tipo: str, asalto: int) -> Evento:
        # El hueco tras cada una se sortea aquí, una sola vez: el dictado usa este mismo.
        texto = texto_hablado(combo.acciones, config.voz, config.zurdo)
        return Evento(0.0, tipo, asalto, duracion_estimada(combo.acciones, texto, config.velocidad), texto,
                      [a.id for a in combo.acciones], pausa_entre_combos(config.ritmo, rng, config.pausa))

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

        # Colocar combinaciones en los huecos libres, como las dirá el dictado si la voz tarda
        # lo estimado.
        coletillas = [a_evento(c, "coletilla", n) for c in sorteo.coletillas()]
        antes = sorteo.guardar()  # lo que recordaba el sorteo antes de sacar la siguiente
        siguiente = replace(pendiente, asalto=n) if pendiente else a_evento(sorteo.siguiente(), "combo", n)
        apartada = None
        t = inicio + PREPARACION
        eleccion = elegir_siguiente(t, siguiente, coletillas, reservados, fin, recientes)
        # Asalto muy corto y aún vacío: la que no cabe espera al siguiente y se prueba otra.
        for _ in range(REINTENTOS):
            if eleccion:
                break
            apartada = apartada or siguiente
            antes = sorteo.guardar()
            siguiente = a_evento(sorteo.siguiente(), "combo", n)
            eleccion = elegir_siguiente(t, siguiente, coletillas, reservados, fin, recientes)
        dichas = []
        while eleccion:
            elegida, empieza = eleccion
            if elegida is siguiente:
                antes = sorteo.guardar()
                siguiente = a_evento(sorteo.siguiente(), "combo", n)
            dicha = replace(elegida, t=round(empieza, 2))  # una coletilla dicha sigue siendo coletilla
            dichas.append(dicha)
            recientes = (recientes + [tuple(dicha.ids)])[-SIN_REPETIR:]
            eleccion = siguiente_tras_voz(empieza + dicha.duracion, dicha.hueco, hueco_minimo, siguiente,
                                          coletillas, reservados, fin, recientes)
        eventos += dichas
        pendiente = apartada or siguiente

        # Reservas: siguen a la última dicha, así que se sacan como si la pendiente (que abre el
        # siguiente asalto) no hubiera salido, y sin dejar rastro en el sorteo: no cambian ni la
        # cobertura del 1 al 6 ni lo que se puede repetir en los asaltos siguientes.
        estado = sorteo.guardar()
        sorteo.restaurar(antes)
        ahorro = (1 - FACTOR_VOZ_RAPIDA) * sum(e.duracion for e in dichas)
        cubierto = 0.0
        while cubierto < ahorro:
            reserva = a_evento(sorteo.siguiente(), "reserva", n)
            eventos.append(replace(reserva, t=fin))
            cubierto += FACTOR_VOZ_RAPIDA * reserva.duracion + reserva.hueco
        sorteo.restaurar(estado)
        eventos += [replace(c, t=fin) for c in coletillas]

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
