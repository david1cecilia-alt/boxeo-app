"""Equivalencia entre el motor JS (static/motor/) y el de Python (la referencia).

tests/js/exportar.mjs genera con el motor JS sorteos de la biblioteca, guiones y el espejo
del catálogo, y aquí se validan con motor/. No se exige la misma secuencia aleatoria
(cada motor tiene su PRNG), sino las mismas reglas, invariantes y proporciones.
"""
import json
import os
import random
import shutil
import subprocess
from dataclasses import asdict
from pathlib import Path

import pytest

from motor.acciones import Accion, acciones_por_ids, biblioteca, catalogo, espejo, espejo_combo, texto_hablado
from motor.reglas import nivel_de
from motor.sorteo import (ACCIONES_COLETILLA, NIVEL_COLETILLA, NUMEROS, SIN_REPETIR, SorteoBiblioteca,
                          cargar_perfil, movimiento, movimientos, peso_practicar)
from motor.ritmo import VELOCIDAD_SENAL, VELOCIDADES, duracion_estimada, rango_pausa, segundos_habla
from motor.temporizador import (AVISO_ANTES_FIN, DURACION_AVISO, DURACION_REACCION, FACTOR_VOZ_RAPIDA,
                                MARGEN, PREPARACION, ConfigSesion, cargar_presets, construir_guion,
                                guion_a_dict)

RAIZ = Path(__file__).resolve().parent.parent
SCRIPT = RAIZ / "tests" / "js" / "exportar.mjs"
NIVELES = [1, 2, 3]
MUESTRAS = 5000  # combinaciones por nivel (y por guardia) en cada motor
# Con 5.000 muestras el ruido de la diferencia es de ~1 punto (σ): 5 puntos solo se
# superan si el port genera de verdad otra distribución.
TOLERANCIA_PROPORCION = 0.05
REDONDEO = 0.011  # los tiempos se redondean a centésimas
SILENCIO_FINAL = 3.0  # el silencio final es como mucho el hueco mínimo del ritmo más esto

NODE = shutil.which("node")
# En local sin Node se saltan; en CI (GitHub pone CI=true) tienen que ejecutarse siempre.
pytestmark = pytest.mark.skipif(NODE is None and not os.environ.get("CI"), reason="node no está instalado")


def _exportar(destino: Path) -> Path:
    assert NODE, "Los tests de equivalencia necesitan node en el PATH"
    subprocess.run([NODE, str(SCRIPT), str(destino), str(MUESTRAS)], check=True, cwd=RAIZ)
    return destino


@pytest.fixture(scope="module")
def ruta_js(tmp_path_factory):
    return _exportar(tmp_path_factory.mktemp("js") / "exportado.json")


@pytest.fixture(scope="module")
def js(ruta_js):
    return json.loads(ruta_js.read_text(encoding="utf-8"))


# ---------- Sorteo de la biblioteca ----------

def _del_nivel(nivel):
    return {tuple(a.id for a in c.acciones) for c in biblioteca() if c.nivel == nivel}


@pytest.mark.parametrize("nivel", NIVELES)
def test_sorteo_js_cumple_las_mismas_reglas_que_el_de_python(js, nivel):
    sorteo = js["sorteos"][str(nivel)]
    ortodoxas = [tuple(ids) for ids in sorteo["ortodoxo"]]
    assert len(ortodoxas) == MUESTRAS
    assert set(ortodoxas) == _del_nivel(nivel)
    for i, c in enumerate(ortodoxas):
        assert c not in ortodoxas[max(0, i - SIN_REPETIR):i], f"repetida en {i}"
    primeras = {a.numero for ids in ortodoxas[:6] for a in acciones_por_ids(list(ids)) if a.numero}
    assert primeras == NUMEROS
    for o, z in zip(sorteo["ortodoxo"], sorteo["zurdo"], strict=True):
        assert z == [a.id for a in espejo_combo(acciones_por_ids(o))]


@pytest.mark.parametrize("nivel", NIVELES)
def test_sorteo_js_saca_lo_mismo_que_el_de_python(js, nivel):
    sorteo = SorteoBiblioteca(nivel, rng=random.Random(nivel))
    python = [list(sorteo.siguiente().acciones) for _ in range(MUESTRAS)]
    javascript = [acciones_por_ids(ids) for ids in js["sorteos"][str(nivel)]["ortodoxo"]]
    condiciones = {"defensa": lambda c: any(a.tipo == "defensa" for a in c)}
    for numero_ in sorted(NUMEROS):
        condiciones[f"golpe {numero_}"] = lambda c, n=numero_: any(a.numero == n for a in c)
    for nombre, condicion in condiciones.items():
        p_py, p_js = _proporcion(python, condicion), _proporcion(javascript, condicion)
        assert abs(p_js - p_py) <= TOLERANCIA_PROPORCION, f"nivel {nivel}, {nombre}: JS {p_js:.1%} vs Python {p_py:.1%}"


def _proporcion(muestra: list[list[Accion]], condicion) -> float:
    return sum(1 for acciones in muestra if condicion(acciones)) / len(muestra)


@pytest.mark.parametrize("nivel", NIVELES)
def test_ventana_js_por_identidad_como_la_de_python(js, nivel):
    # Con cada combinación dos veces (la copia con n + 1000), JS no repite número en la ventana y
    # saca las dos copias, como Python (tests/test_sorteo.py).
    sacadas = js["duplicadas"][str(nivel)]
    del_nivel = {c.n for c in biblioteca() if c.nivel == nivel}
    assert set(sacadas) == del_nivel | {n + 1000 for n in del_nivel}
    for i, n in enumerate(sacadas):
        assert n not in sacadas[max(0, i - SIN_REPETIR):i], f"repetida en {i}"


# ---------- "Practicar más" ----------

def test_movimientos_de_practicar_iguales_en_js_y_python(js):
    assert js["movimientos"] == movimientos()


@pytest.mark.parametrize("i", range(4))
def test_peso_de_practicar_identico_en_js_y_python(js, i):
    caso = js["practicar"][i]
    assert caso["pesos"] == [peso_practicar(c.acciones, caso["elegidos"]) for c in biblioteca()]


@pytest.mark.parametrize("i", range(4))
def test_sorteo_con_practicar_igual_en_js_y_python(js, i):
    caso = js["practicar"][i]
    sorteo = SorteoBiblioteca(2, perfil={**cargar_perfil(), "practicar": caso["elegidos"]}, rng=random.Random(200))
    python = [list(sorteo.siguiente().acciones) for _ in range(MUESTRAS)]
    javascript = [acciones_por_ids(ids) for ids in caso["sorteo"]]
    assert {tuple(a.id for a in c) for c in javascript} == _del_nivel(2)  # no excluye ninguna
    for elegido in caso["elegidos"]:
        def lleva(acciones, m=elegido["movimiento"]): return any(movimiento(a) == m for a in acciones)
        p_py, p_js = _proporcion(python, lleva), _proporcion(javascript, lleva)
        assert abs(p_js - p_py) <= TOLERANCIA_PROPORCION, f"{elegido}: JS {p_js:.1%} vs Python {p_py:.1%}"


# ---------- Espejo ----------

def test_espejo_js_identico_al_de_python_en_todo_el_catalogo(js):
    assert set(js["espejos"]) == set(catalogo())
    for id_, accion in catalogo().items():
        assert js["espejos"][id_] == asdict(espejo(accion)), id_


# ---------- Nivel por número de acciones ----------

def test_nivel_js_identico_al_de_python(js):
    assert [len(c["ids"]) for c in js["niveles"]] == list(range(13))
    for caso in js["niveles"]:
        assert caso["nivel"] == nivel_de(acciones_por_ids(caso["ids"])), caso["ids"]


# ---------- Guiones ----------

def comprobar_guion(eventos: list[dict], c: ConfigSesion) -> None:
    """Invariantes que debe cumplir cualquier guion, lo genere Python o JS."""
    assert [e["t"] for e in eventos] == sorted(e["t"] for e in eventos)
    textos_reaccion = {r["texto"] for r in cargar_presets()["reacciones"]}
    final = c.asaltos * c.duracion_asalto + (c.asaltos - 1) * c.descanso
    assert eventos[-1]["tipo"] == "fin_sesion" and eventos[-1]["t"] == final
    assert [e for e in eventos if e["tipo"] == "fin_sesion"] == [eventos[-1]]

    for n in range(1, c.asaltos + 1):
        inicio = (n - 1) * (c.duracion_asalto + c.descanso)
        fin = inicio + c.duracion_asalto
        aviso = fin - AVISO_ANTES_FIN

        def de_tipo(tipo):
            return [e for e in eventos if e["asalto"] == n and e["tipo"] == tipo]

        assert [e["t"] for e in de_tipo("inicio_asalto")] == [inicio]
        assert [e["t"] for e in de_tipo("fin_asalto")] == [fin]
        assert [(e["t"], e["duracion"]) for e in de_tipo("aviso")] == [(aviso, DURACION_AVISO)]
        descansos = [(e["t"], e["duracion"]) for e in de_tipo("descanso")]
        assert descansos == ([(fin, c.descanso)] if n < c.asaltos else [])

        reacciones = de_tipo("reaccion")
        if not c.modo_reaccion:
            assert reacciones == []
        for r in reacciones:
            assert r["duracion"] == DURACION_REACCION and r["texto"] in textos_reaccion
            assert inicio + PREPARACION <= r["t"] and r["t"] + r["duracion"] <= aviso - MARGEN + REDONDEO

        combos = de_tipo("combo")
        reservas, coletillas = de_tipo("reserva"), de_tipo("coletilla")
        # En un asalto muy corto de avanzado (7-10 acciones) puede no caber ninguna: solo coletillas.
        assert combos or [k for k in coletillas if k["t"] < fin], f"asalto {n} sin nada que decir"
        minima, maxima = rango_pausa(c.ritmo, c.pausa)
        for k in combos + reservas + coletillas:
            acciones = acciones_por_ids(k["ids"])
            ortodoxas = espejo_combo(acciones) if c.zurdo else acciones
            if k["tipo"] != "coletilla":
                assert tuple(a.id for a in ortodoxas) in _del_nivel(c.nivel), "no es de su nivel"
            assert k["duracion"] == duracion_estimada(acciones, k["texto"], c.velocidad)
            assert k["texto"] == texto_hablado(acciones, c.voz, c.zurdo)
            assert minima <= k["hueco"] <= maxima
        cortas = {tuple(a.id for a in co.acciones) for co in biblioteca()
                  if co.nivel == NIVEL_COLETILLA and ACCIONES_COLETILLA[0] <= len(co.acciones) <= ACCIONES_COLETILLA[1]}
        for k in coletillas:
            acciones = acciones_por_ids(k["ids"])
            assert tuple(a.id for a in (espejo_combo(acciones) if c.zurdo else acciones)) in cortas
        assert all(r["t"] == fin for r in reservas)
        ahorro = (1 - FACTOR_VOZ_RAPIDA) * sum(k["duracion"] for k in combos)
        assert sum(FACTOR_VOZ_RAPIDA * r["duracion"] + r["hueco"] for r in reservas) >= ahorro - REDONDEO

        # Lo que dice el guion: las combinaciones y las coletillas con hora (las demás, en fin).
        dichas = sorted(combos + [k for k in coletillas if k["t"] < fin], key=lambda k: k["t"])
        for k in dichas:
            assert inicio + PREPARACION <= k["t"] and k["t"] + k["duracion"] <= fin
        for a, b in zip(dichas, dichas[1:]):
            assert b["t"] >= a["t"] + a["duracion"] + minima - REDONDEO, "no respeta la pausa entre combos"
        if c.duracion_asalto >= 60:
            silencio = fin - dichas[-1]["t"] - dichas[-1]["duracion"]
            assert silencio <= minima + SILENCIO_FINAL + REDONDEO, f"asalto {n}: {silencio:.2f} s callado al final"

        # Combos, reacciones y aviso nunca se pisan (combos con un margen respecto a señales).
        senales = [(e["t"], e["t"] + e["duracion"]) for e in reacciones + de_tipo("aviso")]
        for k in dichas:
            for ini, fin_senal in senales:
                assert (k["t"] + k["duracion"] + MARGEN <= ini + REDONDEO
                        or fin_senal + MARGEN <= k["t"] + REDONDEO), f"combo en {k['t']} pisa {ini}-{fin_senal}"
        for (_, fin_a), (ini_b, _) in zip(sorted(senales), sorted(senales)[1:]):
            assert fin_a <= ini_b


def test_hay_guiones_con_y_sin_modo_reaccion(js):
    modos = {bool(g["config"].get("modo_reaccion")) for g in js["guiones"]}
    assert modos == {True, False}


def test_hay_guiones_con_cada_velocidad_de_voz(js):
    velocidades = {g["config"].get("velocidad", ConfigSesion().velocidad) for g in js["guiones"]}
    assert velocidades == set(VELOCIDADES.values())


def test_guiones_js_cumplen_los_invariantes(js):
    for g in js["guiones"]:
        comprobar_guion(g["eventos"], ConfigSesion(**g["config"]))


def test_guiones_python_cumplen_los_mismos_invariantes(js):
    # Comprueba que los invariantes describen de verdad al motor de referencia.
    for g in js["guiones"]:
        config = ConfigSesion(**g["config"])
        comprobar_guion(guion_a_dict(construir_guion(config, random.Random(g["semilla"]))), config)


# ---------- Reproducibilidad ----------

def test_motor_js_es_reproducible_con_la_misma_semilla(ruta_js, tmp_path):
    otra = _exportar(tmp_path / "otra.json")
    assert otra.read_bytes() == ruta_js.read_bytes()


def test_senales_de_reaccion_a_la_misma_velocidad_y_duracion_que_python(js):
    assert js["senales"]["velocidad"] == VELOCIDAD_SENAL
    textos = [r["texto"] for r in cargar_presets()["reacciones"]]
    assert sorted(js["senales"]["segundos"]) == sorted(textos)
    for texto, segundos in js["senales"]["segundos"].items():
        assert segundos == pytest.approx(segundos_habla(texto, VELOCIDAD_SENAL)), texto
        assert segundos <= DURACION_REACCION, texto
