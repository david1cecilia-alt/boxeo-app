"""Numeración de los golpes por mano adelantada/trasera y «Nombrar combinaciones»."""
import pytest

from motor.acciones import (MODOS_VOZ, acciones_por_ids, catalogo, espejo, espejo_combo, numero,
                            palabra_hablada, texto_hablado)

CARA = {"jab": 1, "directo": 2, "gancho_izq": 3, "gancho_der": 4, "uppercut_izq": 5, "uppercut_der": 6}
CUERPO = {"jab_cuerpo": 7, "directo_cuerpo": 8, "gancho_izq_cuerpo": 9, "gancho_der_cuerpo": 10,
          "uppercut_izq_cuerpo": 11, "uppercut_der_cuerpo": 12}
ORTODOXO = {**CARA, **CUERPO}


def test_numeros_del_1_al_12_en_ortodoxo():
    cat = catalogo()
    assert {i: numero(cat[i]) for i in ORTODOXO} == ORTODOXO
    con_numero = {a.id for a in cat.values() if a.numero is not None}
    assert con_numero == set(ORTODOXO), "solo los golpes llevan número"
    # Del 7 al 12, los mismos golpes que del 1 al 6, al cuerpo.
    for id_, n in CUERPO.items():
        a, cara = cat[id_], cat[id_.removesuffix("_cuerpo")]
        assert (a.familia, a.mano, a.objetivo, cara.numero + 6) == (cara.familia, cara.mano, "cuerpo", n), id_


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


def test_al_cuerpo_el_crochet_de_derecha_es_el_10_en_ortodoxo_y_el_9_en_zurdo():
    cat = catalogo()
    assert numero(cat["gancho_der_cuerpo"]) == 10
    assert numero(cat["gancho_der_cuerpo"], zurdo=True) == 9
    assert numero(cat["uppercut_izq_cuerpo"], zurdo=True) == 12
    assert numero(cat["jab_cuerpo"], zurdo=True) == 7  # el jab y el recto no cambian de número


def test_el_crochet_de_derecha_es_el_4_en_ortodoxo_y_el_3_en_zurdo():
    gancho_der = catalogo()["gancho_der"]
    assert numero(gancho_der) == 4
    assert numero(gancho_der, zurdo=True) == 3


def test_modos_de_voz():
    combo = acciones_por_ids(["jab", "directo", "esquiva_der", "gancho_izq"])
    assert texto_hablado(combo, "nombres") == "jab, recto, esquiva derecha, crochet de izquierda"
    assert texto_hablado(combo, "numeros") == "uno, dos, esquiva derecha, tres"
    assert texto_hablado(combo, "ambos") == "uno jab, dos recto, esquiva derecha, tres crochet de izquierda"


def test_modos_de_voz_en_zurdo():
    zurda = espejo_combo(acciones_por_ids(["jab", "gancho_izq", "uppercut_der", "rodar_izq", "gancho_izq"]))
    assert texto_hablado(zurda, "nombres", zurdo=True) == \
        "jab, crochet de derecha, gancho de izquierda, rueda derecha, crochet de derecha"
    assert texto_hablado(zurda, "numeros", zurdo=True) == "uno, tres, seis, rueda derecha, tres"
    assert texto_hablado(zurda, "ambos", zurdo=True) == \
        "uno jab, tres crochet de derecha, seis gancho de izquierda, rueda derecha, tres crochet de derecha"


def test_las_defensas_se_dicen_como_orden_corta_con_su_lado():
    for a in catalogo().values():
        if a.orden:
            assert {palabra_hablada(a, m) for m in MODOS_VOZ} == {{
                "esquiva_der": "esquiva derecha", "esquiva_izq": "esquiva izquierda",
                "rodar_der": "rueda derecha", "rodar_izq": "rueda izquierda",
                "paso_atras": "paso atrás", "bloqueo": "bloqueo", "parada": "parada",
                "ballesteo": "ballesteo", "flexion": "flexión"}[a.id]}, a.id


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
    adelantados = {"numeros": {"tres", "cinco"}, "nombres": {"crochet de derecha", "gancho de derecha"},
                   "ambos": {"tres crochet de derecha", "cinco gancho de derecha"}}[voz]
    assert adelantados <= set(dichos)
    if voz != "numeros":
        assert not {"tres crochet de izquierda", "cinco gancho de izquierda"} & set(dichos)


def test_ballesteo_y_flexion_son_defensas_sin_lado():
    cat = catalogo()
    for id_, dicho in (("ballesteo", "ballesteo"), ("flexion", "flexión")):
        a = cat[id_]
        assert (a.tipo, a.lado, a.mano) == ("defensa", "ninguno", "ninguna")
        assert espejo(a) == a
        assert texto_hablado(acciones_por_ids([id_, "directo"]), "ambos") == f"{dicho}, dos recto"


def test_al_cuerpo_en_numeros_se_dice_el_numero():
    combo = acciones_por_ids(["jab", "directo_cuerpo", "gancho_der_cuerpo", "esquiva_der", "uppercut_izq_cuerpo"])
    assert texto_hablado(combo, "numeros") == "uno, ocho, diez, esquiva derecha, once"
    assert texto_hablado(combo, "ambos") == \
        "uno jab, ocho recto al cuerpo, diez crochet de derecha al cuerpo, esquiva derecha, once gancho de izquierda al cuerpo"
    assert texto_hablado(combo, "nombres") == \
        "jab, recto al cuerpo, crochet de derecha al cuerpo, esquiva derecha, gancho de izquierda al cuerpo"


def test_al_cuerpo_en_zurdo_se_dice_por_mano_adelantada_y_trasera():
    zurda = espejo_combo(acciones_por_ids(["jab_cuerpo", "gancho_izq_cuerpo", "uppercut_der_cuerpo"]))
    assert texto_hablado(zurda, "numeros", zurdo=True) == "siete, nueve, doce"
    assert texto_hablado(zurda, "ambos", zurdo=True) == \
        "siete jab al cuerpo, nueve crochet de derecha al cuerpo, doce gancho de izquierda al cuerpo"
