import random

import pytest

from motor.acciones import acciones_por_ids
from motor.ritmo import duracion_estimada
from motor.temporizador import (AVISO_ANTES_FIN, ConfigSesion, cargar_presets,
                                construir_guion)


def preset_amateur():
    p = next(p for p in cargar_presets()["presets"] if p["id"] == "amateur")
    return ConfigSesion(asaltos=p["asaltos"], duracion_asalto=p["duracion_asalto"], descanso=p["descanso"])


def de_tipo(guion, tipo):
    return [e for e in guion if e.tipo == tipo]


def test_preset_amateur_es_3x3_con_1_min_de_descanso():
    c = preset_amateur()
    assert (c.asaltos, c.duracion_asalto, c.descanso) == (3, 180, 60)
    guion = construir_guion(c, random.Random(0))
    assert [e.t for e in de_tipo(guion, "inicio_asalto")] == [0, 240, 480]
    assert [e.t for e in de_tipo(guion, "fin_asalto")] == [180, 420, 660]
    assert len(de_tipo(guion, "descanso")) == 2
    assert de_tipo(guion, "fin_sesion")[0].t == 660


def test_aviso_a_los_10_segundos_del_final_de_cada_asalto():
    guion = construir_guion(preset_amateur(), random.Random(0))
    finales = [e.t for e in de_tipo(guion, "fin_asalto")]
    assert [e.t for e in de_tipo(guion, "aviso")] == [f - AVISO_ANTES_FIN for f in finales]


def test_combos_dentro_del_asalto_y_sin_solaparse():
    guion = construir_guion(preset_amateur(), random.Random(0))
    asaltos = {e.asalto: (e.t, e.t + 180) for e in de_tipo(guion, "inicio_asalto")}
    combos = de_tipo(guion, "combo")
    assert combos
    for c in combos:
        ini, fin = asaltos[c.asalto]
        assert ini <= c.t and c.t + c.duracion <= fin
    for a, b in zip(combos, combos[1:]):
        assert a.t + a.duracion <= b.t, "una combinación empieza antes de que dé tiempo a la anterior"


def test_duracion_estimada_crece_con_el_numero_de_acciones():
    corta = duracion_estimada(acciones_por_ids(["jab", "directo"]))
    larga = duracion_estimada(acciones_por_ids(["jab", "directo", "gancho_izq", "esquiva_der"]))
    assert larga > corta > 0


@pytest.mark.parametrize("semilla", range(20))
@pytest.mark.parametrize("nivel", [1, 2, 3])
def test_reacciones_nunca_se_solapan_con_combos_ni_con_el_aviso(semilla, nivel):
    config = ConfigSesion(asaltos=3, duracion_asalto=180, descanso=60, nivel=nivel, modo_reaccion=True)
    guion = construir_guion(config, random.Random(semilla))
    reacciones = de_tipo(guion, "reaccion")
    assert reacciones
    ocupados = [(e.t, e.t + e.duracion) for e in guion if e.tipo in ("combo", "aviso")]
    for r in reacciones:
        for ini, fin in ocupados:
            assert r.t + r.duracion <= ini or fin <= r.t, f"reacción en {r.t} pisa intervalo {ini}-{fin}"


def test_sin_modo_reaccion_no_hay_senales():
    guion = construir_guion(preset_amateur(), random.Random(0))
    assert de_tipo(guion, "reaccion") == []


def test_zurdo_dicta_nombres_reflejados():
    config = ConfigSesion(asaltos=1, duracion_asalto=180, descanso=0, zurdo=True)
    combos = de_tipo(construir_guion(config, random.Random(0)), "combo")
    assert any("gancho de derecha" in c.texto for c in combos)
