"""La propuesta de biblioteca nueva (herramientas/biblioteca.py) cuadra y su documento está al día."""
from herramientas.biblioteca import SALIDA, documento, preparar


def test_la_propuesta_cumple_reparto_clasicos_y_balance():
    _, malos = preparar()
    assert malos == []


def test_el_documento_esta_al_dia():
    combos, _ = preparar()
    assert SALIDA.read_text(encoding="utf-8") == documento(combos), "Ejecuta: python herramientas/biblioteca.py"
