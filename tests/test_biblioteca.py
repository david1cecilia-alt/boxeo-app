"""La biblioteca (data/combinaciones.json) está bien formada y pasa las reglas del motor.

Si alguna combinación falla, NO se cambia la regla: se avisa al usuario.
"""
import json
from collections import Counter

import pytest

from motor.acciones import RUTA_DATOS, biblioteca, notacion
from motor.reglas import nivel_de, validar

NUMEROS = set(range(1, 7))
VENTANA = 5  # el sorteo no repite ninguna de las 5 últimas


@pytest.fixture(scope="module")
def crudo():
    with open(RUTA_DATOS / "combinaciones.json", encoding="utf-8") as f:
        return json.load(f)


@pytest.mark.parametrize("combo", biblioteca(), ids=lambda c: c.notacion)
def test_cada_combinacion_pasa_las_reglas(combo):
    errores = validar(list(combo.acciones))
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
    # El sorteo de cada nivel solo usa las suyas.
    disponibles = [c for c in biblioteca() if c.nivel == nivel]
    numeros = {a.numero for c in disponibles for a in c.acciones if a.numero}
    assert numeros == NUMEROS
    assert len(disponibles) > VENTANA, f"nivel {nivel}: solo {len(disponibles)}"


def test_50_por_nivel_con_el_nivel_de_su_numero_de_acciones():
    assert Counter(c.nivel for c in biblioteca()) == {1: 50, 2: 50, 3: 50}
    for c in biblioteca():
        assert c.nivel == nivel_de(list(c.acciones)), c.notacion


def test_todas_tienen_nombre():
    assert all(c.nombre for c in biblioteca())


def test_toda_la_biblioteca_esta_marcada_para_revisar(crudo):
    assert "REVISAR CON ENTRENADOR: toda la biblioteca" in crudo["_nota"]


def test_las_dudas_de_tecnica_estan_en_los_datos_y_en_revisar_json(crudo):
    # Las 8 marcadas en herramientas/biblioteca.py y las 15 con 5-6 o 6-5 seguidos (3 coinciden).
    con_duda = [c for c in crudo["combinaciones"] if "revisar" in c]
    assert sorted(c["n"] for c in con_duda) == [31, 33, 35, 38, 39, 41, 43, 51, 53, 55, 57, 59, 61, 63, 65, 67, 75,
                                                113, 144, 146]
    puntos = json.loads((RUTA_DATOS / "revisar.json").read_text(encoding="utf-8"))["puntos"]
    textos = {p["texto"] for p in puntos if p["origen"] == "data/combinaciones.json"}
    for c in con_duda:
        assert c["revisar"].split("REVISAR CON ENTRENADOR:", 1)[1].strip() in textos, c["n"]
