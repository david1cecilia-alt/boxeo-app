"""Ritmo 1-5: pausa entre combinaciones al azar en su rango, más larga tras las combinaciones largas."""
import random

import pytest

from motor.acciones import acciones_por_ids, texto_hablado
from motor.ritmo import PAUSA_POR_RITMO, duracion_estimada, pausa_entre_combos, rango_pausa, segundos_habla
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
    assert cuantas(5) > 1.6 * cuantas(1)


@pytest.mark.parametrize("voz, esperado", [("nombres", "recto"), ("numeros", "dos"), ("ambos", "dos recto")])
def test_el_guion_dice_las_combinaciones_en_el_modo_elegido(voz, esperado):
    config = ConfigSesion(asaltos=1, duracion_asalto=180, descanso=0, voz=voz)
    textos = [e.texto for e in construir_guion(config, random.Random(0)) if e.tipo == "combo"]
    assert any(esperado in t.split(", ") for t in textos)


# Medidas de la voz del navegador (Microsoft Helena, es-ES, velocidad 1,1): de que empieza a
# hablar a que termina. La estimación no puede quedarse corta: la pausa cuenta desde el final.
MEDIDAS_VOZ = [
    ("uno, dos", 1.87),
    ("jab, recto", 2.07),
    ("uno jab, dos recto", 2.35),
    ("jab, gancho de izquierda", 2.61),
    ("cinco uppercut de izquierda, dos recto", 3.07),
    ("uno, dos, rueda, cuatro, rueda, tres, dos", 5.94),
    ("jab, recto, rueda, gancho de derecha, rueda, gancho de izquierda, recto", 7.27),
    ("uno jab, dos recto, rueda, cuatro gancho de derecha, rueda, tres gancho de izquierda, dos recto", 8.33),
]


@pytest.mark.parametrize("texto, medido", MEDIDAS_VOZ)
def test_la_estimacion_de_lo_que_se_habla_casa_con_la_voz_real(texto, medido):
    assert medido - 0.2 <= segundos_habla(texto) <= medido + 0.6


def test_ambos_tarda_mas_que_nombres_y_nombres_mas_que_numeros():
    combo = acciones_por_ids(["jab", "directo", "gancho_izq", "uppercut_der"])
    numeros, nombres, ambos = (duracion_estimada(combo, texto_hablado(combo, m)) for m in ("numeros", "nombres", "ambos"))
    assert numeros < nombres < ambos


@pytest.mark.parametrize("voz", ["numeros", "nombres", "ambos"])
@pytest.mark.parametrize("zurdo", [False, True])
def test_la_pausa_cuenta_desde_que_termina_de_hablar(voz, zurdo):
    config = ConfigSesion(asaltos=2, duracion_asalto=180, descanso=30, nivel=3, ritmo=5, voz=voz, zurdo=zurdo)
    combos = [e for e in construir_guion(config, random.Random(1)) if e.tipo == "combo"]
    for a, b in zip(combos, combos[1:]):
        if a.asalto != b.asalto:
            continue
        acciones = acciones_por_ids(a.ids)
        termina_de_hablar = a.t + segundos_habla(a.texto)
        minima, _ = rango_pausa(config.ritmo, acciones)
        assert b.t >= termina_de_hablar + minima, f"{a.texto!r} a los {a.t} s pisa la pausa"
