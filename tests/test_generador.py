import random

import pytest

from motor.acciones import espejo_combo
from motor.generador import PERFIL_NEUTRO, GeneradorCombos, cargar_perfil
from motor.reglas import REGLAS, validar

N = 1000


def _generar(nivel, zurdo=False, perfil=None, semilla=None):
    gen = GeneradorCombos(nivel, perfil=perfil, zurdo=zurdo,
                          rng=random.Random(semilla if semilla is not None else nivel))
    return [gen.siguiente() for _ in range(N)]


@pytest.fixture(scope="module")
def generadas():
    """1.000 combinaciones por nivel, con semilla fija para que sea reproducible."""
    return {nivel: _generar(nivel) for nivel in (1, 2, 3)}


@pytest.mark.parametrize("nivel", [1, 2, 3])
@pytest.mark.parametrize("regla", REGLAS, ids=lambda r: r.__name__)
def test_1000_combinaciones_cumplen_cada_regla(generadas, nivel, regla):
    for c in generadas[nivel]:
        error = regla(list(c.acciones), nivel)
        assert error is None, f"nivel {nivel}: '{c.texto}' -> {error}"


@pytest.mark.parametrize("nivel", [1, 2, 3])
def test_el_generador_usa_reglas_y_clasicos(generadas, nivel):
    origenes = {c.origen for c in generadas[nivel]}
    assert origenes == {"reglas", "clasico"}


@pytest.mark.parametrize("nivel", [1, 2, 3])
def test_zurdo_es_exactamente_el_espejo_del_ortodoxo(nivel):
    ortodoxas = _generar(nivel, semilla=7)
    zurdas = _generar(nivel, zurdo=True, semilla=7)
    for o, z in zip(ortodoxas, zurdas):
        assert list(z.acciones) == espejo_combo(list(o.acciones))
        assert validar(list(z.acciones), nivel, zurdo=True) == []


def test_nunca_repite_la_misma_combinacion_seguida(generadas):
    for lista in generadas.values():
        for a, b in zip(lista, lista[1:]):
            assert a.acciones != b.acciones


def _frecuencia(combos, condicion):
    return sum(1 for c in combos if condicion(c)) / len(combos)


def test_el_perfil_aumenta_bloqueo_gancho_y_jab():
    perfil, neutro = cargar_perfil(), PERFIL_NEUTRO
    con_perfil = _generar(1, perfil=perfil, semilla=1)
    sin_perfil = _generar(1, perfil=neutro, semilla=1)

    def bloqueo(c): return any(a.familia == "bloqueo" for a in c.acciones)
    def gancho(c): return [a for a in c.acciones if a.tipo == "golpe"][-1].familia == "gancho"
    def jab(c): return c.acciones[0].id == "jab"

    for condicion in (bloqueo, gancho, jab):
        assert _frecuencia(con_perfil, condicion) > _frecuencia(sin_perfil, condicion), condicion.__name__
    # Es su punto débil: que salga a menudo.
    assert _frecuencia(con_perfil, bloqueo) >= 0.2
