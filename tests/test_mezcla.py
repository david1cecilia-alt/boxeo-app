"""Sorteo mezclado con las combinaciones propias (SorteoMezcla): moneda, grupos, ventana por grupo,
pesos de «Practicar más», cobertura del 1 al 6 y «Solo las mías»."""
import random
from collections import Counter

import pytest

from motor.acciones import acciones_por_ids, espejo_combo, numero, texto_hablado
from motor.temporizador import ConfigSesion, construir_guion
from motor.sorteo import (MEZCLAS, MIN_SOLO_PROPIAS, NUMEROS, NUMEROS_CUERPO, PROBABILIDAD_PROPIAS, SIN_REPETIR, SorteoBiblioteca,
                          SorteoMezcla, mezcla_efectiva, numeros, propias_validas)

N = 5000
TOLERANCIA = 0.03  # con 5.000 sorteos el ruido de una proporción es de ~0,7 puntos (σ)


def propia(i, ids):
    return {"id": f"p-{i}", "ids": list(ids), "creada": "2026-11-04T10:00:00Z"}


# De cada nivel por su número de acciones (2-4 básico, 5-6 medio, 7-10 avanzado).
BASICAS = [propia(1, ["jab", "jab", "directo"]), propia(2, ["esquiva_der", "gancho_izq"]),
           propia(3, ["directo_cuerpo", "gancho_izq", "salir", "bloqueo"])]
MEDIAS = [propia(4, ["jab", "directo", "gancho_izq", "gancho_der", "uppercut_izq", "uppercut_der"]),
          propia(5, ["jab", "rodar_izq", "directo", "pivote", "jab"])]
AVANZADAS = [propia(6, ["jab", "directo", "esquiva_izq", "gancho_izq", "directo", "rodar_der", "gancho_der",
                        "paso_atras"])]
TODAS = BASICAS + MEDIAS + AVANZADAS


def sortear(nivel=1, propias=TODAS, mezcla="mucho", n=N, semilla=0, perfil=None, zurdo=False):
    s = SorteoMezcla(nivel, perfil=perfil, zurdo=zurdo, rng=random.Random(semilla), propias=propias, mezcla=mezcla)
    return [s.siguiente() for _ in range(n)]


def ids(combo):
    return tuple(a.id for a in combo.acciones)


def de_propias(propias):
    return {tuple(p["ids"]) for p in propias}


# ---------- Propias válidas y mezcla efectiva ----------

def test_las_mezclas():
    assert MEZCLAS == ("ninguna", "poco", "bastante", "mucho", "solo")
    assert PROBABILIDAD_PROPIAS == {"poco": 0.20, "bastante": 0.35, "mucho": 0.50}
    assert MIN_SOLO_PROPIAS == 3


def test_propias_validas_ignora_las_que_no_se_pueden_sortear():
    malas = [propia(10, ["jab"]), propia(11, ["jab"] * 11), propia(12, ["jab", "patada"]),
             {"ids": ["jab", "directo"]}, {"id": "p-13"}, {"id": 14, "ids": ["jab", "directo"]}]
    validas = propias_validas(malas + BASICAS + [propia(15, ["jab"] * 10)])
    assert [p.id for p in validas] == ["p-1", "p-2", "p-3", "p-15"]
    assert [p.nivel for p in validas] == [1, 1, 1, 3]
    assert propias_validas(None) == []


@pytest.mark.parametrize("mezcla, propias, nivel, efectiva", [
    ("ninguna", TODAS, 1, "ninguna"),
    ("poco", TODAS, 2, "poco"),
    ("mucho", BASICAS, 2, "ninguna"),   # sin propias del nivel: solo biblioteca
    ("bastante", [], 1, "ninguna"),
    ("solo", BASICAS, 3, "solo"),       # ignora el nivel
    ("solo", MEDIAS, 2, "ninguna"),     # menos de 3
    ("otra", TODAS, 1, "ninguna"),
])
def test_mezcla_efectiva(mezcla, propias, nivel, efectiva):
    assert mezcla_efectiva(mezcla, propias_validas(propias), nivel) == efectiva


# ---------- Moneda ----------

@pytest.mark.parametrize("mezcla", list(PROBABILIDAD_PROPIAS))
@pytest.mark.parametrize("nivel", [1, 2, 3])
def test_proporcion_de_propias_es_la_de_la_mezcla(mezcla, nivel):
    sacadas = sortear(nivel, mezcla=mezcla, semilla=nivel)
    propias = [c for c in sacadas if c.origen == "propia"]
    assert abs(len(propias) / N - PROBABILIDAD_PROPIAS[mezcla]) <= TOLERANCIA
    del_nivel = [p for p in TODAS if propias_validas([p])[0].nivel == nivel]
    assert {ids(c) for c in propias} == de_propias(del_nivel)  # solo las de su nivel, y todas


def test_sin_propias_del_nivel_solo_salen_de_la_biblioteca():
    assert {c.origen for c in sortear(3, propias=BASICAS + MEDIAS, n=500)} == {"biblioteca"}


def test_solo_las_mias_saca_todas_las_propias_de_cualquier_nivel():
    for nivel in (1, 2, 3):
        sacadas = sortear(nivel, mezcla="solo", n=2000, semilla=nivel)
        assert {c.origen for c in sacadas} == {"propia"}
        assert {ids(c) for c in sacadas} == de_propias(TODAS)


def test_solo_las_mias_con_menos_de_3_es_como_ninguna():
    assert [ids(c) for c in sortear(2, propias=MEDIAS, mezcla="solo", n=200)] == \
        [ids(c) for c in sortear(2, propias=[], mezcla="ninguna", n=200)]


# ---------- Ventana por grupo ----------

@pytest.mark.parametrize("cuantas", [1, 2, 3, 6])
def test_ventana_por_grupo_es_min_5_n_menos_1(cuantas):
    propias = [propia(i, ["jab"] * (2 + i % 3)) for i in range(cuantas)]  # todas básicas, algunas iguales
    s = SorteoMezcla(1, rng=random.Random(cuantas), propias=propias, mezcla="mucho")
    de_grupo = []
    for _ in range(3000):
        if s.siguiente().origen == "propia":
            de_grupo.append(s.propias.recientes[-1] if s.propias.recientes else "p-0")
    k = min(SIN_REPETIR, cuantas - 1)
    for i, identidad in enumerate(de_grupo):
        assert identidad not in de_grupo[max(0, i - k):i], f"repetida en {i}"
    assert set(de_grupo) == {p["id"] for p in propias}


def test_la_ventana_de_la_biblioteca_no_cuenta_las_propias():
    # Entre dos de la biblioteca puede haber propias: la ventana de la biblioteca sigue siendo de 5
    # de la biblioteca.
    s = SorteoMezcla(2, rng=random.Random(5), propias=TODAS, mezcla="mucho")
    de_biblioteca = []
    for _ in range(3000):
        if s.siguiente().origen == "biblioteca":
            de_biblioteca.append(s.biblioteca.recientes[-1])
    for i, n in enumerate(de_biblioteca):
        assert n not in de_biblioteca[max(0, i - SIN_REPETIR):i]


# ---------- Pesos de «Practicar más» ----------

def test_practicar_mas_pesa_dentro_de_las_propias_sin_excluir():
    # Con 6 propias y ventana de 5 salen en rueda: hacen falta más para que el peso se note.
    perfil = {"practicar": [{"movimiento": "salir", "cuanto": "bastante"}]}
    otras = [propia(30 + i, ["directo", segunda]) for i, segunda in enumerate(
        ["jab", "directo", "gancho_der", "uppercut_izq", "uppercut_der", "jab_cuerpo", "bloqueo", "parada",
         "flexion", "ballesteo", "pivote", "paso_atras", "rodar_der", "esquiva_izq"])]
    sacadas = sortear(1, propias=TODAS + otras, mezcla="solo", n=20000, perfil=perfil)
    veces = Counter(ids(c) for c in sacadas)
    con_salir = veces[tuple(BASICAS[2]["ids"])]
    sin_salir = [veces[k] for k in de_propias(TODAS + otras) if "salir" not in k]
    # Pesa ×4, pero tras salir la ventana la aparta 5 sorteos: sale ~2 veces más que cada otra.
    assert con_salir > 1.8 * max(sin_salir) and min(sin_salir) > 0, veces


# ---------- Cobertura del 1 al 6 ----------

@pytest.mark.parametrize("semilla", range(30))
@pytest.mark.parametrize("nivel", [1, 2, 3])
def test_la_biblioteca_sigue_cubriendo_los_golpes_que_faltan(semilla, nivel):
    s = SorteoMezcla(nivel, rng=random.Random(semilla), propias=TODAS, mezcla="mucho")
    for _ in range(12):
        faltaban = set(s.biblioteca.faltan)
        combo = s.siguiente()
        dichos = {numero(a, False) for a in combo.acciones} - {None}
        if combo.origen == "biblioteca" and faltaban & NUMEROS:  # paso 1: filtra; paso 2 (7-12) solo pesa
            assert dichos & faltaban & NUMEROS, "una de la biblioteca no añadió ningún golpe que faltara"
        assert s.biblioteca.faltan == faltaban - dichos  # los de las propias también cuentan


def test_una_propia_con_los_seis_golpes_los_cubre_todos():
    s = SorteoMezcla(2, rng=random.Random(1), propias=[MEDIAS[0]], mezcla="mucho")
    while s.siguiente().origen != "propia":
        pass
    assert s.biblioteca.faltan & NUMEROS == set()


def test_los_golpes_al_cuerpo_de_las_propias_cuentan_como_salidos():
    cuerpo = propia(30, ["jab_cuerpo", "directo_cuerpo", "gancho_izq_cuerpo", "gancho_der_cuerpo",
                         "uppercut_izq_cuerpo", "uppercut_der_cuerpo"])
    for zurdo in (False, True):
        s = SorteoMezcla(2, rng=random.Random(1), propias=[cuerpo], mezcla="mucho", zurdo=zurdo)
        while s.siguiente().origen != "propia":
            pass
        assert not s.biblioteca.faltan & NUMEROS_CUERPO, zurdo


def test_solo_las_mias_no_filtra_por_cobertura():
    # Sin cobertura, una propia sin golpes sale como las demás.
    sin_golpes = propia(20, ["esquiva_der", "rodar_izq", "bloqueo"])
    veces = Counter(ids(c) for c in sortear(1, propias=BASICAS + [sin_golpes], mezcla="solo", n=4000))
    assert min(veces.values()) > 0.8 * max(veces.values()), veces


# ---------- Zurdo, nombre y texto ----------

def test_zurdo_saca_la_propia_en_espejo_con_los_mismos_numeros():
    orto = sortear(2, mezcla="solo", n=300, semilla=8)
    zurdo = sortear(2, mezcla="solo", n=300, semilla=8, zurdo=True)
    for o, z in zip(orto, zurdo):
        assert list(z.acciones) == espejo_combo(list(o.acciones))
        assert [numero(a, True) for a in z.acciones] == [numero(a) for a in o.acciones]


def test_las_propias_nunca_se_nombran():
    for c in sortear(1, mezcla="solo", n=200):
        assert c.origen == "propia" and c.nombre is None
        assert c.texto == texto_hablado(c.acciones)


def test_una_propia_sin_golpes_se_dice_igual_en_los_tres_modos():
    acciones = acciones_por_ids(["esquiva_der", "rodar_izq", "bloqueo", "paso_atras"])
    textos = {texto_hablado(acciones, modo, zurdo) for modo in ("numeros", "nombres", "ambos")
              for zurdo in (False, True)}
    assert textos == {"esquiva derecha, rueda izquierda, bloqueo, paso atrás"}


# ---------- Reproducible y sin rastro ----------

def test_reproducible_con_la_misma_semilla():
    assert [ids(c) for c in sortear(2, semilla=3, n=500)] == [ids(c) for c in sortear(2, semilla=3, n=500)]


def test_guardar_y_restaurar_vuelven_al_mismo_punto():
    s = SorteoMezcla(1, rng=random.Random(2), propias=TODAS, mezcla="mucho")
    for _ in range(4):
        s.siguiente()
    estado = s.guardar()
    for _ in range(10):
        s.siguiente()
    s.restaurar(estado)
    assert s.guardar() == estado


def test_ninguna_con_propias_saca_lo_mismo_que_la_biblioteca():
    for nivel in (1, 2, 3):
        biblioteca = SorteoBiblioteca(nivel, rng=random.Random(nivel))
        mezcla = SorteoMezcla(nivel, rng=random.Random(nivel), propias=TODAS, mezcla="ninguna")
        for _ in range(300):
            assert mezcla.siguiente() == biblioteca.siguiente()
        assert numeros(mezcla.coletillas()[0]) == numeros(biblioteca.coletillas()[0])


# ---------- Coletillas ----------

def _coletillas(propias, mezcla, semilla=0, nivel=2):
    s = SorteoMezcla(nivel, rng=random.Random(semilla), propias=propias, mezcla=mezcla)
    return s.coletillas()


def _cortas_biblioteca():
    return {ids(c) for c in SorteoBiblioteca(1, rng=random.Random(0)).coletillas()}


def test_coletillas_con_la_mezcla_llevan_las_propias_cortas_y_todas_las_de_la_biblioteca():
    cortas = de_propias(BASICAS[:2])  # la tercera tiene 4 acciones
    lista = [ids(c) for c in _coletillas(TODAS, "mucho")]
    # Alguna propia puede ser igual que una de la biblioteca: están las dos.
    assert set(lista) == _cortas_biblioteca() | cortas and len(lista) == len(_cortas_biblioteca()) + len(cortas)
    # La moneda en cada puesto: en la primera, una propia con probabilidad ~p.
    primeras = [_coletillas(TODAS, "poco", semilla)[0].origen for semilla in range(3000)]
    assert abs(primeras.count("propia") / 3000 - PROBABILIDAD_PROPIAS["poco"]) <= TOLERANCIA


def test_coletillas_con_solo_las_mias_son_solo_las_propias_cortas_y_repetibles():
    lista = _coletillas(TODAS, "solo")
    assert [c.origen for c in lista] == ["propia", "propia"]  # las dos básicas de 2-3 acciones
    assert {ids(c) for c in lista} == de_propias(BASICAS[:2])
    assert SorteoMezcla(2, rng=random.Random(0), propias=TODAS, mezcla="solo").coletillas_repetibles


@pytest.mark.parametrize("mezcla", ["ninguna", "poco", "bastante", "mucho"])
def test_con_las_otras_mezclas_las_coletillas_no_se_repiten(mezcla):
    assert not SorteoMezcla(1, rng=random.Random(0), propias=TODAS, mezcla=mezcla).coletillas_repetibles
    # «Solo las mías» con menos de 3 (sortea como «Ninguna») o sin cortas, tampoco.
    assert not SorteoMezcla(1, rng=random.Random(0), propias=BASICAS[:2], mezcla="solo").coletillas_repetibles
    assert not SorteoMezcla(1, rng=random.Random(0), propias=MEDIAS + AVANZADAS, mezcla="solo").coletillas_repetibles


def test_coletillas_con_solo_las_mias_sin_propias_cortas_son_las_de_la_biblioteca():
    s = SorteoMezcla(2, rng=random.Random(0), propias=MEDIAS + AVANZADAS + [propia(9, ["jab"] * 7)], mezcla="solo")
    lista = s.coletillas()
    assert {c.origen for c in lista} == {"biblioteca"} and {ids(c) for c in lista} == _cortas_biblioteca()
    assert not s.coletillas_repetibles


# Lo del caso de C3: «Prueba 2×30 s» con «Solo las mías» y solo 2 propias de 2-3 acciones. Antes,
# el relleno (antes del aviso de los 10 s y al final) tiraba de la biblioteca un 15-21 % de las veces.
DOS_CORTAS = [propia(1, ["jab", "directo"]), propia(2, ["jab", "rodar_der", "directo", "gancho_izq"]),
              propia(3, ["bloqueo", "directo", "gancho_izq"]), propia(4, ["jab", "jab", "directo", "esquiva_izq"]),
              propia(5, ["jab", "directo", "esquiva_izq", "gancho_izq", "directo", "rodar_der", "gancho_der", "paso_atras"])]


@pytest.mark.parametrize("propias", [DOS_CORTAS[:3], DOS_CORTAS], ids=["3_propias", "5_propias"])
@pytest.mark.parametrize("modo_reaccion", [False, True])
def test_solo_las_mias_con_dos_cortas_en_prueba_no_dice_nada_de_la_biblioteca(propias, modo_reaccion):
    config = ConfigSesion(asaltos=2, duracion_asalto=30, descanso=30, nivel=2, modo_reaccion=modo_reaccion)
    suyas = de_propias(propias)
    for semilla in range(300):
        rng = random.Random(semilla)
        guion = construir_guion(config, rng, SorteoMezcla(2, rng=rng, propias=propias, mezcla="solo"))
        fines = {e.asalto: e.t for e in guion if e.tipo == "fin_asalto"}
        dichas = [e for e in guion if e.tipo == "combo" or (e.tipo == "coletilla" and e.t < fines[e.asalto])]
        assert dichas
        assert all(tuple(e.ids) in suyas for e in dichas), (semilla, [e.ids for e in dichas])


# ---------- Guion con propias (Reacción incluida) ----------

@pytest.mark.parametrize("mezcla", ["poco", "mucho", "solo"])
@pytest.mark.parametrize("modo_reaccion", [False, True])
@pytest.mark.parametrize("zurdo", [False, True])
def test_guion_con_propias_dice_las_propias_por_sus_acciones(mezcla, modo_reaccion, zurdo):
    config = ConfigSesion(nivel=2, modo_reaccion=modo_reaccion, zurdo=zurdo, voz="ambos")
    vistas = set()
    for semilla in range(5):
        rng = random.Random(semilla)
        s = SorteoMezcla(2, zurdo=zurdo, rng=rng, propias=TODAS, mezcla=mezcla)
        for e in construir_guion(config, rng, s):
            if e.tipo not in ("combo", "reserva", "coletilla"):
                continue
            acciones = acciones_por_ids(e.ids)
            orto = tuple(a.id for a in (espejo_combo(acciones) if zurdo else acciones))
            assert e.texto == texto_hablado(acciones, "ambos", zurdo)  # nunca un nombre
            vistas.add(orto)
            if e.tipo != "coletilla" and mezcla == "solo":
                assert orto in de_propias(TODAS)
    assert de_propias(MEDIAS) <= vistas


def test_las_reservas_con_propias_no_dejan_rastro_en_el_sorteo():
    config = ConfigSesion(nivel=1, modo_reaccion=True)
    rng = random.Random(4)
    s = SorteoMezcla(1, rng=rng, propias=TODAS, mezcla="mucho")
    guion = construir_guion(config, rng, s)
    combos = [e for e in guion if e.tipo == "combo"]
    assert any(e.tipo == "reserva" for e in guion)
    # Lo que recuerda la ventana de propias sale solo de las combinaciones dichas.
    dichas = [tuple(e.ids) for e in combos]
    por_id = {p["id"]: tuple(p["ids"]) for p in TODAS}
    assert all(por_id[i] in dichas for i in s.propias.recientes)
