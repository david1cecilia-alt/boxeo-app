"""La biblioteca (data/combinaciones.json) está bien formada y pasa las reglas técnicas.

Si alguna combinación falla, NO se cambia la regla: se avisa al usuario.
"""
import json

import pytest

from motor.acciones import RUTA_DATOS, biblioteca, defensa_por_nivel, notacion
from motor.reglas import REGLAS_TECNICAS, validar

NUMEROS = set(range(1, 7))
VENTANA = 5  # el sorteo no repite ninguna de las 5 últimas


@pytest.fixture(scope="module")
def crudo():
    with open(RUTA_DATOS / "combinaciones.json", encoding="utf-8") as f:
        return json.load(f)


@pytest.mark.parametrize("combo", biblioteca(), ids=lambda c: c.notacion)
def test_cada_combinacion_pasa_las_reglas_tecnicas(combo):
    errores = validar(list(combo.acciones), combo.nivel, reglas=REGLAS_TECNICAS)
    assert not errores, f"«{combo.notacion}» no pasa las reglas: {errores}"


def test_la_notacion_casa_con_los_ids():
    for c in biblioteca():
        assert notacion(c.acciones) == c.notacion


def test_sin_duplicados():
    claves = [tuple(a.id for a in c.acciones) for c in biblioteca()]
    assert len(claves) == len(set(claves))


def test_hay_combinaciones_en_los_tres_niveles():
    assert {c.nivel for c in biblioteca()} == {1, 2, 3}


@pytest.mark.parametrize("nivel", [1, 2, 3])
def test_cada_nivel_cubre_del_1_al_6_y_da_para_no_repetir(nivel):
    # Cada nivel incluye los inferiores.
    disponibles = [c for c in biblioteca() if c.nivel <= nivel]
    numeros = {a.numero for c in disponibles for a in c.acciones if a.numero}
    assert numeros == NUMEROS
    for con_defensa in (True, False):
        grupo = [c for c in disponibles if c.con_defensa == con_defensa]
        assert len(grupo) > VENTANA, f"nivel {nivel}, defensa={con_defensa}: solo {len(grupo)}"


def test_proporcion_de_defensa_por_nivel():
    assert defensa_por_nivel() == {1: 0.15, 2: 0.30, 3: 0.40}


def test_los_16_clasicos_de_antes_siguen_con_su_nombre():
    assert len([c for c in biblioteca() if c.nombre]) == 16


def test_no_hay_2_6_seguidos():
    for c in biblioteca():
        assert "-2-6-" not in f"-{c.notacion}-", c.notacion


def test_las_adaptadas_dicen_de_donde_vienen_y_por_que(crudo):
    for c in crudo["combinaciones"]:
        if "adaptada_de" in c:
            assert c["adaptada_de"] != c["notacion"] and c["motivo"], c["notacion"]


def test_toda_la_biblioteca_esta_marcada_para_revisar(crudo):
    assert "REVISAR CON ENTRENADOR: toda la biblioteca" in crudo["_nota"]
