from dataclasses import replace

from motor.acciones import catalogo, espejo


def test_espejo_dos_veces_es_la_identidad():
    for accion in catalogo().values():
        assert espejo(espejo(accion)) == accion


def test_acciones_con_lado_tienen_su_simetrica_en_el_catalogo():
    # Comprueba que los datos son simétricos: el espejo de gancho_izq ES gancho_der.
    cat = catalogo()
    for accion in cat.values():
        reflejada = espejo(accion)
        if reflejada.id != accion.id:
            assert reflejada in cat.values()
            assert replace(reflejada, id=accion.id) != accion


def test_espejo_intercambia_mano_lado_y_peso():
    cat = catalogo()
    assert espejo(cat["gancho_izq"]).nombre_hablado == "gancho de derecha"
    assert espejo(cat["esquiva_der"]).nombre_hablado == "esquiva a la izquierda"
    assert espejo(cat["uppercut_der_cuerpo"]).nombre_hablado == "uppercut de izquierda al cuerpo"
    assert espejo(cat["esquiva_der"]).peso_despues == "izq"


def test_jab_y_directo_cambian_de_mano_pero_no_de_nombre():
    cat = catalogo()
    jab_zurdo = espejo(cat["jab"])
    assert jab_zurdo.mano == "der"
    assert jab_zurdo.nombre_hablado == "jab"
    assert espejo(cat["directo"]).mano == "izq"
    assert espejo(cat["directo"]).nombre_hablado == "directo"


def test_ningun_nombre_lleva_numeros():
    for accion in catalogo().values():
        assert not any(c.isdigit() for c in accion.nombre_hablado)
