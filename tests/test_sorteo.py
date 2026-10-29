"""Sorteo de la sesión: biblioteca por nivel, sin repetir en 5, cobertura del 1 al 6 y % de defensa."""
import random

import pytest

from motor.acciones import acciones_por_ids, biblioteca, defensa_por_nivel, espejo_combo, numero
from motor.generador import PERFIL_NEUTRO, cargar_perfil
from motor.sorteo import NUMEROS, SIN_REPETIR, SorteoBiblioteca
from motor.temporizador import ConfigSesion, cargar_presets, construir_guion

N = 3000
NIVELES = [1, 2, 3]


def _sortear(nivel, n=N, zurdo=False, perfil=None, semilla=0):
    s = SorteoBiblioteca(nivel, perfil=perfil, zurdo=zurdo, rng=random.Random(semilla))
    return [s.siguiente() for _ in range(n)]


def _niveles():
    return {tuple(a.id for a in c.acciones): c.nivel for c in biblioteca()}


@pytest.mark.parametrize("nivel", NIVELES)
def test_filtra_por_nivel_incluyendo_los_inferiores(nivel):
    niveles = _niveles()
    salidas = {niveles[tuple(a.id for a in c.acciones)] for c in _sortear(nivel)}
    assert salidas == set(range(1, nivel + 1))


@pytest.mark.parametrize("nivel", NIVELES)
def test_no_repite_ninguna_de_las_ultimas_5(nivel):
    combos = [c.acciones for c in _sortear(nivel)]
    for i, c in enumerate(combos):
        assert c not in combos[max(0, i - SIN_REPETIR):i], f"repetida en la posición {i}"


@pytest.mark.parametrize("nivel", NIVELES)
@pytest.mark.parametrize("semilla", range(30))
def test_los_golpes_del_1_al_6_salen_enseguida(nivel, semilla):
    # Cada sorteo que falta cobertura añade al menos un número: 6 bastan siempre.
    combos = _sortear(nivel, n=6, semilla=semilla)
    assert {a.numero for c in combos for a in c.acciones if a.numero} == NUMEROS


def _config(preset, **extra):
    p = next(p for p in cargar_presets()["presets"] if p["id"] == preset)
    return ConfigSesion(asaltos=p["asaltos"], duracion_asalto=p["duracion_asalto"], descanso=p["descanso"], **extra)


@pytest.mark.parametrize("preset", ["amateur", "prueba"])
@pytest.mark.parametrize("nivel", NIVELES)
@pytest.mark.parametrize("zurdo", [False, True])
def test_en_cada_sesion_salen_todos_los_golpes_del_1_al_6(preset, nivel, zurdo):
    for semilla in range(20):
        config = _config(preset, nivel=nivel, zurdo=zurdo)
        combos = [e for e in construir_guion(config, random.Random(semilla)) if e.tipo == "combo"]
        dichos = {numero(a, zurdo) for e in combos for a in acciones_por_ids(e.ids)} - {None}
        assert dichos == NUMEROS, f"semilla {semilla}: faltan {NUMEROS - dichos}"


@pytest.mark.parametrize("nivel", NIVELES)
def test_proporcion_de_defensa_del_nivel(nivel):
    combos = _sortear(nivel, n=5000, perfil=PERFIL_NEUTRO)
    con_defensa = sum(any(a.tipo == "defensa" for a in c.acciones) for c in combos) / len(combos)
    assert abs(con_defensa - defensa_por_nivel()[nivel]) <= 0.04, f"{con_defensa:.1%}"


@pytest.mark.parametrize("nivel", NIVELES)
def test_zurdo_es_el_espejo_del_ortodoxo(nivel):
    for o, z in zip(_sortear(nivel, n=500, semilla=4), _sortear(nivel, n=500, zurdo=True, semilla=4)):
        assert list(z.acciones) == espejo_combo(list(o.acciones))


def test_el_refuerzo_de_practicar_sube_esas_combinaciones():
    def lleva(combos): return sum(any(a.id == "uppercut_der" for a in c.acciones) for c in combos) / len(combos)
    reforzado = {**cargar_perfil(), "refuerzo": {"acciones": ["uppercut_der"], "factor": 3.0}}
    assert lleva(_sortear(2, perfil=reforzado)) > lleva(_sortear(2)) + 0.05
