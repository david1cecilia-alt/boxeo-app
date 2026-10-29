"""Ritmo 1-5: pausa entre combinaciones al azar en su rango, más larga tras las combinaciones largas."""
import random

import pytest

from motor.acciones import acciones_por_ids
from motor.ritmo import PAUSA_POR_RITMO, pausa_entre_combos, rango_pausa
from motor.temporizador import ConfigSesion, construir_guion

CORTA = acciones_por_ids(["jab", "directo"])
LARGA = acciones_por_ids(["jab", "directo", "gancho_izq", "directo", "gancho_izq", "directo"])


def test_de_calmado_a_intenso():
    assert PAUSA_POR_RITMO[1] == (6.0, 8.0)
    assert PAUSA_POR_RITMO[5] == (1.5, 2.5)
    minimos = [PAUSA_POR_RITMO[r][0] for r in range(1, 6)]
    maximos = [PAUSA_POR_RITMO[r][1] for r in range(1, 6)]
    assert minimos == sorted(minimos, reverse=True) and maximos == sorted(maximos, reverse=True)


@pytest.mark.parametrize("ritmo", range(1, 6))
def test_la_pausa_varia_dentro_de_su_rango(ritmo):
    rng = random.Random(ritmo)
    pausas = [pausa_entre_combos(ritmo, CORTA, rng) for _ in range(500)]
    minimo, maximo = PAUSA_POR_RITMO[ritmo]
    assert all(minimo <= p <= maximo for p in pausas)
    assert len(set(pausas)) > 50, "debe variar"


def test_las_combinaciones_largas_dejan_mas_pausa():
    assert rango_pausa(3, LARGA)[0] > rango_pausa(3, CORTA)[0]
    assert rango_pausa(3, LARGA)[0] == pytest.approx(PAUSA_POR_RITMO[3][0] + 3 * 0.3)


def test_la_pausa_fija_del_usuario_manda():
    assert pausa_entre_combos(1, LARGA, random.Random(0), pausa=2.0) == 2.0


def test_con_ritmo_intenso_caben_muchas_mas_combinaciones():
    def cuantas(ritmo):
        config = ConfigSesion(asaltos=3, duracion_asalto=180, descanso=60, ritmo=ritmo)
        return sum(e.tipo == "combo" for e in construir_guion(config, random.Random(0)))
    assert cuantas(5) > 1.8 * cuantas(1)


@pytest.mark.parametrize("voz, esperado", [("nombres", "recto"), ("numeros", "dos"), ("ambos", "dos recto")])
def test_el_guion_dice_las_combinaciones_en_el_modo_elegido(voz, esperado):
    config = ConfigSesion(asaltos=1, duracion_asalto=180, descanso=0, voz=voz)
    textos = [e.texto for e in construir_guion(config, random.Random(0)) if e.tipo == "combo"]
    assert any(esperado in t.split(", ") for t in textos)
