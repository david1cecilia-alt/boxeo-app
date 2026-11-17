"""«Golpes al cuerpo» apagado (perfil "golpes_cuerpo" False): el sorteo se salta las combinaciones con algún
golpe al cuerpo, de la biblioteca, de las coletillas y de las propias, salvo que se pida practicarlos."""
import random

import pytest

from motor.acciones import biblioteca
from motor.sorteo import (SIN_REPETIR, SorteoBiblioteca, SorteoMezcla, cargar_perfil, lleva_cuerpo, sin_cuerpo,
                          ventana)

APAGADO = {**cargar_perfil(), "golpes_cuerpo": False}
AL_CUERPO = [{"id": f"p-{i}", "ids": ids} for i, ids in enumerate(
    [["jab", "jab_cuerpo"], ["directo_cuerpo", "gancho_izq"], ["jab", "uppercut_der_cuerpo", "directo"]])]


def test_sin_la_clave_o_encendido_no_quita_nada():
    assert not sin_cuerpo(cargar_perfil()) and not sin_cuerpo({**cargar_perfil(), "golpes_cuerpo": True})
    assert sin_cuerpo(APAGADO)


@pytest.mark.parametrize("nivel, quedan", [(1, 38), (2, 35), (3, 23)])
def test_quedan_las_que_no_llevan_golpes_al_cuerpo(nivel, quedan):
    s = SorteoBiblioteca(nivel, perfil=APAGADO, rng=random.Random(0))
    assert len(s.combos) == quedan == sum(c.nivel == nivel and not lleva_cuerpo(c) for c in biblioteca())


def test_practicar_golpes_al_cuerpo_manda_sobre_el_interruptor():
    perfil = {**APAGADO, "practicar": [{"movimiento": "cuerpo"}]}
    assert not sin_cuerpo(perfil)
    s = SorteoBiblioteca(2, perfil=perfil, rng=random.Random(0))
    assert len(s.combos) == 56 and any(lleva_cuerpo(c) for c in s.combos)


@pytest.mark.parametrize("semilla", range(20))
def test_avanzado_sin_cuerpo_no_repite_antes_de_tiempo(semilla):
    # Con 23 la ventana sigue siendo la de siempre (5): ninguna se repite antes de 5 sacadas y salen todas.
    s = SorteoBiblioteca(3, perfil=APAGADO, rng=random.Random(semilla))
    assert ventana(len(s.combos)) == SIN_REPETIR
    sacadas = [s.recientes[-1] for _ in range(300) if s.siguiente()]
    for i, n in enumerate(sacadas):
        assert n not in sacadas[max(0, i - SIN_REPETIR):i], f"repetida en {i}"
    assert set(sacadas) == {c.n for c in s.combos}


def test_solo_las_mias_si_todas_llevan_golpes_al_cuerpo_sale_la_biblioteca():
    s = SorteoMezcla(1, APAGADO, rng=random.Random(0), propias=AL_CUERPO, mezcla="solo")
    assert s.mezcla == "ninguna"
    sacadas = [s.siguiente() for _ in range(30)]
    assert all(c.origen == "biblioteca" and not lleva_cuerpo(c) for c in sacadas)
    # Encendido, las mismas propias sí valen.
    assert SorteoMezcla(1, cargar_perfil(), rng=random.Random(0), propias=AL_CUERPO, mezcla="solo").mezcla == "solo"
