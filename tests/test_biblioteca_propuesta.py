"""La propuesta de biblioteca nueva (herramientas/biblioteca.py) cuadra y su documento está al día."""
from herramientas.biblioteca import SALIDA, documento, preparar


def test_la_propuesta_cumple_reparto_clasicos_y_balance():
    _, malos = preparar()
    assert malos == []


def test_el_documento_esta_al_dia():
    combos, _ = preparar()
    assert SALIDA.read_text(encoding="utf-8") == documento(combos), "Ejecuta: python herramientas/biblioteca.py"


def test_el_nombre_tiene_que_decir_sus_golpes_en_orden():
    from herramientas.biblioteca import ids, nombre_cuadra
    from motor.acciones import acciones_por_ids

    def cuadra(nombre, notacion):
        return nombre_cuadra(nombre, acciones_por_ids(ids(notacion)))

    assert not cuadra("jab, recto-gancho-recto y esquiva abajo", "1-4-5-2-AD")
    assert cuadra("jab-crochet-gancho-recto y esquiva abajo", "1-4-5-2-AD")
    assert cuadra("jab-recto y paso lateral", "1-2-EI-5-2-LI")      # puede saltarse golpes
    assert not cuadra("recto-jab", "1-2")                           # pero no cambiar el orden
    assert not cuadra("jab-recto", "1-EI-2")                        # «X-Y» van seguidos
    assert cuadra("doble jab y recto", "1-1-2")
    assert not cuadra("doble jab y recto", "1-EI-1-2")              # doble = dos iguales seguidos
    assert cuadra("doble crochet", "4-3")
    assert cuadra("crochet abajo y arriba", "3c-3")
    assert not cuadra("crochet abajo y arriba", "3-3c")
    assert not cuadra("crochet y recto", "3c-2")                    # sin «al cuerpo», a la cabeza
    assert cuadra("ballesteo, jab y crochet de derecha", "BA-1-4")
    assert not cuadra("ballesteo, jab y crochet de derecha", "BA-1-3")
    assert cuadra("esquivas a los dos lados con ganchos", "ED-6-EI-5c")
