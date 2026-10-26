"""Tests unitarios de cada regla con ejemplos a mano (válidos e inválidos)."""
from motor.acciones import acciones_por_ids, catalogo
from motor.reglas import es_valida, ultimo_golpe, validar


def combo(*ids):
    return acciones_por_ids(list(ids))


# --- Ejemplos que pediste explícitamente ---

def test_jab_directo_es_valida_en_nivel_1():
    assert validar(combo("jab", "directo"), 1) == []


def test_esquiva_final_como_salida_es_valida_en_nivel_2():
    assert validar(combo("jab", "directo", "gancho_izq", "esquiva_der"), 2) == []


# --- Longitud y nivel ---

def test_longitud_por_nivel():
    assert not es_valida(combo("jab"), 1)
    assert not es_valida(combo("jab", "directo", "gancho_izq", "directo"), 1)
    assert not es_valida(combo("jab", "directo"), 2)


def test_uppercuts_y_cuerpo_solo_desde_nivel_2():
    for accion in catalogo().values():
        if accion.familia == "uppercut" or accion.objetivo == "cuerpo":
            assert accion.nivel_minimo >= 2, accion.id
    assert not es_valida(combo("jab", "uppercut_der"), 1)
    assert not es_valida(combo("jab", "directo_cuerpo"), 1)


def test_sin_golpes_no_es_combinacion():
    assert not es_valida(combo("esquiva_der", "pivote"), 1)


# --- Cargar y soltar ---

def test_esquiva_derecha_carga_la_derecha():
    assert es_valida(combo("esquiva_der", "directo"), 1)
    assert not es_valida(combo("esquiva_der", "gancho_izq"), 1)


def test_esquiva_izquierda_carga_la_izquierda():
    assert es_valida(combo("esquiva_izq", "gancho_izq"), 1)
    assert not es_valida(combo("esquiva_izq", "directo"), 1)


def test_paso_atras_va_con_directo_de_contra():
    assert es_valida(combo("paso_atras", "directo"), 1)
    assert not es_valida(combo("paso_atras", "jab"), 1)


def test_rodar_gancho_del_lado_cargado():
    assert es_valida(combo("rodar_izq", "gancho_izq"), 1)
    assert es_valida(combo("rodar_der", "gancho_der"), 1)
    assert not es_valida(combo("rodar_izq", "gancho_der"), 1)


# --- Bloquear y devolver ---

def test_bloqueo_nunca_termina_y_va_seguido_de_golpe():
    assert not es_valida(combo("jab", "bloqueo"), 1)
    assert not es_valida(combo("bloqueo", "pivote", "jab"), 1)
    assert es_valida(combo("bloqueo", "gancho_izq"), 1)


# --- Alternar manos ---

def test_repetir_mano_solo_en_excepciones():
    assert es_valida(combo("jab", "jab", "directo"), 1)                   # doble jab
    assert not es_valida(combo("directo", "directo"), 1)
    assert not es_valida(combo("jab", "gancho_izq"), 1)
    assert es_valida(combo("jab", "directo", "gancho_izq", "gancho_izq_cuerpo", "salir"), 3)
    assert not es_valida(combo("jab", "jab", "jab"), 1)                   # triple: no


# --- Salida tras golpe de poder ---

def test_nivel_2_y_3_salen_tras_golpe_de_poder():
    assert not es_valida(combo("jab", "directo", "gancho_izq"), 2)
    assert es_valida(combo("jab", "directo", "gancho_izq", "pivote"), 2)
    assert es_valida(combo("directo", "gancho_izq", "directo", "jab"), 2)  # termina en jab: no es de poder


def test_ultimo_golpe_ignora_la_salida():
    assert ultimo_golpe(combo("jab", "directo", "gancho_izq", "esquiva_der")).id == "gancho_izq"
