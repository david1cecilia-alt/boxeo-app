"""Las reglas son solo estructurales: al menos un golpe. El resto lo decide la situación."""
import pytest

from motor.acciones import acciones_por_ids, catalogo
from motor.reglas import MAX_ACCIONES, es_valida, nivel_de, ultimo_golpe, validar


def combo(*ids):
    return acciones_por_ids(list(ids))


def test_jab_recto_es_valida():
    assert validar(combo("jab", "directo")) == []


def test_sin_golpes_no_es_combinacion():
    assert validar(combo("esquiva_der", "pivote")) == ["no hay ningún golpe"]


def test_tras_una_defensa_puede_ir_cualquier_golpe():
    for defensa in [a.id for a in catalogo().values() if a.tipo == "defensa"]:
        for golpe in ("jab", "directo", "gancho_izq", "gancho_der", "uppercut_izq", "uppercut_der"):
            assert es_valida(combo(defensa, golpe)), (defensa, golpe)


def test_se_puede_acabar_bloqueando_y_repetir_mano():
    assert es_valida(combo("jab", "directo", "bloqueo"))
    assert es_valida(combo("bloqueo", "pivote", "jab"))
    assert es_valida(combo("directo", "directo"))
    assert es_valida(combo("jab", "uppercut_izq"))


def test_se_puede_acabar_en_golpe_de_poder_o_en_cualquier_defensa():
    assert es_valida(combo("jab", "directo", "gancho_izq"))
    assert es_valida(combo("jab", "directo", "gancho_izq", "paso_atras"))
    assert es_valida(combo("jab", "directo", "gancho_izq", "parada"))


def test_ninguna_accion_tiene_nivel_minimo():
    # Golpes al cuerpo y todas las defensas valen desde básico: el nivel lo da solo la longitud.
    assert es_valida(combo("jab", "directo_cuerpo"))
    assert es_valida(combo("rodar_izq", "gancho_izq"))
    assert not any(hasattr(a, "nivel_minimo") for a in catalogo().values())


def test_salir_se_dice_cambio_de_angulo():
    assert catalogo()["salir"].nombre_hablado == "cambio de ángulo"


def test_ultimo_golpe_ignora_la_salida():
    assert ultimo_golpe(combo("jab", "directo", "gancho_izq", "esquiva_der")).id == "gancho_izq"
    assert ultimo_golpe(combo("esquiva_der", "pivote")) is None


# --- Nivel por número de acciones ---

@pytest.mark.parametrize("n, nivel", [(0, None), (1, None), (2, 1), (4, 1), (5, 2), (6, 2), (7, 3), (10, 3), (11, None)])
def test_nivel_por_numero_de_acciones_en_los_bordes(n, nivel):
    assert nivel_de(combo(*["jab"] * n)) == nivel


def test_cuentan_golpes_defensas_y_salidas_por_igual():
    assert nivel_de(combo("jab", "gancho_izq", "rodar_der")) == 1
    assert nivel_de(combo("jab", "gancho_izq", "rodar_der", "uppercut_der", "gancho_der")) == 2
    assert nivel_de(combo("jab", "gancho_izq", "rodar_der", "uppercut_der", "gancho_der", "salir", "gancho_izq")) == 3
    assert nivel_de(combo("bloqueo", "paso_atras", "pivote", "salir")) == 1  # sin golpe no es válida, pero tiene nivel


def test_como_mucho_10_acciones():
    assert MAX_ACCIONES == 10
    assert nivel_de(combo(*["jab", "directo"] * 5)) == 3
    assert nivel_de(combo(*["jab", "directo"] * 5, "salir")) is None
