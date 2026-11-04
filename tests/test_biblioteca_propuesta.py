"""La propuesta de biblioteca nueva (herramientas/biblioteca.py) cuadra y su documento está al día."""
from herramientas.biblioteca import DATOS, SALIDA, datos, documento, preparar


def test_la_propuesta_cumple_reparto_clasicos_y_balance():
    _, malos = preparar()
    assert malos == []


def test_el_documento_esta_al_dia():
    combos, _ = preparar()
    assert SALIDA.read_text(encoding="utf-8") == documento(combos), "Ejecuta: python herramientas/biblioteca.py"


def test_data_combinaciones_esta_al_dia():
    combos, _ = preparar()
    assert DATOS.read_text(encoding="utf-8") == datos(combos), "Ejecuta: python herramientas/biblioteca.py"


def test_el_nombre_tiene_que_decir_sus_golpes_en_orden():
    from herramientas.biblioteca import ids, nombre_cuadra
    from motor.acciones import acciones_por_ids

    def cuadra(nombre, notacion):
        return nombre_cuadra(nombre, acciones_por_ids(ids(notacion)))

    assert not cuadra("jab, recto-gancho-recto y rueda", "1-4-5-2-AD")
    assert cuadra("jab-crochet-gancho-recto y rueda", "1-4-5-2-AD")
    assert cuadra("jab-recto y paso lateral", "1-2-EI-5-2-LI")      # puede saltarse golpes
    assert not cuadra("recto-jab", "1-2")                           # pero no cambiar el orden
    assert not cuadra("jab-recto", "1-EI-2")                        # «X-Y» van seguidos
    assert cuadra("doble jab y recto", "1-1-2")
    assert not cuadra("doble jab y recto", "1-EI-1-2")              # doble = dos iguales seguidos
    assert cuadra("doble crochet", "4-3")
    assert cuadra("crochet abajo y arriba", "3c-3")
    assert not cuadra("crochet abajo y arriba", "3-3c")
    assert not cuadra("crochet y recto", "3c-2")                    # sin «al cuerpo», a la cabeza
    assert cuadra("ballesteo y jab-crochet", "BA-1-4")              # «crochet» vale con las dos manos
    assert cuadra("ballesteo y jab-crochet", "BA-1-3")
    assert cuadra("esquiva derecha, dos ganchos y esquiva izquierda", "ED-6-5c-EI")
    assert not cuadra("esquivas a los dos lados con ganchos", "ED-6-EI-5c")  # las dos esquivas, antes que los ganchos
    assert cuadra("parada, ruedas a los dos lados y crochet", "P-AI-3-AD-4")
    assert not cuadra("jab y esquiva derecha", "1-EI")             # el lado de la defensa, si lo dice, cuenta


def test_reglas_de_los_nombres():
    from herramientas.biblioteca import fallos_del_nombre, ids
    from motor.acciones import acciones_por_ids

    def fallos(nombre, notacion):
        return fallos_del_nombre(nombre, acciones_por_ids(ids(notacion)))

    assert fallos("jab-recto, rueda y crochet", "1-2-AD-4") == []
    assert fallos("rueda y gancho", "1-AD-6") == ["no empieza por la primera acción"]          # R1
    assert fallos("ballesteo, rueda y paso lateral", "BA-1-AD-LD") == ["no nombra ningún golpe"]  # R2
    assert fallos("jab, gancho y esquiva", "1-EI-6") == ["nombra algo que no está o en otro orden"]       # R3
    assert "dice la mano del golpe" in fallos("gancho de derecha y crochet", "6-3")                      # R4
    assert fallos("jab-recto con contra", "1-2") == ["palabras fuera del vocabulario: contra"]           # R5


def test_como_mucho_cinco_con_dos_ganchos_seguidos_por_nivel():
    from herramientas.biblioteca import MAX_DOS_GANCHOS, dos_ganchos_seguidos, ids
    from motor.acciones import acciones_por_ids

    def seguidos(notacion):
        return dos_ganchos_seguidos(acciones_por_ids(ids(notacion)))

    assert seguidos("1-5-6") and seguidos("6-5") and seguidos("6c-5") and seguidos("5-6c")
    assert not seguidos("5c-5")                                     # gancho abajo y arriba: misma mano
    assert not seguidos("5-B-6") and not seguidos("5-3-6")
    combos, _ = preparar()
    for nivel in (1, 2, 3):
        assert sum(c["nivel"] == nivel and seguidos(c["notacion"]) for c in combos) <= MAX_DOS_GANCHOS
