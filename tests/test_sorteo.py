"""Sorteo de la sesión: solo las del nivel y uniforme, sin repetir en 5 y con cobertura del 1 al 6."""
import random
from collections import Counter
from dataclasses import replace

import pytest

from motor.acciones import acciones_por_ids, biblioteca, espejo_combo, numero
from motor.sorteo import NUMEROS, SIN_REPETIR, SorteoBiblioteca, movimiento, movimientos, peso_practicar
from motor.temporizador import ConfigSesion, cargar_presets, construir_guion

N = 3000
NIVELES = [1, 2, 3]


def _sortear(nivel, n=N, zurdo=False, perfil=None, semilla=0):
    s = SorteoBiblioteca(nivel, perfil=perfil, zurdo=zurdo, rng=random.Random(semilla))
    return [s.siguiente() for _ in range(n)]


def _niveles():
    return {tuple(a.id for a in c.acciones): c.nivel for c in biblioteca()}


@pytest.mark.parametrize("nivel", NIVELES)
def test_cada_nivel_sortea_solo_de_las_suyas_y_salen_todas(nivel):
    niveles = _niveles()
    salidas = {tuple(a.id for a in c.acciones) for c in _sortear(nivel)}
    assert salidas == {k for k, n in niveles.items() if n == nivel}


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
    # Garantizado en cuanto se han dicho 6 combinaciones (las que no caben al final de un asalto
    # abren el siguiente: no se pierden). En «Prueba 2×30 s» de avanzado a veces caben menos.
    for semilla in range(20):
        config = _config(preset, nivel=nivel, zurdo=zurdo)
        combos = [e for e in construir_guion(config, random.Random(semilla)) if e.tipo == "combo"]
        dichos = {numero(a, zurdo) for e in combos[:6] for a in acciones_por_ids(e.ids)} - {None}
        if preset == "amateur" or len(combos) >= 6:
            assert dichos == NUMEROS, f"semilla {semilla}: faltan {NUMEROS - dichos}"


# En «Prueba 2×30 s» de medio y avanzado solo caben 3-5 combinaciones (lo que tarda de verdad la
# voz): ahí no siempre salen todos. En básico, sí casi siempre.
def test_en_la_prueba_corta_de_basico_casi_siempre_salen_todos(nivel=1):
    completas = 0
    for semilla in range(100):
        combos = [e for e in construir_guion(_config("prueba", nivel=nivel), random.Random(semilla))
                  if e.tipo == "combo"]
        completas += {a.numero for e in combos for a in acciones_por_ids(e.ids) if a.numero} == NUMEROS
    assert completas >= 90, f"solo {completas} de 100"


@pytest.mark.parametrize("nivel", NIVELES)
def test_sin_preferencias_es_uniforme(nivel):
    # Tras las 6 primeras (cobertura) todas pesan igual: cada una sale ~N/len veces.
    combos = _sortear(nivel, n=20000)[6:]
    veces = Counter(tuple(a.id for a in c.acciones) for c in combos)
    media = len(combos) / len(veces)
    assert max(veces.values()) < 1.25 * media and min(veces.values()) > 0.75 * media, veces.most_common(3)


@pytest.mark.parametrize("nivel", NIVELES)
def test_zurdo_es_el_espejo_del_ortodoxo(nivel):
    for o, z in zip(_sortear(nivel, n=500, semilla=4), _sortear(nivel, n=500, zurdo=True, semilla=4)):
        assert list(z.acciones) == espejo_combo(list(o.acciones))


# ---------- "Practicar más" ----------

def _practicar(**cuanto):
    return {"practicar": [{"movimiento": m, "cuanto": c} for m, c in cuanto.items()]}


def test_los_movimientos_de_practicar_mas():
    assert movimientos() == ["1", "2", "3", "4", "5", "6", "cuerpo", "esquiva", "rodar", "paso_atras",
                             "bloqueo", "parada", "ballesteo", "flexion", "paso_lateral", "pivote", "salir"]


def _peso(ids, **cuanto):
    return peso_practicar(acciones_por_ids(ids), _practicar(**cuanto)["practicar"])


def test_peso_de_practicar_mas():
    assert _peso(["jab", "directo"]) == 1
    assert _peso(["jab", "directo"], **{"2": "poco"}) == 2
    assert _peso(["jab", "directo"], **{"2": "bastante"}) == 4
    assert _peso(["jab", "directo"], **{"1": "poco", "2": "poco"}) == 4  # se multiplican
    assert _peso(["jab", "directo", "bloqueo"], **{"1": "bastante", "2": "poco", "bloqueo": "poco"}) == 8  # tope
    assert _peso(["jab", "bloqueo"], **{"1": "bastante", "bloqueo": "bastante"}) == 8  # 16, con tope
    assert _peso(["esquiva_der", "jab", "esquiva_izq"], esquiva="poco") == 2  # dos veces cuenta una
    assert _peso(["jab", "jab", "directo"], **{"1": "bastante"}) == 4
    assert _peso(["gancho_izq_cuerpo", "gancho_izq"], cuerpo="poco") == 2
    assert _peso(["gancho_izq_cuerpo"], **{"3": "bastante"}) == 1  # el 3 es solo a la cara
    assert _peso(["jab"], salir="poco") == 1  # no lo lleva
    assert peso_practicar(acciones_por_ids(["jab"]), [{"movimiento": "1", "cuanto": "mucho"}]) == 1


def _lleva(combos, mov):
    return sum(any(movimiento(a) == mov for a in c.acciones) for c in combos) / len(combos)


def _menos_frecuente(nivel):
    # El movimiento que llevan menos combinaciones del nivel (donde más se nota el peso).
    del_nivel = [c for c in biblioteca() if c.nivel == nivel]
    cuenta = Counter(m for c in del_nivel for m in {movimiento(a) for a in c.acciones})
    return min(cuenta, key=lambda m: (cuenta[m], m))


@pytest.mark.parametrize("nivel", NIVELES)
def test_practicar_mas_sube_las_que_lo_llevan(nivel):
    mov = _menos_frecuente(nivel)
    uniforme = _lleva(_sortear(nivel, n=6000), mov)
    poco = _lleva(_sortear(nivel, n=6000, perfil=_practicar(**{mov: "poco"})), mov)
    bastante = _lleva(_sortear(nivel, n=6000, perfil=_practicar(**{mov: "bastante"})), mov)
    assert uniforme * 1.4 < poco and poco * 1.25 < bastante, f"{mov}: {uniforme:.1%} {poco:.1%} {bastante:.1%}"


@pytest.mark.parametrize("nivel", NIVELES)
def test_practicar_mas_nunca_excluye_ninguna(nivel):
    # Con los tres a "Bastante más", también salen las que no llevan ninguno.
    perfil = _practicar(**{"6": "bastante", "cuerpo": "bastante", "bloqueo": "bastante"})
    salidas = {tuple(a.id for a in c.acciones) for c in _sortear(nivel, n=20000, perfil=perfil)}
    assert salidas == {k for k, n in _niveles().items() if n == nivel}


def test_practicar_mas_tambien_pesa_en_las_coletillas():
    def primeras(perfil):
        sorteos = (SorteoBiblioteca(1, perfil=perfil, rng=random.Random(s)) for s in range(3000))
        return [s.coletillas()[0] for s in sorteos]
    assert _lleva(primeras(_practicar(**{"6": "bastante"})), "6") > _lleva(primeras(None), "6") + 0.1


# ---------- Ventana de no repetir por identidad ----------

def _duplicada(combos, desplazamiento=1000):
    """La biblioteca con cada combinación dos veces: la copia, con otro número."""
    return combos + [replace(c, n=c.n + desplazamiento) for c in combos]


def test_la_ventana_distingue_dos_combinaciones_iguales_por_su_numero():
    jab_recto = next(c for c in biblioteca() if c.nivel == 1)
    s = SorteoBiblioteca(1, rng=random.Random(0))
    s.combos = _duplicada([jab_recto])
    elegida = s.siguiente()
    assert s.recientes == [jab_recto.n] or s.recientes == [jab_recto.n + 1000]
    assert [c.acciones for c in s._candidatas()] == [elegida.acciones]  # la otra, aunque sea igual


@pytest.mark.parametrize("nivel", NIVELES)
def test_con_la_biblioteca_duplicada_salen_las_dos_copias_sin_repetir_numero(nivel):
    s = SorteoBiblioteca(nivel, rng=random.Random(nivel))
    s.combos = _duplicada(s.combos)
    sacadas = []
    for _ in range(3000):
        s.siguiente()
        sacadas.append(s.recientes[-1])
    for i, n in enumerate(sacadas):
        assert n not in sacadas[max(0, i - SIN_REPETIR):i]
    assert set(sacadas) == {c.n for c in s.combos}
