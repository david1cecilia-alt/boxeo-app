"""Reservas y coletillas del guion: lo que el dictado tiene a mano si la voz va más rápida que la
estimación o si ya no cabe una combinación del nivel al final del asalto."""
import random

import pytest

from motor.acciones import acciones_por_ids, biblioteca
from motor.sorteo import ACCIONES_COLETILLA, NIVEL_COLETILLA, NUMEROS, NUMEROS_CUERPO, SIN_REPETIR, SorteoBiblioteca, numeros
from motor.temporizador import (FACTOR_VOZ_RAPIDA, MARGEN, ConfigSesion, Evento, construir_guion,
                                elegir_siguiente, siguiente_tras_voz)

CONFIG = ConfigSesion(asaltos=3, duracion_asalto=180, descanso=60, nivel=2)


def de_asalto(guion, n, tipo):
    return [e for e in guion if e.asalto == n and e.tipo == tipo]


@pytest.mark.parametrize("semilla", range(10))
def test_cada_asalto_lleva_reservas_que_alcanzan_aunque_la_voz_vaya_al_doble(semilla):
    guion = construir_guion(CONFIG, random.Random(semilla))
    for n in range(1, CONFIG.asaltos + 1):
        fin = next(e.t for e in guion if e.tipo == "fin_asalto" and e.asalto == n)
        dichas = de_asalto(guion, n, "combo")
        reservas = de_asalto(guion, n, "reserva")
        assert reservas and all(r.t == fin for r in reservas)
        ahorro = (1 - FACTOR_VOZ_RAPIDA) * sum(e.duracion for e in dichas)
        assert sum(FACTOR_VOZ_RAPIDA * r.duracion + r.hueco for r in reservas) >= ahorro
        tramo = [tuple(e.ids) for e in dichas + reservas]
        for i, ids in enumerate(tramo):
            assert ids not in tramo[max(0, i - SIN_REPETIR):i], "una reserva repite una reciente"


@pytest.mark.parametrize("semilla", range(10))
def test_las_coletillas_son_cortas_del_basico_y_estan_todas(semilla):
    guion = construir_guion(CONFIG, random.Random(semilla))
    minimo, maximo = ACCIONES_COLETILLA
    cortas = {tuple(a.id for a in c.acciones) for c in biblioteca()
              if c.nivel == NIVEL_COLETILLA and minimo <= len(c.acciones) <= maximo}
    for n in range(1, CONFIG.asaltos + 1):
        fin = next(e.t for e in guion if e.tipo == "fin_asalto" and e.asalto == n)
        coletillas = [tuple(e.ids) for e in de_asalto(guion, n, "coletilla") if e.t == fin]
        assert sorted(coletillas) == sorted(cortas)


class Apuntador(SorteoBiblioteca):
    """Apunta lo que se saca fuera de las reservas (entre dos restaurar)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.en_reserva = False
        self.cuentan = []
        self.identidades = []  # la de cada una de `cuentan`

    def siguiente(self):
        combo = super().siguiente()
        if not self.en_reserva:
            self.cuentan.append(combo)
            self.identidades.append(self.recientes[-1])
        return combo

    def restaurar(self, estado):
        super().restaurar(estado)
        self.en_reserva = not self.en_reserva


@pytest.mark.parametrize("semilla", range(20))
@pytest.mark.parametrize("nivel", [1, 2, 3])
def test_las_reservas_no_dejan_rastro_en_el_sorteo(semilla, nivel):
    # Sin rastro: la cobertura (1-6 y 7-12) y lo que no se repite siguen como sin reservas.
    rng = random.Random(semilla)
    sorteo = Apuntador(nivel, rng=rng)
    construir_guion(ConfigSesion(asaltos=3, duracion_asalto=180, nivel=nivel), rng, sorteo)
    assert sorteo.recientes == sorteo.identidades[-SIN_REPETIR:]
    dichos = set().union(*(numeros(c) for c in sorteo.cuentan))
    assert sorteo.faltan == set(NUMEROS | NUMEROS_CUERPO) - dichos


# ---------- elegir_siguiente ----------

def combo(duracion, ids=("jab", "directo"), hueco=2.0, tipo="combo"):
    return Evento(0.0, tipo, 1, duracion, "", list(ids), hueco)


CORTA = combo(2.0, ("jab", "jab"), tipo="coletilla")
OTRA_CORTA = combo(2.5, ("jab", "directo"), tipo="coletilla")


def test_si_cabe_la_del_nivel_va_ella():
    siguiente = combo(5.0, ("jab", "directo", "gancho_izq"))
    assert elegir_siguiente(100, siguiente, [CORTA], [], 180, []) == (siguiente, 100)


def test_al_final_si_no_cabe_la_del_nivel_va_una_coletilla_que_quepa():
    siguiente = combo(6.0, ("jab", "directo", "gancho_izq"))
    assert elegir_siguiente(177.0, siguiente, [OTRA_CORTA, CORTA], [], 180, []) == (OTRA_CORTA, 177.0)
    assert elegir_siguiente(178.0, siguiente, [OTRA_CORTA, CORTA], [], 180, []) == (CORTA, 178.0)
    assert elegir_siguiente(178.5, siguiente, [OTRA_CORTA, CORTA], [], 180, []) is None


def test_la_coletilla_no_repite_las_recientes():
    siguiente = combo(6.0, ("jab", "directo", "gancho_izq"))
    assert elegir_siguiente(176.0, siguiente, [CORTA, OTRA_CORTA], [], 180, [("jab", "jab")]) == (OTRA_CORTA, 176.0)


def test_antes_de_una_reaccion_se_espera_y_antes_del_aviso_va_una_coletilla():
    siguiente = combo(5.0, ("jab", "directo", "gancho_izq"))
    reaccion, aviso = (100.0, 102.0), (170.0, 171.5)
    assert elegir_siguiente(97.0, siguiente, [CORTA], [reaccion, aviso], 180, []) == (siguiente, 102.0 + MARGEN)
    assert elegir_siguiente(166.0, siguiente, [CORTA], [reaccion, aviso], 180, []) == (CORTA, 166.0)


def test_si_con_el_hueco_no_cabe_nada_se_prueba_con_el_minimo_del_ritmo():
    siguiente = combo(6.0, ("jab", "directo", "gancho_izq"))
    assert siguiente_tras_voz(170.0, 3.0, 2.0, siguiente, [CORTA], [], 180, []) == (siguiente, 173.0)
    assert siguiente_tras_voz(174.0, 4.0, 2.0, siguiente, [CORTA], [], 180, []) == (CORTA, 178.0)
    assert siguiente_tras_voz(174.5, 4.0, 2.0, siguiente, [CORTA], [], 180, []) == (CORTA, 176.5)
    assert siguiente_tras_voz(176.5, 4.0, 2.0, siguiente, [CORTA], [], 180, []) is None


@pytest.mark.parametrize("semilla", range(10))
def test_las_coletillas_que_dice_el_guion_no_repiten_las_recientes(semilla):
    guion = construir_guion(CONFIG, random.Random(semilla))
    fines = {e.asalto: e.t for e in guion if e.tipo == "fin_asalto"}
    # Las coletillas que no dice el guion van con t = fin del asalto.
    dichas = [e for e in guion if e.tipo == "combo" or (e.tipo == "coletilla" and e.t < fines[e.asalto])]
    for i, e in enumerate(dichas):
        if e.tipo == "coletilla":
            assert tuple(e.ids) not in [tuple(d.ids) for d in dichas[max(0, i - SIN_REPETIR):i]]
            assert len(acciones_por_ids(e.ids)) in range(ACCIONES_COLETILLA[0], ACCIONES_COLETILLA[1] + 1)
