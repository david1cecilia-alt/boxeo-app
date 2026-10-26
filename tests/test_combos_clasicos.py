"""Todas las combinaciones de data/combos.json deben pasar las reglas.

Si alguna falla, NO se cambia la regla: se avisa al usuario.
"""
import pytest

from motor.acciones import combos_clasicos
from motor.reglas import validar


@pytest.mark.parametrize("combo", combos_clasicos(), ids=lambda c: c.nombre)
def test_combo_clasico_cumple_las_reglas(combo):
    errores = validar(list(combo.acciones), combo.nivel)
    assert not errores, f"El combo clásico '{combo.nombre}' no pasa las reglas: {errores}"


def test_hay_combos_clasicos_en_todos_los_niveles():
    assert {c.nivel for c in combos_clasicos()} == {1, 2, 3}
