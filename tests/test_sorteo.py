"""Sorteo de la sesión: solo las del nivel y uniforme, sin repetir en 5 y con cobertura del 1 al 6."""
import random
from collections import Counter
from dataclasses import replace

import pytest

from motor.acciones import acciones_por_ids, biblioteca, espejo_combo, numero
from motor.sorteo import (FACTOR_PRACTICAR, NUMEROS, NUMEROS_CUERPO, PESO_CUERPO, SIN_REPETIR, TOPE_PRACTICAR,
                          SorteoBiblioteca, movimiento, movimientos, peso_practicar)
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
    assert {a.numero for c in combos for a in c.acciones if a.numero} & NUMEROS == NUMEROS


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
        dichos = {numero(a, zurdo) for e in combos[:6] for a in acciones_por_ids(e.ids)} & NUMEROS
        if preset == "amateur" or len(combos) >= 6:
            assert dichos == NUMEROS, f"semilla {semilla}: faltan {NUMEROS - dichos}"


# En «Prueba 2×30 s» de medio y avanzado solo caben 3-5 combinaciones (lo que tarda de verdad la
# voz): ahí no siempre salen todos. En básico, sí casi siempre.
def test_en_la_prueba_corta_de_basico_casi_siempre_salen_todos(nivel=1):
    completas = 0
    for semilla in range(100):
        combos = [e for e in construir_guion(_config("prueba", nivel=nivel), random.Random(semilla))
                  if e.tipo == "combo"]
        completas += {a.numero for e in combos for a in acciones_por_ids(e.ids) if a.numero} & NUMEROS == NUMEROS
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

def _practicar(*elegidos):
    return {"practicar": [{"movimiento": m} for m in elegidos]}


def test_los_movimientos_de_practicar_mas():
    assert movimientos() == ["1", "2", "3", "4", "5", "6", "cuerpo", "esquiva", "rodar", "paso_atras",
                             "bloqueo", "parada", "ballesteo", "flexion", "paso_lateral", "pivote", "salir"]


def test_los_golpes_al_cuerpo_son_cuerpo_en_practicar_mas_aunque_lleven_numero():
    # Del 7 al 12 llevan número, pero «Practicar más» los sigue juntando en «cuerpo» (lo que guarda el almacén).
    for id_ in ("jab_cuerpo", "directo_cuerpo", "gancho_izq_cuerpo", "gancho_der_cuerpo", "uppercut_izq_cuerpo",
                "uppercut_der_cuerpo"):
        a = acciones_por_ids([id_])[0]
        assert a.numero in range(7, 13) and movimiento(a) == "cuerpo", id_
    assert _peso(["directo_cuerpo"], "cuerpo") == 3
    assert _peso(["directo_cuerpo"], "8") == 1  # «8» no es un movimiento


def _peso(ids, *elegidos):
    return peso_practicar(acciones_por_ids(ids), _practicar(*elegidos)["practicar"])


def test_practicar_mas_tiene_un_solo_factor_y_el_tope_de_siempre():
    assert FACTOR_PRACTICAR == 3.0 and TOPE_PRACTICAR == 8.0


def test_peso_de_practicar_mas():
    assert _peso(["jab", "directo"]) == 1
    assert _peso(["jab", "directo"], "2") == 3
    assert _peso(["jab", "directo"], "1", "2") == 8  # se multiplican: 9, con tope
    assert _peso(["jab", "directo", "bloqueo"], "1", "2", "bloqueo") == 8  # los 3 elegidos: 27, con tope
    assert _peso(["jab", "directo", "bloqueo"], "2", "esquiva", "salir") == 3  # de los 3, solo lleva uno
    assert _peso(["esquiva_der", "jab", "esquiva_izq"], "esquiva") == 3  # dos veces cuenta una
    assert _peso(["jab", "jab", "directo"], "1") == 3
    assert _peso(["jab", "jab", "directo"], "1", "1") == 3  # elegido dos veces, también cuenta una
    assert _peso(["gancho_izq_cuerpo", "gancho_izq"], "cuerpo") == 3  # el crochet a la cara no es «cuerpo»
    assert _peso(["gancho_izq_cuerpo", "gancho_izq"], "cuerpo", "3") == 8  # los dos: 9, con tope
    assert _peso(["gancho_izq_cuerpo"], "3") == 1  # el 3 es solo a la cara
    assert _peso(["jab"], "salir") == 1  # no lo lleva


def test_practicar_mas_ignora_el_cuanto_de_los_datos_viejos():
    # Antes «Un poco más» era ×2 y «Bastante más» ×4; ahora todos ×3, con «cuanto» o sin él.
    acciones = acciones_por_ids(["jab", "directo", "bloqueo"])
    for cuanto in ("poco", "bastante", "mucho", None):
        elegido = {"movimiento": "2"} if cuanto is None else {"movimiento": "2", "cuanto": cuanto}
        assert peso_practicar(acciones, [elegido]) == 3, cuanto
    assert peso_practicar(acciones, [{"movimiento": "1", "cuanto": "poco"}, {"movimiento": "bloqueo", "cuanto": "bastante"}]) == 8
    assert peso_practicar(acciones, [{"cuanto": "bastante"}]) == 1  # sin movimiento no cuenta


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
    elegido = _lleva(_sortear(nivel, n=6000, perfil=_practicar(mov)), mov)
    assert uniforme * 1.75 < elegido, f"{mov}: {uniforme:.1%} → {elegido:.1%}"


@pytest.mark.parametrize("nivel", NIVELES)
def test_practicar_mas_nunca_excluye_ninguna(nivel):
    # Con los tres elegidos (el máximo), también salen las que no llevan ninguno.
    perfil = _practicar("6", "cuerpo", "bloqueo")
    salidas = {tuple(a.id for a in c.acciones) for c in _sortear(nivel, n=20000, perfil=perfil)}
    assert salidas == {k for k, n in _niveles().items() if n == nivel}


def test_practicar_mas_tambien_pesa_en_las_coletillas():
    def primeras(perfil):
        sorteos = (SorteoBiblioteca(1, perfil=perfil, rng=random.Random(s)) for s in range(3000))
        return [s.coletillas()[0] for s in sorteos]
    assert _lleva(primeras(_practicar("6")), "6") > _lleva(primeras(None), "6") + 0.1


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


# ---------- Cobertura en dos pasos: 1-6 y luego 7-12 ----------

def test_paso_2_las_que_anaden_un_golpe_al_cuerpo_que_falte_pesan_el_doble_sin_filtrar():
    s = SorteoBiblioteca(1, rng=random.Random(3))
    assert all(numeros_de(c) & NUMEROS for c in s._candidatas())  # paso 1: filtra por el 1-6
    s.faltan -= NUMEROS
    assert len(s._candidatas()) == len(s.combos)  # paso 2: no filtra
    con = next(c for c in s.combos if numeros_de(c) & NUMEROS_CUERPO)
    sin = next(c for c in s.combos if not numeros_de(c) & NUMEROS_CUERPO)
    assert (s._peso_cobertura(con), s._peso_cobertura(sin)) == (PESO_CUERPO, 1) == (2.0, 1)
    s.faltan -= numeros_de(con)
    assert s._peso_cobertura(con) == 1  # lo que ya ha salido no pesa


@pytest.mark.parametrize("nivel", NIVELES)
def test_en_casi_todas_las_sesiones_amateur_salen_los_seis_golpes_al_cuerpo(nivel):
    con_todos = 0
    for semilla in range(100):
        combos = [e for e in construir_guion(_config("amateur", nivel=nivel), random.Random(semilla))
                  if e.tipo == "combo"]
        dichos = {a.numero for e in combos for a in acciones_por_ids(e.ids) if a.numero}
        con_todos += NUMEROS_CUERPO <= dichos
    assert con_todos >= 95, f"nivel {nivel}: solo {con_todos} de 100"


def numeros_de(combo):
    return {a.numero for a in combo.acciones if a.numero}
