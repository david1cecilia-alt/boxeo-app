"""Numeración de los golpes por mano adelantada/trasera y «Nombrar combinaciones»."""
import pytest

from motor.acciones import (MODOS_VOZ, acciones_por_ids, catalogo, espejo, espejo_combo, numero,
                            palabra_hablada, texto_hablado)

ORTODOXO = {"jab": 1, "directo": 2, "gancho_izq": 3, "gancho_der": 4, "uppercut_izq": 5, "uppercut_der": 6}


def test_numeros_del_1_al_6_en_ortodoxo():
    cat = catalogo()
    assert {i: numero(cat[i]) for i in ORTODOXO} == ORTODOXO
    con_numero = {a.id for a in cat.values() if a.numero is not None}
    assert con_numero == set(ORTODOXO), "del 7 al 12 (cuerpo) aún no"


def test_en_ortodoxo_la_adelantada_es_la_izquierda():
    for id_, n in ORTODOXO.items():
        a = catalogo()[id_]
        assert a.mano == ("izq" if n % 2 else "der"), id_


@pytest.mark.parametrize("id_, n", ORTODOXO.items())
def test_el_zurdo_numera_por_mano_adelantada_y_trasera(id_, n):
    zurda = espejo(catalogo()[id_])
    assert numero(zurda, zurdo=True) == n
    # Su mano adelantada es la derecha: los impares van con la derecha.
    assert zurda.mano == ("der" if n % 2 else "izq")


def test_el_gancho_de_derecha_es_el_4_en_ortodoxo_y_el_3_en_zurdo():
    gancho_der = catalogo()["gancho_der"]
    assert numero(gancho_der) == 4
    assert numero(gancho_der, zurdo=True) == 3


def test_modos_de_voz():
    combo = acciones_por_ids(["jab", "directo", "esquiva_der", "gancho_izq"])
    assert texto_hablado(combo, "nombres") == "jab, recto, esquiva derecha, gancho de izquierda"
    assert texto_hablado(combo, "numeros") == "uno, dos, esquiva derecha, tres"
    assert texto_hablado(combo, "ambos") == "uno jab, dos recto, esquiva derecha, tres gancho de izquierda"


def test_modos_de_voz_en_zurdo():
    zurda = espejo_combo(acciones_por_ids(["jab", "gancho_izq", "uppercut_der", "rodar_izq", "gancho_izq"]))
    assert texto_hablado(zurda, "nombres", zurdo=True) == \
        "jab, gancho de derecha, uppercut de izquierda, rueda derecha, gancho de derecha"
    assert texto_hablado(zurda, "numeros", zurdo=True) == "uno, tres, seis, rueda derecha, tres"
    assert texto_hablado(zurda, "ambos", zurdo=True) == \
        "uno jab, tres gancho de derecha, seis uppercut de izquierda, rueda derecha, tres gancho de derecha"


def test_las_defensas_se_dicen_como_orden_corta_con_su_lado():
    for a in catalogo().values():
        if a.orden:
            assert {palabra_hablada(a, m) for m in MODOS_VOZ} == {{
                "esquiva_der": "esquiva derecha", "esquiva_izq": "esquiva izquierda",
                "rodar_der": "rueda derecha", "rodar_izq": "rueda izquierda",
                "paso_atras": "atrás", "bloqueo": "bloquea"}[a.id]}, a.id


def test_sin_numero_se_dice_el_nombre_en_todos_los_modos():
    for a in catalogo().values():
        if a.numero is None and not a.orden:
            assert {palabra_hablada(a, m) for m in MODOS_VOZ} == {a.nombre_hablado}, a.id


@pytest.mark.parametrize("voz", MODOS_VOZ)
def test_el_guion_zurdo_dice_el_nombre_reflejado_y_no_solo_el_numero(voz):
    import random

    from motor.temporizador import ConfigSesion, construir_guion
    config = ConfigSesion(asaltos=3, duracion_asalto=180, descanso=60, nivel=3, zurdo=True, voz=voz)
    dichos = [palabra for e in construir_guion(config, random.Random(2)) if e.tipo == "combo"
              for palabra in e.texto.split(", ")]
    adelantados = {"numeros": {"tres", "cinco"}, "nombres": {"gancho de derecha", "uppercut de derecha"},
                   "ambos": {"tres gancho de derecha", "cinco uppercut de derecha"}}[voz]
    assert adelantados <= set(dichos)
    if voz != "numeros":
        assert not {"tres gancho de izquierda", "cinco uppercut de izquierda"} & set(dichos)
